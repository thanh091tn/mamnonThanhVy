import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";
import { parseIntoClientConfig } from "pg-connection-string";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

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
      CREATE TABLE IF NOT EXISTS teacher_roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
      ALTER TABLE teachers ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES teacher_roles(id) ON DELETE SET NULL;
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
      INSERT INTO teacher_roles (name)
      SELECT DISTINCT TRIM(subject)
      FROM teachers
      WHERE subject IS NOT NULL AND TRIM(subject) <> ''
      ON CONFLICT (name) DO NOTHING;
    `);
    await client.query(`
      UPDATE teachers t
      SET role_id = tr.id
      FROM teacher_roles tr
      WHERE t.role_id IS NULL
        AND TRIM(COALESCE(t.subject, '')) = tr.name;
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
      CREATE TABLE IF NOT EXISTS class_teachers (
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (class_id, teacher_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher
      ON class_teachers(teacher_id, class_id);
    `);
    await client.query(`
      INSERT INTO class_teachers (class_id, teacher_id)
      SELECT id, teacher_id
      FROM classes
      WHERE teacher_id IS NOT NULL
      ON CONFLICT DO NOTHING;
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
      ALTER TABLE students ADD COLUMN IF NOT EXISTS leave_date DATE;
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
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS father_name TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS father_birth_date DATE;`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS father_phone VARCHAR(100) DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS father_email TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS father_login TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS father_id_number VARCHAR(50) DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS father_occupation TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_name TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_birth_date DATE;`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_phone VARCHAR(100) DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_email TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_login TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_id_number VARCHAR(50) DEFAULT '';`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_occupation TEXT DEFAULT '';`);
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
        leave_type VARCHAR(20) NOT NULL DEFAULT 'full_day',
        leave_session VARCHAR(20),
        note TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (teacher_id, attendance_date)
      );
    `);
    await client.query(`
      ALTER TABLE teacher_attendance
      ADD COLUMN IF NOT EXISTS leave_type VARCHAR(20) NOT NULL DEFAULT 'full_day';
    `);
    await client.query(`
      ALTER TABLE teacher_attendance
      ADD COLUMN IF NOT EXISTS leave_session VARCHAR(20);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_teacher_att_date
      ON teacher_attendance(attendance_date);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(500) UNIQUE,
        phone VARCHAR(100) DEFAULT '',
        password_hash TEXT NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher', 'accountant')),
        name VARCHAR(500) DEFAULT '',
        teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(100) DEFAULT '';`);
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;`);
    await client.query(`UPDATE users SET role = 'admin' WHERE role = 'manager';`);
    await client.query(`
      UPDATE users u
      SET role = 'admin'
      FROM teachers t
      JOIN teacher_roles tr ON tr.id = t.role_id
      WHERE u.teacher_id = t.id
        AND LOWER(TRIM(tr.name)) = LOWER('Quản trị hệ thống');
    `);
    await client.query(`
      ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('admin', 'teacher', 'accountant'));
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_teacher_id_unique
      ON users (teacher_id) WHERE teacher_id IS NOT NULL;
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique
      ON users (phone) WHERE phone IS NOT NULL AND phone <> '';
    `);
    await client.query(`
      UPDATE users u
      SET phone = t.phone
      FROM teachers t
      WHERE u.teacher_id = t.id
        AND u.role = 'teacher'
        AND COALESCE(u.phone, '') = ''
        AND COALESCE(t.phone, '') <> '';
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fee_periods (
        id SERIAL PRIMARY KEY,
        month_key VARCHAR(7) NOT NULL UNIQUE,
        title VARCHAR(500) NOT NULL,
        due_date DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'published', 'closed')),
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS fee_item_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(500) NOT NULL UNIQUE,
        default_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        is_optional BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS charge_timing VARCHAR(20) NOT NULL DEFAULT 'advance';
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS quantity_mode VARCHAR(30) NOT NULL DEFAULT 'fixed';
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS unit_name VARCHAR(100) NOT NULL DEFAULT 'Ngay';
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS fixed_quantity NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS formula_type VARCHAR(40) NOT NULL DEFAULT 'fixed_x_price_x_frequency';
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS frequency_multiplier NUMERIC(12,2) NOT NULL DEFAULT 1;
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS charge_weekdays VARCHAR(50) NOT NULL DEFAULT '1,2,3,4,5,6';
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS code VARCHAR(100);
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS category VARCHAR(30) NOT NULL DEFAULT 'fixed';
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS calc_type VARCHAR(40) NOT NULL DEFAULT 'monthly_fixed';
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(30) NOT NULL DEFAULT 'monthly';
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS effective_start_month VARCHAR(7) DEFAULT '';
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS effective_end_month VARCHAR(7) DEFAULT '';
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS scope_type VARCHAR(20) NOT NULL DEFAULT 'all';
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS apply_levels TEXT NOT NULL DEFAULT '';
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS apply_class_ids TEXT NOT NULL DEFAULT '';
    `);
    await client.query(`
      ALTER TABLE fee_item_templates
      ADD COLUMN IF NOT EXISTS proration_mode VARCHAR(30) NOT NULL DEFAULT 'full_month';
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_item_templates_code_unique
      ON fee_item_templates(code)
      WHERE code IS NOT NULL AND code <> '';
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fee_item_templates_active
      ON fee_item_templates(active, sort_order, id);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS fee_period_items (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES fee_periods(id) ON DELETE CASCADE,
        name VARCHAR(500) NOT NULL,
        amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        is_optional BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fee_period_items_period
      ON fee_period_items(period_id, sort_order, id);
    `);
    await client.query(`
      ALTER TABLE fee_period_items
      ADD COLUMN IF NOT EXISTS charge_timing VARCHAR(20) NOT NULL DEFAULT 'advance';
    `);
    await client.query(`
      ALTER TABLE fee_period_items
      ADD COLUMN IF NOT EXISTS quantity_mode VARCHAR(30) NOT NULL DEFAULT 'fixed';
    `);
    await client.query(`
      ALTER TABLE fee_period_items
      ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);
    await client.query(`
      ALTER TABLE fee_period_items
      ADD COLUMN IF NOT EXISTS unit_name VARCHAR(100) NOT NULL DEFAULT 'Ngay';
    `);
    await client.query(`
      ALTER TABLE fee_period_items
      ADD COLUMN IF NOT EXISTS fixed_quantity NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);
    await client.query(`
      ALTER TABLE fee_period_items
      ADD COLUMN IF NOT EXISTS formula_type VARCHAR(40) NOT NULL DEFAULT 'fixed_x_price_x_frequency';
    `);
    await client.query(`
      ALTER TABLE fee_period_items
      ADD COLUMN IF NOT EXISTS frequency_multiplier NUMERIC(12,2) NOT NULL DEFAULT 1;
    `);
    await client.query(`
      ALTER TABLE fee_period_items
      ADD COLUMN IF NOT EXISTS charge_weekdays VARCHAR(50) NOT NULL DEFAULT '1,2,3,4,5,6';
    `);
    await client.query(`
      ALTER TABLE fee_period_items
      ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES fee_item_templates(id) ON DELETE SET NULL;
    `);
    await client.query(`
      ALTER TABLE fee_period_items
      ADD COLUMN IF NOT EXISTS code VARCHAR(100) NOT NULL DEFAULT '';
    `);
    await client.query(`
      ALTER TABLE fee_period_items
      ADD COLUMN IF NOT EXISTS category VARCHAR(30) NOT NULL DEFAULT 'fixed';
    `);
    await client.query(`
      ALTER TABLE fee_period_items
      ADD COLUMN IF NOT EXISTS calc_type VARCHAR(40) NOT NULL DEFAULT 'monthly_fixed';
    `);
    await client.query(`
      ALTER TABLE fee_period_items
      ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(30) NOT NULL DEFAULT 'monthly';
    `);
    await client.query(`
      ALTER TABLE fee_period_items
      ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
    `);
    await client.query(`
      ALTER TABLE fee_period_items
      ADD COLUMN IF NOT EXISTS scope_type VARCHAR(20) NOT NULL DEFAULT 'all';
    `);
    await client.query(`
      ALTER TABLE fee_period_items
      ADD COLUMN IF NOT EXISTS apply_levels TEXT NOT NULL DEFAULT '';
    `);
    await client.query(`
      ALTER TABLE fee_period_items
      ADD COLUMN IF NOT EXISTS apply_class_ids TEXT NOT NULL DEFAULT '';
    `);
    await client.query(`
      ALTER TABLE fee_period_items
      ADD COLUMN IF NOT EXISTS proration_mode VARCHAR(30) NOT NULL DEFAULT 'full_month';
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS discount_policies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        discount_type VARCHAR(20) NOT NULL
          CHECK (discount_type IN ('amount', 'percent')),
        discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
        start_month VARCHAR(7) NOT NULL,
        end_month VARCHAR(7),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        note TEXT DEFAULT '',
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      ALTER TABLE discount_policies
      ADD COLUMN IF NOT EXISTS apply_scope VARCHAR(30) NOT NULL DEFAULT 'invoice';
    `);
    await client.query(`
      ALTER TABLE discount_policies
      ADD COLUMN IF NOT EXISTS target_category VARCHAR(30) DEFAULT '';
    `);
    await client.query(`
      ALTER TABLE discount_policies
      ADD COLUMN IF NOT EXISTS target_fee_item_code VARCHAR(100) DEFAULT '';
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS discount_policy_students (
        id SERIAL PRIMARY KEY,
        policy_id INTEGER NOT NULL REFERENCES discount_policies(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (policy_id, student_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_discount_policy_students_student
      ON discount_policy_students(student_id, policy_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_fee_periods (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        period_id INTEGER NOT NULL REFERENCES fee_periods(id) ON DELETE CASCADE,
        base_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        previous_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
        adjustment_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        final_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
          CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (student_id, period_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_student_fee_periods_period_status
      ON student_fee_periods(period_id, payment_status, student_id);
    `);
    await client.query(`
      ALTER TABLE student_fee_periods
      ADD COLUMN IF NOT EXISTS previous_balance NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);
    await client.query(`
      ALTER TABLE student_fee_periods
      ADD COLUMN IF NOT EXISTS adjustment_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_fee_period_items (
        id SERIAL PRIMARY KEY,
        student_fee_period_id INTEGER NOT NULL REFERENCES student_fee_periods(id) ON DELETE CASCADE,
        fee_period_item_id INTEGER REFERENCES fee_period_items(id) ON DELETE SET NULL,
        item_name VARCHAR(500) NOT NULL,
        item_code VARCHAR(100) NOT NULL DEFAULT '',
        line_type VARCHAR(30) NOT NULL DEFAULT 'charge',
        category VARCHAR(30) NOT NULL DEFAULT 'fixed',
        calc_type VARCHAR(40) NOT NULL DEFAULT 'monthly_fixed',
        quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
        unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
        base_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        final_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        formula_text TEXT DEFAULT '',
        note TEXT DEFAULT '',
        source_type VARCHAR(40) NOT NULL DEFAULT 'SystemRule',
        source_reference TEXT DEFAULT '',
        is_optional BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_student_fee_period_items_period
      ON student_fee_period_items(student_fee_period_id, sort_order, id);
    `);
    await client.query(`
      ALTER TABLE student_fee_period_items
      ADD COLUMN IF NOT EXISTS item_code VARCHAR(100) NOT NULL DEFAULT '';
    `);
    await client.query(`
      ALTER TABLE student_fee_period_items
      ADD COLUMN IF NOT EXISTS line_type VARCHAR(30) NOT NULL DEFAULT 'charge';
    `);
    await client.query(`
      ALTER TABLE student_fee_period_items
      ADD COLUMN IF NOT EXISTS category VARCHAR(30) NOT NULL DEFAULT 'fixed';
    `);
    await client.query(`
      ALTER TABLE student_fee_period_items
      ADD COLUMN IF NOT EXISTS calc_type VARCHAR(40) NOT NULL DEFAULT 'monthly_fixed';
    `);
    await client.query(`
      ALTER TABLE student_fee_period_items
      ADD COLUMN IF NOT EXISTS quantity NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);
    await client.query(`
      ALTER TABLE student_fee_period_items
      ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);
    await client.query(`
      ALTER TABLE student_fee_period_items
      ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);
    await client.query(`
      ALTER TABLE student_fee_period_items
      ADD COLUMN IF NOT EXISTS final_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);
    await client.query(`
      ALTER TABLE student_fee_period_items
      ADD COLUMN IF NOT EXISTS formula_text TEXT DEFAULT '';
    `);
    await client.query(`
      ALTER TABLE student_fee_period_items
      ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '';
    `);
    await client.query(`
      ALTER TABLE student_fee_period_items
      ADD COLUMN IF NOT EXISTS source_type VARCHAR(40) NOT NULL DEFAULT 'SystemRule';
    `);
    await client.query(`
      ALTER TABLE student_fee_period_items
      ADD COLUMN IF NOT EXISTS source_reference TEXT DEFAULT '';
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_fee_period_discounts (
        id SERIAL PRIMARY KEY,
        student_fee_period_id INTEGER NOT NULL REFERENCES student_fee_periods(id) ON DELETE CASCADE,
        policy_id INTEGER REFERENCES discount_policies(id) ON DELETE SET NULL,
        policy_name VARCHAR(500) NOT NULL,
        discount_type VARCHAR(20) NOT NULL
          CHECK (discount_type IN ('amount', 'percent')),
        discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
        discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_student_fee_period_discounts_period
      ON student_fee_period_discounts(student_fee_period_id, id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fee_payments (
        id SERIAL PRIMARY KEY,
        student_fee_period_id INTEGER NOT NULL REFERENCES student_fee_periods(id) ON DELETE CASCADE,
        amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        method VARCHAR(50) NOT NULL DEFAULT 'cash',
        invoice_number VARCHAR(100) NOT NULL DEFAULT '',
        note TEXT DEFAULT '',
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fee_payments_student_fee_period
      ON fee_payments(student_fee_period_id, paid_at DESC, id DESC);
    `);
    await client.query(`
      ALTER TABLE fee_payments
      ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100) NOT NULL DEFAULT '';
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_service_subscriptions (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        fee_item_template_id INTEGER NOT NULL REFERENCES fee_item_templates(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        quantity_override NUMERIC(12,2),
        unit_price_override NUMERIC(12,2),
        note TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_student_service_subscriptions_lookup
      ON student_service_subscriptions(student_id, fee_item_template_id, start_date, end_date);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_service_usage_entries (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER NOT NULL REFERENCES student_service_subscriptions(id) ON DELETE CASCADE,
        month_key VARCHAR(7) NOT NULL,
        quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
        note TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (subscription_id, month_key)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fee_adjustments (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        period_id INTEGER NOT NULL REFERENCES fee_periods(id) ON DELETE CASCADE,
        fee_item_template_id INTEGER REFERENCES fee_item_templates(id) ON DELETE SET NULL,
        line_name VARCHAR(500) NOT NULL,
        adjustment_type VARCHAR(30) NOT NULL DEFAULT 'charge',
        quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
        unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
        amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        note TEXT DEFAULT '',
        source_type VARCHAR(40) NOT NULL DEFAULT 'Adjustment',
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fee_adjustments_period_student
      ON fee_adjustments(period_id, student_id, id);
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
    fatherName: row.father_name ?? "",
    fatherBirthDate: dateToApi(row.father_birth_date),
    fatherPhone: row.father_phone ?? "",
    fatherEmail: row.father_email ?? "",
    fatherLogin: row.father_login ?? "",
    fatherIdNumber: row.father_id_number ?? "",
    fatherOccupation: row.father_occupation ?? "",
    motherName: row.mother_name ?? "",
    motherBirthDate: dateToApi(row.mother_birth_date),
    motherPhone: row.mother_phone ?? "",
    motherEmail: row.mother_email ?? "",
    motherLogin: row.mother_login ?? "",
    motherIdNumber: row.mother_id_number ?? "",
    motherOccupation: row.mother_occupation ?? "",
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
  const teacherIds = Array.isArray(row.teacher_ids)
    ? row.teacher_ids.filter((v) => v != null).map(Number)
    : row.teacher_id != null
      ? [Number(row.teacher_id)]
      : [];
  const teacherNames = Array.isArray(row.teacher_names)
    ? row.teacher_names.filter(Boolean)
    : row.teacher_name
      ? [row.teacher_name]
      : [];
  return {
    id: row.id,
    name: row.name,
    level: row.level ?? "",
    room: row.room ?? "",
    teacherId: teacherIds.length ? teacherIds[0] : null,
    teacherName: teacherNames.join(", "),
    teacherIds,
    teacherNames,
  };
}

export function mapTeacherRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    roleId: row.role_id != null ? Number(row.role_id) : null,
    subject: row.subject ?? "",
    address: row.address ?? "",
    status: row.status ?? "active",
    gender: row.gender === "female" ? "female" : "male",
    hasAccount: row.user_id != null || row.has_account === true,
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
    leaveType: row.leave_type ?? "full_day",
    leaveSession: row.leave_session ?? "",
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
