import { Router } from "express";
import {
  pool,
  mapStudentRow,
  mapStudentClassHistoryRow,
  normalizeDateInput,
  normalizeStudentStatus,
  normalizeStudentGender,
} from "../db.js";

const router = Router();

function normalizeHistoryNote(v) {
  if (v == null) return "";
  return String(v).trim().slice(0, 2000);
}

function classIdsDiffer(a, b) {
  const na = a != null && a !== "" ? Number(a) : null;
  const nb = b != null && b !== "" ? Number(b) : null;
  if (na === null && nb === null) return false;
  if (na === null || nb === null) return true;
  return na !== nb;
}

const studentSelect = `
  SELECT s.id, s.name, s.grade, s.email, s.date_of_birth, s.class_id,
         s.avatar, s.join_date, s.status, s.gender,
         s.phone, s.nationality, s.religion, s.province, s.ward, s.hamlet,
         s.birth_place, s.father_birth_year, s.mother_birth_year,
         s.id_number, s.id_issued_place, s.id_issued_date, s.area,
         s.disability_type, s.policy_beneficiary, s.eye_disease,
         s.guardian_name, s.guardian_occupation, s.guardian_birth_year,
         c.name AS class_name
  FROM students s
  LEFT JOIN classes c ON c.id = s.class_id
`;

async function resolveClassId(raw) {
  if (raw == null || raw === "") return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    return { error: "classId must be a positive integer or empty" };
  }
  const c = await pool.query(`SELECT id FROM classes WHERE id = $1`, [id]);
  if (!c.rowCount) return { error: "Class not found" };
  return { id };
}

router.get("/", async (_req, res, next) => {
  try {
    const r = await pool.query(`${studentSelect} ORDER BY s.id`);
    res.json(r.rows.map(mapStudentRow));
  } catch (e) {
    next(e);
  }
});

const historySelect = `
  SELECT h.id, h.student_id, h.from_class_id, h.to_class_id, h.effective_date, h.note, h.created_at,
         cf.name AS from_class_name, ct.name AS to_class_name
  FROM student_class_history h
  LEFT JOIN classes cf ON cf.id = h.from_class_id
  LEFT JOIN classes ct ON ct.id = h.to_class_id
`;

router.get("/:id/class-history", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(404).json({ error: "Student not found" });
    }
    const exists = await pool.query(`SELECT 1 FROM students WHERE id = $1`, [id]);
    if (!exists.rowCount) return res.status(404).json({ error: "Student not found" });
    const r = await pool.query(
      `${historySelect} WHERE h.student_id = $1 ORDER BY h.effective_date DESC, h.id DESC`,
      [id]
    );
    res.json(r.rows.map(mapStudentClassHistoryRow));
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const r = await pool.query(`${studentSelect} WHERE s.id = $1`, [id]);
    if (!r.rowCount) return res.status(404).json({ error: "Student not found" });
    res.json(mapStudentRow(r.rows[0]));
  } catch (e) {
    next(e);
  }
});

function str(v) {
  return v != null ? String(v).trim() : "";
}

