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
  SELECT s.id, s.name, s.last_name, s.first_name, s.grade, s.email, s.date_of_birth, s.class_id,
         s.avatar, s.join_date, s.status, s.gender,
         s.phone, s.nationality, s.religion, s.province, s.ward, s.house_number, s.street, s.hamlet,
         s.birth_place, s.father_birth_year, s.mother_birth_year,
         s.father_name, s.father_birth_date, s.father_phone, s.father_email,
         s.father_login, s.father_id_number, s.father_occupation,
         s.mother_name, s.mother_birth_date, s.mother_phone, s.mother_email,
         s.mother_login, s.mother_id_number, s.mother_occupation,
         s.id_number, s.id_issued_place, s.id_issued_date, s.area, s.bhyt_number,
         s.disability_type, s.policy_beneficiary, s.eye_disease,
         s.guardian_name, s.guardian_occupation, s.guardian_birth_year,
         c.name AS class_name
  FROM students s
  LEFT JOIN classes c ON c.id = s.class_id
`;

const studentNameOrder = `
  ORDER BY
    NULLIF(TRIM(s.first_name), '') NULLS LAST,
    NULLIF(TRIM(s.last_name), '') NULLS LAST,
    NULLIF(TRIM(s.name), '') NULLS LAST,
    s.id
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

async function assertStudentAccess(db, req, rawStudentId) {
  const studentId = Number(rawStudentId);
  if (!Number.isInteger(studentId) || studentId < 1) {
    return { status: 404, error: "Student not found" };
  }

  const r = await db.query(`SELECT id, class_id FROM students WHERE id = $1`, [studentId]);
  if (!r.rowCount) {
    return { status: 404, error: "Student not found" };
  }
  if (req.user?.role === "admin") {
    return { studentId };
  }
  if (req.user?.role === "teacher" && req.user.teacherId != null && r.rows[0].class_id != null) {
    const access = await db.query(
      `SELECT 1 FROM class_teachers WHERE class_id = $1 AND teacher_id = $2`,
      [r.rows[0].class_id, req.user.teacherId]
    );
    if (access.rowCount) {
      return { studentId };
    }
  }
  return { status: 403, error: "Student is not assigned to this teacher" };
}

async function assertClassWriteAccess(db, req, classId) {
  if (req.user?.role === "admin") {
    return {};
  }
  if (req.user?.role !== "teacher" || req.user.teacherId == null) {
    return { status: 403, error: "Admin or assigned teacher access required" };
  }
  if (classId == null) {
    return { status: 403, error: "Teacher can only manage students in assigned classes" };
  }
  const access = await db.query(
    `SELECT 1 FROM class_teachers WHERE class_id = $1 AND teacher_id = $2`,
    [classId, req.user.teacherId]
  );
  if (!access.rowCount) {
    return { status: 403, error: "Class is not assigned to this teacher" };
  }
  return {};
}

