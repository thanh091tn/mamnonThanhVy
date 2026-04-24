import "dotenv/config";
import path from "node:path";
import XLSX from "xlsx";
import { initDb, normalizeDateInput, pool } from "./db.js";

const dryRun = process.argv.includes("--dry-run");

function cleanText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulText(value) {
  const text = cleanText(value);
  if (!text || text === "So , duong") return "";
  if (!text || text === "Số , đường") return "";
  return text;
}

function parseDate(value) {
  const text = cleanText(value);
  if (!text) return null;

  const ddmmyyyy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return normalizeDateInput(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
  }

  return normalizeDateInput(text);
}

function splitFullName(value) {
  const full = cleanText(value);
  if (!full) return { lastName: "", firstName: "" };
  const parts = full.split(" ");
  if (parts.length === 1) return { lastName: "", firstName: parts[0] };
  return {
    lastName: parts.slice(0, -1).join(" "),
    firstName: parts[parts.length - 1],
  };
}

function mapGender(value) {
  const text = cleanText(value).toLowerCase();
  if (text === "nu" || text === "nữ") return "female";
  if (text === "nam") return "male";
  return "male";
}

function mapStatus(value) {
  const text = cleanText(value).toLowerCase();
  if (text === "dang hoc" || text === "đang học") return "active";
  if (text === "nghi hoc" || text === "nghỉ học") return "inactive";
  return "active";
}

function inferClassLevel(className) {
  const text = cleanText(className).toLowerCase();
  if (text.startsWith("mam") || text.startsWith("mầm")) return "Mầm";
  if (text.startsWith("choi") || text.startsWith("chồi")) return "Chồi";
  if (text.startsWith("la") || text.startsWith("lá")) return "Lá";
  return "";
}

function resolveWorkbookPath() {
  const configuredPath = cleanText(process.env.STUDENTS_XLSX_PATH);
  if (!configuredPath) {
    throw new Error("Missing STUDENTS_XLSX_PATH environment variable");
  }
  return path.resolve(configuredPath);
}

function readWorkbookRows(workbookPath) {
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Workbook does not contain any sheet");

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" });
  if (rows.length < 3) throw new Error("Workbook does not have enough rows to import");

  return rows
    .slice(2)
    .map((row, idx) => {
      const className = meaningfulText(row[1]) || "Chưa phân lớp";
      const name = cleanText(row[3]);
      const alias = meaningfulText(row[4]);
      const motherPhone = meaningfulText(row[20]);
      const fatherPhone = meaningfulText(row[27]);
      const split = splitFullName(name);

      return {
        excelRow: idx + 3,
        className,
        name,
        lastName: split.lastName,
        firstName: split.firstName,
        grade: alias ? `Biệt danh: ${alias}` : "",
        dateOfBirth: parseDate(row[7]),
        joinDate: parseDate(row[11]),
        status: mapStatus(row[6]),
        gender: mapGender(row[5]),
        phone: motherPhone || fatherPhone || "",
        nationality: meaningfulText(row[8]),
        province: meaningfulText(row[13]),
        ward: meaningfulText(row[14]),
        houseNumber: meaningfulText(row[12]),
        street: meaningfulText(row[15]),
        hamlet: meaningfulText(row[16]),
        idNumber: meaningfulText(row[17]),
        bhytNumber: meaningfulText(row[9]),
        idIssuedPlace: meaningfulText(row[10]),
        motherName: meaningfulText(row[18]),
        motherBirthDate: parseDate(row[19]),
        motherPhone,
        motherEmail: meaningfulText(row[21]),
        motherLogin: meaningfulText(row[22]),
        motherIdNumber: meaningfulText(row[23]),
        motherOccupation: meaningfulText(row[24]),
        fatherName: meaningfulText(row[25]),
        fatherBirthDate: parseDate(row[26]),
        fatherPhone,
        fatherEmail: meaningfulText(row[28]),
        fatherLogin: meaningfulText(row[29]),
        fatherIdNumber: meaningfulText(row[30]),
        fatherOccupation: meaningfulText(row[31]),
      };
    })
    .filter((row) => row.name);
}

