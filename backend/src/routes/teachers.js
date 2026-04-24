import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  pool,
  mapTeacherRow,
  normalizeTeacherStatus,
  normalizeTeacherGender,
} from "../db.js";
import { requireAdmin, requireManager } from "../middleware/auth.js";

const router = Router();

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LEN = 8;
const COLS = "id, name, last_name, first_name, email, phone, role_id, subject, address, status, gender";
const TEACHER_SELECT = `
  t.id, t.name, t.last_name, t.first_name, t.email, t.phone, t.role_id,
  COALESCE(tr.name, t.subject, '') AS subject,
  t.address, t.status, t.gender,
  u.id AS user_id
`;

function normalizeEmail(v) {
  if (v == null || typeof v !== "string") return "";
  return v.trim().toLowerCase();
}

function normalizePhone(v) {
  if (v == null || typeof v !== "string") return "";
  return v.trim().replace(/[\s().-]/g, "");
}

function validatePassword(password, { required }) {
  if (!password && !required) return null;
  if (!password || typeof password !== "string" || password.length < MIN_PASSWORD_LEN) {
    return { error: `password must be at least ${MIN_PASSWORD_LEN} characters` };
  }
  return null;
}

function normalizeRoleName(v) {
  if (v == null || typeof v !== "string") return "";
  return v.trim();
}

function splitFullName(value) {
  const full = normalizeRoleName(value).replace(/\s+/g, " ");
  if (!full) return { lastName: "", firstName: "" };
  const parts = full.split(" ");
  if (parts.length === 1) return { lastName: "", firstName: parts[0] };
  return {
    lastName: parts.slice(0, -1).join(" "),
    firstName: parts[parts.length - 1],
  };
}

function normalizePersonName({ name, lastName, firstName }, fallbackName = "") {
  const cleanLastName = normalizeRoleName(lastName);
  const cleanFirstName = normalizeRoleName(firstName);
  if (cleanLastName || cleanFirstName) {
    return {
      name: [cleanLastName, cleanFirstName].filter(Boolean).join(" "),
      lastName: cleanLastName,
      firstName: cleanFirstName,
    };
  }
  const fullName = normalizeRoleName(name || fallbackName).replace(/\s+/g, " ");
  return { name: fullName, ...splitFullName(fullName) };
}

