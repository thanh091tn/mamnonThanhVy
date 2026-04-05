import pg from "pg";
import { parseIntoClientConfig } from "pg-connection-string";

const { Pool } = pg;

/** Ensures user:password form so node-pg never sees an undefined password (SCRAM error). */
function normalizeDatabaseUrl(url) {
  if (!url || typeof url !== "string") return url;
  return url.replace(/^(\w+:\/\/)([^@/?#]+)@/, (full, proto, userinfo) => {
    if (userinfo.includes(":")) return full;
    return `${proto}${userinfo}:@`;
  });
}

function poolConfig() {
  if (process.env.DATABASE_URL) {
    const url = normalizeDatabaseUrl(process.env.DATABASE_URL);
    const cfg = parseIntoClientConfig(url);
    const pwd = cfg.password != null ? String(cfg.password).trim() : "";
    if (!pwd) {
      throw new Error(
        "DATABASE_URL must include a non-empty password (PostgreSQL SCRAM). Example: postgresql://postgres:YOUR_PASSWORD@localhost:5432/school"
      );
    }
    cfg.password = pwd;
    return cfg;
  }
  const pwd = String(process.env.PGPASSWORD ?? "").trim();
  if (!pwd) {
    throw new Error(
      "Set PGPASSWORD in backend/.env or use DATABASE_URL with a non-empty password. SCRAM auth does not accept an empty password."
    );
  }
  return {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password: pwd,
    database: process.env.PGDATABASE || "school",
  };
}

let _pool;
function getPool() {
  if (!_pool) {
    _pool = new Pool(poolConfig());
  }
  return _pool;
}

/** Lazy pool so missing password fails at connect with a clear message, not a cryptic SASL error. */
export const pool = new Proxy(
  {},
  {
    get(_target, prop) {
      const p = getPool();
      const value = p[prop];
      return typeof value === "function" ? value.bind(p) : value;
    },
  }
);

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        grade VARCHAR(200) DEFAULT '',
        email VARCHAR(500) DEFAULT '',
        date_of_birth DATE
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS teachers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        subject VARCHAR(200) DEFAULT '',
        email VARCHAR(500) DEFAULT '',
        phone VARCHAR(100) DEFAULT ''
      );
    `);
    await client.query(`
      ALTER TABLE teachers ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
    `);
    await client.query(`
      ALTER TABLE teachers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
    `);
    await client.query(`
      ALTER TABLE teachers ADD COLUMN IF NOT EXISTS gender VARCHAR(20) DEFAULT 'male';
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        level VARCHAR(200) DEFAULT '',
        room VARCHAR(200) DEFAULT '',
        teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL
      );
    `);
    await client.query(`
      ALTER TABLE students
      ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL;
    `);
    await client.query(`
      ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar VARCHAR(2000) DEFAULT '';
    `);
    await client.query(`
      ALTER TABLE students ALTER COLUMN avatar TYPE TEXT;
    `);
    await client.query(`
      ALTER TABLE students ADD COLUMN IF NOT EXISTS join_date DATE;
    `);
    await client.query(`
      ALTER TABLE students ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
    `);
    await client.query(`
      ALTER TABLE students ADD COLUMN IF NOT EXISTS gender VARCHAR(20) DEFAULT 'male';
    `);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS phone VARCHAR(100) DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS religion TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS province TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS ward TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS hamlet TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS birth_place TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS father_birth_year VARCHAR(10) DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_birth_year VARCHAR(10) DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS id_number VARCHAR(50) DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS id_issued_place TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS id_issued_date DATE;`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS area TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS disability_type TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS policy_beneficiary TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS eye_disease TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_name TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_occupation TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_birth_year VARCHAR(10) DEFAULT '';`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_class_history (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        from_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
        to_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
        effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
        note TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_student_class_history_student
      ON student_class_history(student_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_attendance (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
        attendance_date DATE NOT NULL,
        session VARCHAR(20) NOT NULL DEFAULT 'full',
        status VARCHAR(20) NOT NULL DEFAULT 'present',
        note TEXT DEFAULT '',
        recorded_by_teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (student_id, attendance_date, session)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_student_att_class_date
      ON student_attendance(class_id, attendance_date);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_student_att_student_date
      ON student_attendance(student_id, attendance_date);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS teacher_attendance (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        attendance_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'present',
        note TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (teacher_id, attendance_date)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_teacher_att_date
      ON teacher_attendance(attendance_date);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(500) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('manager', 'teacher')),
        name VARCHAR(500) DEFAULT '',
        teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_teacher_id_unique
      ON users (teacher_id) WHERE teacher_id IS NOT NULL;
    `);
  } finally {
    client.release();
  }
}