async function ensureClasses(client, classNames) {
  const existing = await client.query(`SELECT id, name FROM classes`);
  const byName = new Map(existing.rows.map((row) => [cleanText(row.name), Number(row.id)]));

  for (const className of classNames) {
    if (byName.has(className)) continue;
    const inserted = await client.query(
      `INSERT INTO classes (name, level, room, teacher_id) VALUES ($1, $2, '', NULL) RETURNING id`,
      [className, inferClassLevel(className)]
    );
    byName.set(className, Number(inserted.rows[0].id));
  }

  return byName;
}

async function truncateStudentData(client) {
  const candidateTables = [
    "discount_policy_students",
    "fee_adjustments",
    "fee_payments",
    "student_attendance",
    "student_class_history",
    "student_fee_period_discounts",
    "student_fee_period_items",
    "student_fee_periods",
    "student_service_subscriptions",
    "student_service_usage_entries",
    "students",
  ];

  const existing = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])`,
    [candidateTables]
  );

  const tables = existing.rows.map((row) => `"${row.tablename}"`);
  if (!tables.length) return;

  await client.query(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
}

async function importStudents() {
  const workbookPath = resolveWorkbookPath();
  const rows = readWorkbookRows(workbookPath);

  console.log(`Using workbook: ${workbookPath}`);
  console.log(`Parsed ${rows.length} student rows from Excel`);

  if (dryRun) {
    const counts = new Map();
    for (const row of rows) {
      counts.set(row.className, (counts.get(row.className) || 0) + 1);
    }
    for (const [className, count] of [...counts.entries()].sort()) {
      console.log(`${className}: ${count}`);
    }
    return;
  }

  await initDb();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await truncateStudentData(client);

    const classIdsByName = await ensureClasses(
      client,
      [...new Set(rows.map((row) => row.className).filter(Boolean))]
    );

    for (const row of rows) {
      const classId = classIdsByName.get(row.className) ?? null;
      const inserted = await client.query(
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
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
           $12,$13,$14,$15,$16,$17,$18,$19,
           $20,$21,$22,
           $23,$24,$25,$26,
           $27,$28,$29,
           $30,$31,$32,$33,
           $34,$35,$36,
           $37,$38,$39,$40,$41,
           $42,$43,$44,
           $45,$46,$47
         ) RETURNING id`,
        [
          row.name, row.lastName, row.firstName, row.grade, "", row.dateOfBirth, classId, "", row.joinDate, row.status, row.gender,
          row.phone, row.nationality, "", row.province, row.ward, row.houseNumber, row.street, row.hamlet,
          "", "", "",
          row.fatherName, row.fatherBirthDate, row.fatherPhone, row.fatherEmail,
          row.fatherLogin, row.fatherIdNumber, row.fatherOccupation,
          row.motherName, row.motherBirthDate, row.motherPhone, row.motherEmail,
          row.motherLogin, row.motherIdNumber, row.motherOccupation,
          row.idNumber, row.idIssuedPlace, null, "", row.bhytNumber,
          "", "", "",
          "", "", "",
        ]
      );

      await client.query(
        `INSERT INTO student_class_history (student_id, from_class_id, to_class_id, effective_date, note)
         VALUES ($1, NULL, $2, COALESCE($3::date, CURRENT_DATE), $4)`,
        [Number(inserted.rows[0].id), classId, row.joinDate, `Import Excel row ${row.excelRow}`]
      );
    }

    await client.query("COMMIT");
    console.log(`Imported ${rows.length} students successfully`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

try {
  await importStudents();
} catch (error) {
  console.error("Student Excel import failed:", error);
  process.exit(1);
}