router.get("/", async (req, res, next) => {
  try {
    const params = [];
    let where = "";
    if (req.user?.role === "teacher") {
      if (req.user.teacherId == null) return res.json([]);
      params.push(req.user.teacherId);
      where = `
        WHERE EXISTS (
          SELECT 1
          FROM class_teachers ct
          WHERE ct.class_id = s.class_id AND ct.teacher_id = $1
        )
      `;
    }
    const r = await pool.query(`${studentSelect} ${where} ${studentNameOrder}`, params);
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
    const access = await assertStudentAccess(pool, req, req.params.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    const id = access.studentId;
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
    const access = await assertStudentAccess(pool, req, req.params.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    const id = access.studentId;
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

function splitFullName(value) {
  const full = str(value).replace(/\s+/g, " ");
  if (!full) return { lastName: "", firstName: "" };
  const parts = full.split(" ");
  if (parts.length === 1) return { lastName: "", firstName: parts[0] };
  return {
    lastName: parts.slice(0, -1).join(" "),
    firstName: parts[parts.length - 1],
  };
}

function normalizePersonName({ name, lastName, firstName }, fallbackName = "") {
  const cleanLastName = str(lastName);
  const cleanFirstName = str(firstName);
  if (cleanLastName || cleanFirstName) {
    return {
      name: [cleanLastName, cleanFirstName].filter(Boolean).join(" "),
      lastName: cleanLastName,
      firstName: cleanFirstName,
    };
  }
  const fullName = str(name || fallbackName).replace(/\s+/g, " ");
  return { name: fullName, ...splitFullName(fullName) };
}

router.post("/", async (req, res, next) => {
  try {
    const b = req.body || {};
    const { name, lastName, firstName, grade, email, dateOfBirth, classId, avatar, joinDate, status, gender } = b;
    const personName = normalizePersonName({ name, lastName, firstName });
    if (!personName.name) {
      return res.status(400).json({ error: "name is required" });
    }
    const cid = await resolveClassId(classId);
    if (cid && cid.error) return res.status(400).json({ error: cid.error });
    const class_id = cid == null ? null : cid.id;
    const classAccess = await assertClassWriteAccess(pool, req, class_id);
    if (classAccess.error) return res.status(classAccess.status).json({ error: classAccess.error });

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
           name, last_name, first_name, grade, email, date_of_birth, class_id, avatar, join_date, status, gender,
           phone, nationality, religion, province, ward, house_number, street, hamlet,
           birth_place, father_birth_year, mother_birth_year,
           father_name, father_birth_date, father_phone, father_email,
           father_login, father_id_number, father_occupation,
           mother_name, mother_birth_date, mother_phone, mother_email,
           mother_login, mother_id_number, mother_occupation,
           id_number, id_issued_place, id_issued_date, area, bhyt_number,
           disability_type, policy_beneficiary, eye_disease,
           guardian_name, guardian_occupation, guardian_birth_year
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47)
          RETURNING id`,
        [
          personName.name,
          personName.lastName,
          personName.firstName,
          str(grade),
          str(email),
          normalizeDateInput(dateOfBirth),
          class_id,
          avatar != null ? String(avatar).trim().slice(0, 100000) : "",
          normalizeDateInput(joinDate),
          st,
          gen,
          str(b.phone), str(b.nationality), str(b.religion),
          str(b.province), str(b.ward), str(b.houseNumber), str(b.street), str(b.hamlet),
          str(b.birthPlace), str(b.fatherBirthYear), str(b.motherBirthYear),
          str(b.fatherName), normalizeDateInput(b.fatherBirthDate), str(b.fatherPhone), str(b.fatherEmail),
          str(b.fatherLogin), str(b.fatherIdNumber), str(b.fatherOccupation),
          str(b.motherName), normalizeDateInput(b.motherBirthDate), str(b.motherPhone), str(b.motherEmail),
          str(b.motherLogin), str(b.motherIdNumber), str(b.motherOccupation),
          str(b.idNumber), str(b.idIssuedPlace), normalizeDateInput(b.idIssuedDate), str(b.area), str(b.bhytNumber),
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
      lastName, firstName,
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

      const personName =
        name != null || lastName != null || firstName != null
          ? normalizePersonName({ name, lastName, firstName }, cur.name)
          : {
              name: cur.name,
              lastName: cur.last_name ?? "",
              firstName: cur.first_name ?? "",
            };
      if (!personName.name) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "name must be a non-empty string" });
      }
      const nextName = personName.name;
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

      const currentClassAccess = await assertClassWriteAccess(client, req, cur.class_id);
      if (currentClassAccess.error) {
        await client.query("ROLLBACK");
        return res.status(currentClassAccess.status).json({ error: currentClassAccess.error });
      }
      if (classIdsDiffer(cur.class_id, nextClassId)) {
        const nextClassAccess = await assertClassWriteAccess(client, req, nextClassId);
        if (nextClassAccess.error) {
          await client.query("ROLLBACK");
          return res.status(nextClassAccess.status).json({ error: nextClassAccess.error });
        }
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
           name=$1, last_name=$2, first_name=$3, grade=$4, email=$5, date_of_birth=$6, class_id=$7,
           avatar=$8, join_date=$9, status=$10, gender=$11,
           phone=$12, nationality=$13, religion=$14, province=$15, ward=$16, house_number=$17, street=$18, hamlet=$19,
           birth_place=$20, father_birth_year=$21, mother_birth_year=$22,
           father_name=$23, father_birth_date=$24, father_phone=$25, father_email=$26,
           father_login=$27, father_id_number=$28, father_occupation=$29,
           mother_name=$30, mother_birth_date=$31, mother_phone=$32, mother_email=$33,
           mother_login=$34, mother_id_number=$35, mother_occupation=$36,
           id_number=$37, id_issued_place=$38, id_issued_date=$39, area=$40, bhyt_number=$41,
           disability_type=$42, policy_beneficiary=$43, eye_disease=$44,
           guardian_name=$45, guardian_occupation=$46, guardian_birth_year=$47
         WHERE id = $48`,
        [
          nextName, personName.lastName, personName.firstName, nextGrade, nextEmail, nextDob, nextClassId,
          nextAvatar, nextJoin, nextStatus, nextGender,
          upd("phone"), upd("nationality"), upd("religion"),
          upd("province"), upd("ward"), updSnake("houseNumber", "house_number"), upd("street"), upd("hamlet"),
          updSnake("birthPlace", "birth_place"),
          updSnake("fatherBirthYear", "father_birth_year"),
          updSnake("motherBirthYear", "mother_birth_year"),
          updSnake("fatherName", "father_name"),
          b.fatherBirthDate !== undefined ? normalizeDateInput(b.fatherBirthDate) : cur.father_birth_date,
          updSnake("fatherPhone", "father_phone"),
          updSnake("fatherEmail", "father_email"),
          updSnake("fatherLogin", "father_login"),
          updSnake("fatherIdNumber", "father_id_number"),
          updSnake("fatherOccupation", "father_occupation"),
          updSnake("motherName", "mother_name"),
          b.motherBirthDate !== undefined ? normalizeDateInput(b.motherBirthDate) : cur.mother_birth_date,
          updSnake("motherPhone", "mother_phone"),
          updSnake("motherEmail", "mother_email"),
          updSnake("motherLogin", "mother_login"),
          updSnake("motherIdNumber", "mother_id_number"),
          updSnake("motherOccupation", "mother_occupation"),
          updSnake("idNumber", "id_number"),
          updSnake("idIssuedPlace", "id_issued_place"),
          b.idIssuedDate !== undefined ? normalizeDateInput(b.idIssuedDate) : cur.id_issued_date,
          upd("area"),
          updSnake("bhytNumber", "bhyt_number"),
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
    const access = await assertStudentAccess(pool, req, id);
    if (access.error) return res.status(access.status).json({ error: access.error });
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