function normalizeRoleKey(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

function userRoleForTeacherRole(roleName) {
  return normalizeRoleKey(roleName) === "quan tri he thong" ? "admin" : "teacher";
}

function normalizePositiveInt(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : NaN;
}

async function resolveTeacherRole(client, { roleId, subject, fallbackRoleId = null, fallbackSubject = "" }) {
  const parsedRoleId = normalizePositiveInt(roleId);
  const roleName = normalizeRoleName(subject);
  if (Number.isNaN(parsedRoleId)) {
    return { error: "roleId must be a positive integer" };
  }
  if (parsedRoleId != null) {
    const role = await client.query(`SELECT id, name FROM teacher_roles WHERE id = $1`, [parsedRoleId]);
    if (!role.rowCount) return { error: "Teacher role not found" };
    return { roleId: role.rows[0].id, subject: role.rows[0].name };
  }
  if (roleName) {
    const role = await client.query(
      `INSERT INTO teacher_roles (name)
       VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name`,
      [roleName]
    );
    return { roleId: role.rows[0].id, subject: role.rows[0].name };
  }
  return { roleId: fallbackRoleId, subject: fallbackSubject || "" };
}

router.get("/roles", requireAdmin, async (_req, res, next) => {
  try {
    const r = await pool.query(`
      SELECT id, name
      FROM teacher_roles
      ORDER BY LOWER(name), id
    `);
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

router.post("/roles", requireManager, async (req, res, next) => {
  try {
    const name = normalizeRoleName(req.body?.name);
    if (!name) return res.status(400).json({ error: "name is required" });
    const r = await pool.query(
      `INSERT INTO teacher_roles (name)
       VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name`,
      [name]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

router.put("/roles/:id", requireManager, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const name = normalizeRoleName(req.body?.name);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid role id" });
    if (!name) return res.status(400).json({ error: "name is required" });
    const r = await pool.query(
      `UPDATE teacher_roles SET name = $1 WHERE id = $2 RETURNING id, name`,
      [name, id]
    );
    if (!r.rowCount) return res.status(404).json({ error: "Teacher role not found" });
    await pool.query(`UPDATE teachers SET subject = $1 WHERE role_id = $2`, [name, id]);
    res.json(r.rows[0]);
  } catch (e) {
    if (e?.code === "23505") return res.status(409).json({ error: "Teacher role already exists" });
    next(e);
  }
});

router.delete("/roles/:id", requireManager, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid role id" });
    const used = await pool.query(`SELECT COUNT(*)::int AS n FROM teachers WHERE role_id = $1`, [id]);
    if (used.rows[0].n > 0) {
      return res.status(409).json({ error: "Teacher role is being used" });
    }
    const r = await pool.query(`DELETE FROM teacher_roles WHERE id = $1 RETURNING id, name`, [id]);
    if (!r.rowCount) return res.status(404).json({ error: "Teacher role not found" });
    res.json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

router.get("/", requireAdmin, async (_req, res, next) => {
  try {
    const r = await pool.query(`
      SELECT ${TEACHER_SELECT}
      FROM teachers t
      LEFT JOIN teacher_roles tr ON tr.id = t.role_id
      LEFT JOIN users u ON u.teacher_id = t.id
      ORDER BY t.id
    `);
    res.json(r.rows.map(mapTeacherRow));
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (req.user?.role !== "admin" && req.user?.teacherId !== id) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const r = await pool.query(
      `SELECT ${TEACHER_SELECT}
       FROM teachers t
       LEFT JOIN teacher_roles tr ON tr.id = t.role_id
       LEFT JOIN users u ON u.teacher_id = t.id
       WHERE t.id = $1`,
      [id]
    );
    if (!r.rowCount) return res.status(404).json({ error: "Teacher not found" });
    res.json(mapTeacherRow(r.rows[0]));
  } catch (e) {
    next(e);
  }
});

router.post("/", requireManager, async (req, res, next) => {
  try {
    const { name, lastName, firstName, email, phone, roleId, subject, address, status, gender, password } = req.body || {};
    const personName = normalizePersonName({ name, lastName, firstName });
    if (!personName.name) {
      return res.status(400).json({ error: "name is required" });
    }
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      return res.status(400).json({ error: "phone is required for teacher login" });
    }
    const passwordErr = validatePassword(password, { required: true });
    if (passwordErr) return res.status(400).json(passwordErr);
    const normStatus = normalizeTeacherStatus(status);
    if (normStatus?.error) return res.status(400).json(normStatus);
    const normGender = normalizeTeacherGender(gender);
    if (normGender?.error) return res.status(400).json(normGender);
    const cleanEmail = normalizeEmail(email);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const dupPhone = await client.query(
        `SELECT id FROM users WHERE phone = $1`,
        [cleanPhone]
      );
      if (dupPhone.rowCount) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Phone is already used by another account" });
      }
      if (cleanEmail) {
        const dupEmail = await client.query(
          `SELECT id FROM users WHERE email = $1`,
          [cleanEmail]
        );
        if (dupEmail.rowCount) {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: "Email is already used by another account" });
        }
      }
      const role = await resolveTeacherRole(client, { roleId, subject });
      if (role.error) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: role.error });
      }

      const t = await client.query(
        `INSERT INTO teachers (name, last_name, first_name, email, phone, role_id, subject, address, status, gender)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING ${COLS}`,
        [
          personName.name,
          personName.lastName,
          personName.firstName,
          cleanEmail,
          cleanPhone,
          role.roleId,
          role.subject,
          address != null ? String(address).trim() : "",
          normStatus,
          normGender,
        ]
      );
      const teacher = t.rows[0];
      const userRole = userRoleForTeacherRole(role.subject);
      await client.query(
        `INSERT INTO users (email, phone, password_hash, role, name, last_name, first_name, teacher_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [cleanEmail || null, cleanPhone, passwordHash, userRole, teacher.name, teacher.last_name, teacher.first_name, teacher.id]
      );

      const row = await client.query(
        `SELECT ${TEACHER_SELECT}
         FROM teachers t
         LEFT JOIN teacher_roles tr ON tr.id = t.role_id
         LEFT JOIN users u ON u.teacher_id = t.id
         WHERE t.id = $1`,
        [teacher.id]
      );
      await client.query("COMMIT");
      res.status(201).json(mapTeacherRow(row.rows[0]));
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

router.put("/:id", requireManager, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const sel = await pool.query(
      `SELECT ${COLS} FROM teachers WHERE id = $1`,
      [id]
    );
    if (!sel.rowCount) return res.status(404).json({ error: "Teacher not found" });
    const cur = sel.rows[0];
    const { name, lastName, firstName, email, phone, roleId, subject, address, status, gender, password } = req.body || {};
    const passwordErr = validatePassword(password, { required: false });
    if (passwordErr) return res.status(400).json(passwordErr);

    const personName =
      name != null || lastName != null || firstName != null
        ? normalizePersonName({ name, lastName, firstName }, cur.name)
        : {
            name: cur.name,
            lastName: cur.last_name ?? "",
            firstName: cur.first_name ?? "",
          };
    if (!personName.name) {
      return res.status(400).json({ error: "name must be a non-empty string" });
    }
    const nextName = personName.name;
    const nextEmail = email != null ? normalizeEmail(email) : cur.email;
    const nextPhone = phone != null ? normalizePhone(phone) : cur.phone;
    if (!nextPhone) {
      return res.status(400).json({ error: "phone is required for teacher login" });
    }
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

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const user = await client.query(
        `SELECT id FROM users WHERE teacher_id = $1`,
        [id]
      );
      const phoneTaken = await client.query(
        `SELECT id FROM users WHERE phone = $1 AND teacher_id IS DISTINCT FROM $2`,
        [nextPhone, id]
      );
      if (phoneTaken.rowCount) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Phone is already used by another account" });
      }
      if (nextEmail) {
        const emailTaken = await client.query(
          `SELECT id FROM users WHERE email = $1 AND teacher_id IS DISTINCT FROM $2`,
          [nextEmail, id]
        );
        if (emailTaken.rowCount) {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: "Email is already used by another account" });
        }
      }
      const role = await resolveTeacherRole(client, {
        roleId,
        subject,
        fallbackRoleId: cur.role_id,
        fallbackSubject: cur.subject,
      });
      if (role.error) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: role.error });
      }

      await client.query(
        `UPDATE teachers SET name=$1, last_name=$2, first_name=$3, email=$4, phone=$5, role_id=$6, subject=$7, address=$8, status=$9, gender=$10
         WHERE id = $11`,
        [nextName, personName.lastName, personName.firstName, nextEmail, nextPhone, role.roleId, role.subject, nextAddress, nextStatus, nextGender, id]
      );

      if (user.rowCount) {
        const userRole = userRoleForTeacherRole(role.subject);
        if (password) {
          const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
          await client.query(
            `UPDATE users
             SET name = $1, last_name = $2, first_name = $3, email = $4, phone = $5, password_hash = $6, role = $7
             WHERE teacher_id = $8`,
            [nextName, personName.lastName, personName.firstName, nextEmail || null, nextPhone, passwordHash, userRole, id]
          );
        } else {
          await client.query(
            `UPDATE users
             SET name = $1, last_name = $2, first_name = $3, email = $4, phone = $5, role = $6
             WHERE teacher_id = $7`,
            [nextName, personName.lastName, personName.firstName, nextEmail || null, nextPhone, userRole, id]
          );
        }
      } else if (password) {
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const userRole = userRoleForTeacherRole(role.subject);
        await client.query(
          `INSERT INTO users (email, phone, password_hash, role, name, last_name, first_name, teacher_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [nextEmail || null, nextPhone, passwordHash, userRole, nextName, personName.lastName, personName.firstName, id]
        );
      }

      const r = await client.query(
        `SELECT ${TEACHER_SELECT}
         FROM teachers t
         LEFT JOIN teacher_roles tr ON tr.id = t.role_id
         LEFT JOIN users u ON u.teacher_id = t.id
         WHERE t.id = $1`,
        [id]
      );
      await client.query("COMMIT");
      res.json(mapTeacherRow(r.rows[0]));
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

router.delete("/:id", requireManager, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM users WHERE teacher_id = $1`, [id]);
      const r = await client.query(
        `DELETE FROM teachers WHERE id = $1 RETURNING ${COLS}`,
        [id]
      );
      if (!r.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Teacher not found" });
      }
      await client.query("COMMIT");
      res.json(mapTeacherRow(r.rows[0]));
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

export default router;
