import { Router } from "express";
import { pool, mapClassRow } from "../db.js";
import { requireManager } from "../middleware/auth.js";

const router = Router();

const classSelect = `
  SELECT c.id, c.name, c.level, c.room,
         MIN(ct.teacher_id) AS teacher_id,
         ARRAY_REMOVE(ARRAY_AGG(t.id ORDER BY t.name, t.id), NULL) AS teacher_ids,
         ARRAY_REMOVE(ARRAY_AGG(t.name ORDER BY t.name, t.id), NULL) AS teacher_names
  FROM classes c
  LEFT JOIN class_teachers ct ON ct.class_id = c.id
  LEFT JOIN teachers t ON t.id = ct.teacher_id
`;

function normalizeTeacherIds(raw) {
  if (raw == null || raw === "") return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const ids = [];
  for (const value of arr) {
    if (value == null || value === "") continue;
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1) {
      return { error: "teacherIds must contain positive integers" };
    }
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

async function validateTeacherIds(ids, client = pool) {
  if (!ids.length) return null;
  const r = await client.query(`SELECT id FROM teachers WHERE id = ANY($1::int[])`, [ids]);
  if (r.rowCount !== ids.length) return { error: "One or more teachers were not found" };
  return null;
}

async function replaceClassTeachers(client, classId, teacherIds) {
  await client.query(`DELETE FROM class_teachers WHERE class_id = $1`, [classId]);
  for (const teacherId of teacherIds) {
    await client.query(
      `INSERT INTO class_teachers (class_id, teacher_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [classId, teacherId]
    );
  }
  await client.query(
    `UPDATE classes SET teacher_id = $1 WHERE id = $2`,
    [teacherIds.length ? teacherIds[0] : null, classId]
  );
}

router.get("/", async (req, res, next) => {
  try {
    const params = [];
    let where = "";
    if (req.user?.role === "teacher") {
      if (req.user.teacherId == null) return res.json([]);
      params.push(req.user.teacherId);
      where = "WHERE EXISTS (SELECT 1 FROM class_teachers mine WHERE mine.class_id = c.id AND mine.teacher_id = $1)";
    }
    const r = await pool.query(
      `${classSelect}
       ${where}
       GROUP BY c.id, c.name, c.level, c.room
       ORDER BY c.id`,
      params
    );
    res.json(r.rows.map(mapClassRow));
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const params = [id];
    let access = "";
    if (req.user?.role === "teacher") {
      if (req.user.teacherId == null) {
        return res.status(403).json({ error: "Class is not assigned to this teacher" });
      }
      params.push(req.user.teacherId);
      access = "AND EXISTS (SELECT 1 FROM class_teachers mine WHERE mine.class_id = c.id AND mine.teacher_id = $2)";
    }
    const r = await pool.query(
      `${classSelect}
       WHERE c.id = $1 ${access}
       GROUP BY c.id, c.name, c.level, c.room`,
      params
    );
    if (!r.rowCount) return res.status(404).json({ error: "Class not found" });
    res.json(mapClassRow(r.rows[0]));
  } catch (e) {
    next(e);
  }
});

router.post("/", requireManager, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, level, room, teacherIds, teacherId } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    const ids = normalizeTeacherIds(teacherIds !== undefined ? teacherIds : teacherId);
    if (ids.error) return res.status(400).json({ error: ids.error });
    const teacherErr = await validateTeacherIds(ids, client);
    if (teacherErr) return res.status(400).json(teacherErr);

    await client.query("BEGIN");
    const r = await client.query(
      `INSERT INTO classes (name, level, room, teacher_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        name.trim(),
        level != null ? String(level).trim() : "",
        room != null ? String(room).trim() : "",
        ids.length ? ids[0] : null,
      ]
    );
    await replaceClassTeachers(client, r.rows[0].id, ids);
    const full = await client.query(
      `${classSelect}
       WHERE c.id = $1
       GROUP BY c.id, c.name, c.level, c.room`,
      [r.rows[0].id]
    );
    await client.query("COMMIT");
    res.status(201).json(mapClassRow(full.rows[0]));
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

router.put("/:id", requireManager, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    const sel = await client.query(
      `SELECT id, name, level, room FROM classes WHERE id = $1`,
      [id]
    );
    if (!sel.rowCount) return res.status(404).json({ error: "Class not found" });
    const cur = sel.rows[0];
    const { name, level, room, teacherIds, teacherId } = req.body || {};

    let nextName = cur.name;
    if (name != null) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "name must be a non-empty string" });
      }
      nextName = name.trim();
    }
    const nextLevel = level != null ? String(level).trim() : cur.level;
    const nextRoom = room != null ? String(room).trim() : cur.room;

    let ids = null;
    if (teacherIds !== undefined || teacherId !== undefined) {
      ids = normalizeTeacherIds(teacherIds !== undefined ? teacherIds : teacherId);
      if (ids.error) return res.status(400).json({ error: ids.error });
      const teacherErr = await validateTeacherIds(ids, client);
      if (teacherErr) return res.status(400).json(teacherErr);
    }

    await client.query("BEGIN");
    await client.query(
      `UPDATE classes SET name = $1, level = $2, room = $3 WHERE id = $4`,
      [nextName, nextLevel, nextRoom, id]
    );
    if (ids) {
      await replaceClassTeachers(client, id, ids);
    }
    const full = await client.query(
      `${classSelect}
       WHERE c.id = $1
       GROUP BY c.id, c.name, c.level, c.room`,
      [id]
    );
    await client.query("COMMIT");
    res.json(mapClassRow(full.rows[0]));
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

router.delete("/:id", requireManager, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const r = await pool.query(
      `DELETE FROM classes WHERE id = $1 RETURNING id, name, level, room, teacher_id`,
      [id]
    );
    if (!r.rowCount) return res.status(404).json({ error: "Class not found" });
    res.json(mapClassRow({ ...r.rows[0], teacher_ids: [], teacher_names: [] }));
  } catch (e) {
    next(e);
  }
});

export default router;
