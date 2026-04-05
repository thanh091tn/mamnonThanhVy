import { Router } from "express";
import {
  pool,
  mapTeacherRow,
  normalizeTeacherStatus,
  normalizeTeacherGender,
} from "../db.js";

const router = Router();

const COLS = "id, name, email, phone, address, status, gender";

router.get("/", async (_req, res, next) => {
  try {
    const r = await pool.query(`SELECT ${COLS} FROM teachers ORDER BY id`);
    res.json(r.rows.map(mapTeacherRow));
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const r = await pool.query(
      `SELECT ${COLS} FROM teachers WHERE id = $1`,
      [id]
    );
    if (!r.rowCount) return res.status(404).json({ error: "Teacher not found" });
    res.json(mapTeacherRow(r.rows[0]));
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, email, phone, address, status, gender } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    const normStatus = normalizeTeacherStatus(status);
    if (normStatus?.error) return res.status(400).json(normStatus);
    const normGender = normalizeTeacherGender(gender);
    if (normGender?.error) return res.status(400).json(normGender);

    const r = await pool.query(
      `INSERT INTO teachers (name, email, phone, address, status, gender)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COLS}`,
      [
        name.trim(),
        email != null ? String(email).trim() : "",
        phone != null ? String(phone).trim() : "",
        address != null ? String(address).trim() : "",
        normStatus,
        normGender,
      ]
    );
    res.status(201).json(mapTeacherRow(r.rows[0]));
  } catch (e) {
    next(e);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const sel = await pool.query(
      `SELECT ${COLS} FROM teachers WHERE id = $1`,
      [id]
    );
    if (!sel.rowCount) return res.status(404).json({ error: "Teacher not found" });
    const cur = sel.rows[0];
    const { name, email, phone, address, status, gender } = req.body || {};

    let nextName = cur.name;
    if (name != null) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "name must be a non-empty string" });
      }
      nextName = name.trim();
    }
    const nextEmail = email != null ? String(email).trim() : cur.email;
    const nextPhone = phone != null ? String(phone).trim() : cur.phone;
    const nextAddress = address != null ? String(address).trim() : cur.address;

    let nextStatus = cur.status;
    if (status != null) {
      const ns = normalizeTeacherStatus(status);
      if (ns?.error) return res.status(400).json(ns);
      nextStatus = ns;
    }
    let nextGender = cur.gender;
    if (gender != null) {
      const ng = normalizeTeacherGender(gender);
      if (ng?.error) return res.status(400).json(ng);
      nextGender = ng;
    }

    const r = await pool.query(
      `UPDATE teachers SET name=$1, email=$2, phone=$3, address=$4, status=$5, gender=$6
       WHERE id = $7
       RETURNING ${COLS}`,
      [nextName, nextEmail, nextPhone, nextAddress, nextStatus, nextGender, id]
    );
    res.json(mapTeacherRow(r.rows[0]));
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const r = await pool.query(
      `DELETE FROM teachers WHERE id = $1 RETURNING ${COLS}`,
      [id]
    );
    if (!r.rowCount) return res.status(404).json({ error: "Teacher not found" });
    res.json(mapTeacherRow(r.rows[0]));
  } catch (e) {
    next(e);
  }
});

export default router;