function dateToApi(d) {
  if (!d) return "";
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return String(d).slice(0, 10);
}

export function mapStudentRow(row) {
  return {
    id: row.id,
    name: row.name,
    grade: row.grade ?? "",
    email: row.email ?? "",
    dateOfBirth: dateToApi(row.date_of_birth),
    classId: row.class_id != null ? row.class_id : null,
    className: row.class_name ?? "",
    avatar: row.avatar ?? "",
    joinDate: dateToApi(row.join_date),
    status: row.status ?? "active",
    gender: row.gender === "female" ? "female" : "male",
    phone: row.phone ?? "",
    nationality: row.nationality ?? "",
    religion: row.religion ?? "",
    province: row.province ?? "",
    ward: row.ward ?? "",
    hamlet: row.hamlet ?? "",
    birthPlace: row.birth_place ?? "",
    fatherBirthYear: row.father_birth_year ?? "",
    motherBirthYear: row.mother_birth_year ?? "",
    idNumber: row.id_number ?? "",
    idIssuedPlace: row.id_issued_place ?? "",
    idIssuedDate: dateToApi(row.id_issued_date),
    area: row.area ?? "",
    disabilityType: row.disability_type ?? "",
    policyBeneficiary: row.policy_beneficiary ?? "",
    eyeDisease: row.eye_disease ?? "",
    guardianName: row.guardian_name ?? "",
    guardianOccupation: row.guardian_occupation ?? "",
    guardianBirthYear: row.guardian_birth_year ?? "",
  };
}

export function mapClassRow(row) {
  return {
    id: row.id,
    name: row.name,
    level: row.level ?? "",
    room: row.room ?? "",
    teacherId: row.teacher_id != null ? row.teacher_id : null,
    teacherName: row.teacher_name ?? "",
  };
}

export function mapTeacherRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    status: row.status ?? "active",
    gender: row.gender === "female" ? "female" : "male",
  };
}

export function mapStudentClassHistoryRow(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    fromClassId: row.from_class_id != null ? row.from_class_id : null,
    toClassId: row.to_class_id != null ? row.to_class_id : null,
    fromClassName: row.from_class_name ?? "",
    toClassName: row.to_class_name ?? "",
    effectiveDate: dateToApi(row.effective_date),
    note: row.note ?? "",
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at || ""),
  };
}

export function normalizeDateInput(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Returns "male" | "female", or { error } if invalid. */
export function normalizeStudentGender(v) {
  if (v == null || v === "") return "male";
  const s = String(v).trim().toLowerCase();
  if (s === "female" || s === "f") return "female";
  if (s === "male" || s === "m") return "male";
  return { error: "gender must be male or female" };
}

export function mapStudentAttendanceRow(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name ?? "",
    classId: row.class_id != null ? row.class_id : null,
    attendanceDate: dateToApi(row.attendance_date),
    session: row.session ?? "full",
    status: row.status ?? "present",
    note: row.note ?? "",
    recordedByTeacherId:
      row.recorded_by_teacher_id != null ? row.recorded_by_teacher_id : null,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at || ""),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at || ""),
  };
}

export function mapTeacherAttendanceRow(row) {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name ?? "",
    attendanceDate: dateToApi(row.attendance_date),
    status: row.status ?? "present",
    note: row.note ?? "",
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at || ""),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at || ""),
  };
}

const TEACHER_STATUSES = new Set(["active", "inactive", "leave"]);

export function normalizeTeacherStatus(v) {
  if (v == null || v === "") return "active";
  const s = String(v).trim().toLowerCase();
  if (!TEACHER_STATUSES.has(s)) {
    return { error: "status must be one of: active, inactive, leave" };
  }
  return s;
}

export function normalizeTeacherGender(v) {
  if (v == null || v === "") return "male";
  const s = String(v).trim().toLowerCase();
  if (s === "female" || s === "f") return "female";
  if (s === "male" || s === "m") return "male";
  return { error: "gender must be male or female" };
}

const STUDENT_STATUSES = new Set(["active", "inactive", "graduated", "leave"]);

/** Returns normalized status string, or { error } if invalid. */
export function normalizeStudentStatus(v) {
  if (v == null || v === "") return "active";
  const s = String(v).trim().toLowerCase();
  if (!STUDENT_STATUSES.has(s)) {
    return {
      error: "status must be one of: active, inactive, graduated, leave",
    };
  }
  return s;
}
