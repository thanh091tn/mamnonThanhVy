import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { requireAuth, signToken } from "../middleware/auth.js";

const router = Router();

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LEN = 8;

function normalizeEmail(v) {
  if (v == null || typeof v !== "string") return "";
  return v.trim().toLowerCase();
}

function normalizePhone(v) {
  if (v == null || typeof v !== "string") return "";
  return v.trim().replace(/[\s().-]/g, "");
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email ?? "",
    phone: row.phone ?? "",
    name: row.name ?? "",
    role: row.role,
    teacherId: row.teacher_id != null ? row.teacher_id : null,
  };
}

function adminRegisterAllowed() {
  const v = String(process.env.ENABLE_ADMIN_REGISTER ?? "").toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

router.post("/register", async (req, res, next) => {
  try {
    const { email: rawEmail, password, name: rawName, role: rawRole } =
      req.body || {};
    const email = normalizeEmail(rawEmail);
    const name =
      rawName != null && String(rawName).trim() ? String(rawName).trim() : "";
    const role =
      String(rawRole || "teacher")
        .trim()
        .toLowerCase() === "admin"
        ? "admin"
        : "teacher";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    if (!password || typeof password !== "string" || password.length < MIN_PASSWORD_LEN) {
      return res
        .status(400)
        .json({ error: `Password must be at least ${MIN_PASSWORD_LEN} characters` });
    }
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (role === "admin" && !adminRegisterAllowed()) {
      return res.status(403).json({ error: "Admin registration is disabled" });
    }

    const dup = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (dup.rowCount) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let teacher_id = null;
      if (role === "teacher") {
        const existing = await client.query(
          `SELECT id FROM teachers WHERE LOWER(TRIM(email)) = $1`,
          [email]
        );
        if (existing.rowCount) {
          teacher_id = existing.rows[0].id;
          const taken = await client.query(
            `SELECT id FROM users WHERE teacher_id = $1`,
            [teacher_id]
          );
          if (taken.rowCount) {
            await client.query("ROLLBACK");
            return res.status(409).json({
              error: "A user account is already linked to this teacher email",
            });
          }
        } else {
          const insT = await client.query(
            `INSERT INTO teachers (name, email, phone, address, status, gender)
             VALUES ($1, $2, '', '', 'active', 'male')
             RETURNING id`,
            [name, email]
          );
          teacher_id = insT.rows[0].id;
        }
      }

      const insU = await client.query(
        `INSERT INTO users (email, phone, password_hash, role, name, teacher_id)
         VALUES ($1, '', $2, $3, $4, $5)
         RETURNING id, email, phone, name, role, teacher_id`,
        [email, password_hash, role, name, teacher_id]
      );

      await client.query("COMMIT");
      const row = insU.rows[0];
      const user = publicUser(row);
      const token = signToken({
        sub: String(user.id),
        role: user.role,
        teacherId: user.teacherId,
      });
      res.status(201).json({ user, token });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    next(e);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email: rawEmail, phone: rawPhone, password } = req.body || {};
    const email = normalizeEmail(rawEmail);
    const phone = normalizePhone(rawPhone);
    if ((!email && !phone) || !password) {
      return res.status(400).json({ error: "Phone/email and password are required" });
    }
    const r = phone
      ? await pool.query(
          `SELECT id, email, phone, name, role, teacher_id, password_hash
           FROM users
           WHERE phone = $1`,
          [phone]
        )
      : await pool.query(
          `SELECT id, email, phone, name, role, teacher_id, password_hash
           FROM users
           WHERE email = $1`,
          [email]
        );
    if (!r.rowCount) {
      return res.status(401).json({ error: "Invalid phone/email or password" });
    }
    const row = r.rows[0];
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid phone/email or password" });
    }
    if (row.role === "teacher") {
      if (row.teacher_id == null) {
        return res.status(403).json({ error: "Teacher account is not linked to a profile" });
      }
      const tr = await pool.query(`SELECT status FROM teachers WHERE id = $1`, [
        row.teacher_id,
      ]);
      if (!tr.rowCount) {
        return res.status(403).json({ error: "Teacher profile was not found" });
      }
      if (tr.rows[0].status === "inactive") {
        return res.status(403).json({ error: "Teacher account is inactive" });
      }
    }
    const user = publicUser(row);
    const token = signToken({
      sub: String(user.id),
      role: user.role,
      teacherId: user.teacherId,
    });
    res.json({ user, token });
  } catch (e) {
    next(e);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT id, email, phone, name, role, teacher_id FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!r.rowCount) {
      return res.status(401).json({ error: "User not found" });
    }
    res.json({ user: publicUser(r.rows[0]) });
  } catch (e) {
    next(e);
  }
});

export default router;