router.post("/", async (req, res, next) => {
  try {
    const b = req.body || {};
    const { name, grade, email, dateOfBirth, classId, avatar, joinDate, status, gender } = b;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    const cid = await resolveClassId(classId);
    if (cid && cid.error) return res.status(400).json({ error: cid.error });
    const class_id = cid == null ? null : cid.id;

    const st = normalizeStudentStatus(status);
    if (typeof st === "object" && st.error) {
      return res.status(400).json({ error: st.error });
    }

    const gen = normalizeStudentGender(gender);
    if (typeof gen === "object" && gen.error) {
      return res.status(400).json({ error: gen.error });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const r = await client.query(
        `INSERT INTO students (
           name, grade, email, date_of_birth, class_id, avatar, join_date, status, gender,
           phone, nationality, religion, province, ward, hamlet,
           birth_place, father_birth_year, mother_birth_year,
           id_number, id_issued_place, id_issued_date, area,
           disability_type, policy_beneficiary, eye_disease,
           guardian_name, guardian_occupation, guardian_birth_year
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
         RETURNING id`,
        [
          name.trim(),
          str(grade),
          str(email),
          normalizeDateInput(dateOfBirth),
          class_id,
          avatar != null ? String(avatar).trim().slice(0, 100000) : "",
          normalizeDateInput(joinDate),
          st,
          gen,
          str(b.phone), str(b.nationality), str(b.religion),
          str(b.province), str(b.ward), str(b.hamlet),
          str(b.birthPlace), str(b.fatherBirthYear), str(b.motherBirthYear),
          str(b.idNumber), str(b.idIssuedPlace), normalizeDateInput(b.idIssuedDate), str(b.area),
          str(b.disabilityType), str(b.policyBeneficiary), str(b.eyeDisease),
          str(b.guardianName), str(b.guardianOccupation), str(b.guardianBirthYear),
        ]
      );
      const newId = r.rows[0].id;
      if (class_id != null) {
        const eff = normalizeDateInput(joinDate);
        await client.query(
          `INSERT INTO student_class_history (student_id, from_class_id, to_class_id, effective_date, note)
           VALUES ($1, NULL, $2, COALESCE($3::date, CURRENT_DATE), $4)`,
          [newId, class_id, eff, normalizeHistoryNote(req.body?.classHistoryNote)]
        );
      }
      await client.query("COMMIT");
      const full = await pool.query(`${studentSelect} WHERE s.id = $1`, [newId]);
      res.status(201).json(mapStudentRow(full.rows[0]));
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

router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    const {
      name, grade, email, dateOfBirth, classId, avatar, joinDate, status, gender,
      classChangeEffectiveDate, classChangeNote,
    } = b;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const sel = await client.query(
        `SELECT * FROM students WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (!sel.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Student not found" });
      }
      const cur = sel.rows[0];

      let nextName = cur.name;
      if (name != null) {
        if (typeof name !== "string" || !name.trim()) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "name must be a non-empty string" });
        }
        nextName = name.trim();
      }
      const nextGrade = grade != null ? String(grade).trim() : cur.grade;
      const nextEmail = email != null ? String(email).trim() : cur.email;
      const nextDob =
        dateOfBirth != null ? normalizeDateInput(dateOfBirth) : cur.date_of_birth;

      let nextClassId = cur.class_id;
      if (classId !== undefined) {
        const cid = await resolveClassId(classId);
        if (cid && cid.error) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: cid.error });
        }
        nextClassId = cid == null ? null : cid.id;
      }

      const nextAvatar =
        avatar !== undefined
          ? String(avatar).trim().slice(0, 100000)
          : cur.avatar ?? "";
      const nextJoin =
        joinDate !== undefined ? normalizeDateInput(joinDate) : cur.join_date;

      let nextStatus = cur.status ?? "active";
      if (status !== undefined) {
        const st = normalizeStudentStatus(status);
        if (typeof st === "object" && st.error) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: st.error });
        }
        nextStatus = st;
      }

      let nextGender = cur.gender === "female" ? "female" : "male";
      if (gender !== undefined) {
        const gen = normalizeStudentGender(gender);
        if (typeof gen === "object" && gen.error) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: gen.error });
        }
        nextGender = gen;
      }

      if (classIdsDiffer(cur.class_id, nextClassId)) {
        const rawEff =
          classChangeEffectiveDate !== undefined && classChangeEffectiveDate !== null
            ? String(classChangeEffectiveDate).trim()
            : "";
        if (rawEff !== "") {
          const parsed = normalizeDateInput(classChangeEffectiveDate);
          if (!parsed) {
            await client.query("ROLLBACK");
            return res
              .status(400)
              .json({ error: "classChangeEffectiveDate must be a valid date (YYYY-MM-DD)" });
          }
        }
        const effParam = rawEff === "" ? null : normalizeDateInput(classChangeEffectiveDate);
        await client.query(
          `INSERT INTO student_class_history (student_id, from_class_id, to_class_id, effective_date, note)
           VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5)`,
          [
            id,
            cur.class_id,
            nextClassId,
            effParam,
            normalizeHistoryNote(classChangeNote),
          ]
        );
      }

      const upd = (field) => b[field] != null ? String(b[field]).trim() : (cur[field] ?? "");
      const updSnake = (camel, snake) => b[camel] != null ? String(b[camel]).trim() : (cur[snake] ?? "");

      await client.query(
        `UPDATE students SET
           name=$1, grade=$2, email=$3, date_of_birth=$4, class_id=$5,
           avatar=$6, join_date=$7, status=$8, gender=$9,
           phone=$10, nationality=$11, religion=$12, province=$13, ward=$14, hamlet=$15,
           birth_place=$16, father_birth_year=$17, mother_birth_year=$18,
           id_number=$19, id_issued_place=$20, id_issued_date=$21, area=$22,
           disability_type=$23, policy_beneficiary=$24, eye_disease=$25,
           guardian_name=$26, guardian_occupation=$27, guardian_birth_year=$28
         WHERE id = $29`,
        [
          nextName, nextGrade, nextEmail, nextDob, nextClassId,
          nextAvatar, nextJoin, nextStatus, nextGender,
          upd("phone"), upd("nationality"), upd("religion"),
          upd("province"), upd("ward"), upd("hamlet"),
          updSnake("birthPlace", "birth_place"),
          updSnake("fatherBirthYear", "father_birth_year"),
          updSnake("motherBirthYear", "mother_birth_year"),
          updSnake("idNumber", "id_number"),
          updSnake("idIssuedPlace", "id_issued_place"),
          b.idIssuedDate !== undefined ? normalizeDateInput(b.idIssuedDate) : cur.id_issued_date,
          upd("area"),
          updSnake("disabilityType", "disability_type"),
          updSnake("policyBeneficiary", "policy_beneficiary"),
          updSnake("eyeDisease", "eye_disease"),
          updSnake("guardianName", "guardian_name"),
          updSnake("guardianOccupation", "guardian_occupation"),
          updSnake("guardianBirthYear", "guardian_birth_year"),
          id,
        ]
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    const full = await pool.query(`${studentSelect} WHERE s.id = $1`, [id]);
    res.json(mapStudentRow(full.rows[0]));
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const r = await pool.query(
      `DELETE FROM students WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!r.rowCount) return res.status(404).json({ error: "Student not found" });
    res.json(
      mapStudentRow({
        ...r.rows[0],
        class_name: "",
      })
    );
  } catch (e) {
    next(e);
  }
});

export default router;
