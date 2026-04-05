import { Router } from "express";
import { pool, mapClassRow } from "../db.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const r = await pool.query(`
      SELECT c.id, c.name, c.level, c.room, c.teacher_id,
             t.name AS teacher_name
      FROM classes c
      LEFT JOIN teachers t ON t.id = c.teacher_id
      ORDER BY c.id
    `);
    res.json(r.rows.map(mapClassRow));
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const r = await pool.query(
      `
      SELECT c.id, c.name, c.level, c.room, c.teacher_id,
             t.name AS teacher_name
      FROM classes c
      LEFT JOIN teachers t ON t.id = c.teacher_id
      WHERE c.id = $1
    `,
      [id]
    );
    if (!r.rowCount) return res.status(404).json({ error: "Class not found" });
    res.json(mapClassRow(r.rows[0]));
  } catch (e) {
    next(e);
  }
});

async function resolveTeacherId(raw) {
  if (raw == null || raw === "") return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    return { error: "teacherId must be a positive integer or empty" };
  }
  const t = await pool.query(`SELECT id FROM teachers WHERE id = $1`, [id]);
  if (!t.rowCount) return { error: "Teacher not found" };
  return { id };
}

router.post("/", async (req, res, next) => {
  try {
    const { name, level, room, teacherId } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    const tid = await resolveTeacherId(teacherId);
    if (tid && tid.error) return res.status(400).json({ error: tid.error });
    const teacher_id = tid == null ? null : tid.id;

    const r = await pool.query(
      `INSERT INTO classes (name, level, room, teacher_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, level, room, teacher_id`,
      [
        name.trim(),
        level != null ? String(level).trim() : "",
        room != null ? String(room).trim() : "",
        teacher_id,
      ]
    );
    const full = await pool.query(
      `
      SELECT c.id, c.name, c.level, c.room, c.teacher_id,
             t.name AS teacher_name
      FROM classes c
      LEFT JOIN teachers t ON t.id = c.teacher_id
      WHERE c.id = $1
    `,
      [r.rows[0].id]
    );
    res.status(201).json(mapClassRow(full.rows[0]));
  } catch (e) {
    next(e);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const sel = await pool.query(
      `SELECT id, name, level, room, teacher_id FROM classes WHERE id = $1`,
      [id]
    );
    if (!sel.rowCount) return res.status(404).json({ error: "Class not found" });
    const cur = sel.rows[0];
    const { name, level, room, teacherId } = req.body || {};

    let nextName = cur.name;
    if (name != null) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "name must be a non-empty string" });
      }
      nextName = name.trim();
    }
    const nextLevel = level != null ? String(level).trim() : cur.level;
    const nextRoom = room != null ? String(room).trim() : cur.room;

    let nextTeacherId = cur.teacher_id;
    if (teacherId !== undefined) {
      const tid = await resolveTeacherId(teacherId);
      if (tid && tid.error) return res.status(400).json({ error: tid.error });
      nextTeacherId = tid == null ? null : tid.id;
    }

    await pool.query(
      `UPDATE classes SET name = $1, level = $2, room = $3, teacher_id = $4 WHERE id = $5`,
      [nextName, nextLevel, nextRoom, nextTeacherId, id]
    );
    const full = await pool.query(
      `
      SELECT c.id, c.name, c.level, c.room, c.teacher_id,
             t.name AS teacher_name
      FROM classes c
      LEFT JOIN teachers t ON t.id = c.teacher_id
      WHERE c.id = $1
    `,
      [id]
    );
    res.json(mapClassRow(full.rows[0]));
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const r = await pool.query(
      `
      DELETE FROM classes WHERE id = $1
      RETURNING id, name, level, room, teacher_id
    `,
      [id]
    );
    if (!r.rowCount) return res.status(404).json({ error: "Class not found" });
    res.json(mapClassRow({ ...r.rows[0], teacher_name: "" }));
  } catch (e) {
    next(e);
  }
});

export default router;
