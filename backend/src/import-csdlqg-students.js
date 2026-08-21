import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { initDb, pool } from "./db.js";

const dryRun = process.argv.includes("--dry-run");

const FILE_CLASSES = [
  { file: "DanhSachHocSinh-nhatre.xlsx", className: "Nhà trẻ", level: "Nhà trẻ" },
  { file: "DanhSachHocSinh-mam1.xlsx", className: "Mầm 1", level: "Mầm" },
  { file: "DanhSachHocSinh-mam2.xlsx", className: "Mầm 2", level: "Mầm" },
  { file: "DanhSachHocSinh-choi1.xlsx", className: "Chồi 1", level: "Chồi" },
  { file: "DanhSachHocSinh-choi2.xlsx", className: "Chồi 2", level: "Chồi" },
  { file: "DanhSachHocSinh-La.xlsx", className: "Lá", level: "Lá" },
];

const LOCAL_WINDOWS_DIR = "C:\\Users\\Thanh\\Downloads\\drive-download-20260821T110507Z-1-001";
const FILE_LIST = FILE_CLASSES.map((item) => item.file).join(", ");

function cleanText(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulText(value) {
  const text = cleanText(value);
  if (!text) return "";
  if (/^x$/i.test(text)) return text;
  return text;
}

function parseIsoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const text = cleanText(value);
  if (!text) return null;

  const dotted = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dotted) {
    const [, day, month, year] = dotted;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  return null;
}

function parseYear(value) {
  const date = parseIsoDate(value);
  if (date) return date.slice(0, 4);
  const text = cleanText(value);
  const match = text.match(/(?:19|20)\d{2}/);
  return match ? match[0] : "";
}

function mapGender(nuMark, idNumber) {
  if (cleanText(nuMark).toUpperCase() === "X") return "female";
  const id = cleanText(idNumber);
  if (id.length >= 4) {
    const code = Number(id[3]);
    if ([1, 3, 5, 7, 9].includes(code)) return "female";
  }
  return "male";
}

function looksLikeWindowsPath(value) {
  return /^[A-Za-z]:[\\/]/.test(String(value || "").trim()) || String(value || "").includes("\\");
}

function resolveSourceDir() {
  const argDir = process.argv.find((arg, idx) => idx >= 2 && !arg.startsWith("--"));
  const configured = cleanText(process.env.STUDENTS_XLSX_DIR);
  const dir = cleanText(argDir || configured || (process.platform === "win32" ? LOCAL_WINDOWS_DIR : ""));
  if (!dir) {
    throw new Error(
      `Thiếu thư mục Excel. Copy 6 file (${FILE_LIST}) lên server rồi chạy: npm run db:import-csdlqg -- /đường/dẫn/thư-mục`
    );
  }
  if (process.platform !== "win32" && looksLikeWindowsPath(dir)) {
    throw new Error(
      `Đường dẫn Windows không dùng được trên server Linux. Copy 6 file Excel lên server, rồi truyền path Linux, ví dụ: npm run db:import-csdlqg -- /var/www/mamnonThanhVy/backend/csdlqg`
    );
  }
  return path.resolve(dir);
}

function pickStudentSheet(workbook) {
  if (workbook.SheetNames.includes("MauNhapLieu")) return workbook.Sheets.MauNhapLieu;
  return workbook.Sheets[workbook.SheetNames[0]];
}

function readStudentsFromWorkbook(workbookPath, className) {
  const workbook = XLSX.readFile(workbookPath, { cellDates: true, raw: false });
  const sheet = pickStudentSheet(workbook);
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  if (rows.length < 4) {
    throw new Error(`${path.basename(workbookPath)} does not have enough rows`);
  }

  return rows
    .slice(3)
    .map((row, idx) => {
      const stt = cleanText(row[1]);
      if (!stt || Number.isNaN(Number(stt))) return null;

      const lastName = cleanText(row[2]);
      const firstName = cleanText(row[3]);
      const name = [lastName, firstName].filter(Boolean).join(" ");
      if (!name) return null;

      const idNumber = meaningfulText(row[4]);
      const houseNumber = meaningfulText(row[15]);
      const street = meaningfulText(row[16]);
      const hamlet = meaningfulText(row[13]);
      const ward = meaningfulText(row[12]);
      const province = meaningfulText(row[11]);
      const motherPhone = meaningfulText(row[36]);
      const fatherPhone = meaningfulText(row[41]);
      const addressText = [houseNumber, street, hamlet, ward, province].filter(Boolean).join(", ");

      return {
        excelRow: idx + 4,
        sourceFile: path.basename(workbookPath),
        className,
        stt: Number(stt),
        name,
        lastName,
        firstName,
        idNumber,
        dateOfBirth: parseIsoDate(row[5]),
        birthPlace: meaningfulText(row[6]),
        gender: mapGender(row[7], idNumber),
        nationality: meaningfulText(row[8]) || "Kinh",
        area: meaningfulText(row[9]),
        note: meaningfulText(row[10]),
        province,
        ward,
        hamlet,
        houseNumber,
        street,
        householdAddress: addressText,
        motherName: meaningfulText(row[35]),
        motherPhone,
        motherBirthYear: parseYear(row[37]),
        motherEducation: meaningfulText(row[38]),
        motherOccupation: meaningfulText(row[39]),
        fatherName: meaningfulText(row[40]),
        fatherPhone,
        fatherBirthYear: parseYear(row[42]),
        fatherEducation: meaningfulText(row[43]),
        fatherOccupation: meaningfulText(row[44]),
        disabilityType: meaningfulText(row[47]),
        joinDate: parseIsoDate(row[48]),
      };
    })
    .filter(Boolean);
}

async function truncateStudentAndClassData(client) {
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
    "student_bulk_jobs",
    "students",
    "class_teachers",
    "classes",
  ];

  const existing = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])`,
    [candidateTables]
  );
  const tables = existing.rows.map((row) => `"${row.tablename}"`);
  if (!tables.length) return;
  await client.query(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
}

async function currentAcademicYearId(client) {
  const result = await client.query(
    `SELECT id FROM academic_years WHERE is_current = TRUE ORDER BY id LIMIT 1`
  );
  return result.rows[0]?.id ?? null;
}

async function recreateClasses(client, classDefs, academicYearId) {
  const byName = new Map();
  for (const def of classDefs) {
    const inserted = await client.query(
      `INSERT INTO classes (name, level, room, teacher_id, academic_year_id)
       VALUES ($1, $2, '', NULL, $3)
       RETURNING id`,
      [def.className, def.level, academicYearId]
    );
    byName.set(def.className, Number(inserted.rows[0].id));
  }
  return byName;
}

async function importFromCsdlqg() {
  const sourceDir = resolveSourceDir();
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  const students = [];
  for (const def of FILE_CLASSES) {
    const workbookPath = path.join(sourceDir, def.file);
    if (!fs.existsSync(workbookPath)) {
      throw new Error(`Missing workbook: ${workbookPath}`);
    }
    const rows = readStudentsFromWorkbook(workbookPath, def.className);
    console.log(`${def.className}: ${rows.length} học sinh (${def.file})`);
    students.push(...rows);
  }

  console.log(`Tổng: ${students.length} học sinh từ ${FILE_CLASSES.length} lớp`);

  if (dryRun) {
    console.log("Dry run only — no database changes.");
    return;
  }

  await initDb();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await truncateStudentAndClassData(client);

    const academicYearId = await currentAcademicYearId(client);
    const classIdsByName = await recreateClasses(client, FILE_CLASSES, academicYearId);

    for (const row of students) {
      const classId = classIdsByName.get(row.className) ?? null;
      const inserted = await client.query(
        `INSERT INTO students (
           name, last_name, first_name, grade, email, date_of_birth, class_id, academic_year_id,
           avatar, join_date, status, gender,
           phone, nationality, religion, province, ward, house_number, street, hamlet,
           birth_place, father_birth_year, mother_birth_year,
           father_name, father_birth_date, father_phone, father_email,
           father_login, father_id_number, father_education, father_occupation,
           mother_name, mother_birth_date, mother_phone, mother_email,
           mother_login, mother_id_number, mother_education, mother_occupation,
           id_number, id_issued_place, id_issued_date, area, bhyt_number,
           household_house_number, household_street, household_ward, household_province, household_address,
           disability_type, policy_beneficiary, eye_disease,
           guardian_name, guardian_occupation, guardian_birth_year
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,
           $9,$10,$11,$12,
           $13,$14,$15,$16,$17,$18,$19,$20,
           $21,$22,$23,
           $24,$25,$26,$27,
           $28,$29,$30,$31,
           $32,$33,$34,$35,
           $36,$37,$38,$39,
           $40,$41,$42,$43,$44,
           $45,$46,$47,$48,$49,
           $50,$51,$52,
           $53,$54,$55
         ) RETURNING id`,
        [
          row.name,
          row.lastName,
          row.firstName,
          row.note,
          "",
          row.dateOfBirth,
          classId,
          academicYearId,
          "",
          row.joinDate,
          "active",
          row.gender,
          row.idNumber,
          row.nationality,
          "",
          row.province,
          row.ward,
          row.houseNumber,
          row.street,
          row.hamlet,
          row.birthPlace,
          row.fatherBirthYear,
          row.motherBirthYear,
          row.fatherName,
          null,
          row.fatherPhone,
          "",
          row.fatherPhone,
          "",
          row.fatherEducation,
          row.fatherOccupation,
          row.motherName,
          null,
          row.motherPhone,
          "",
          row.motherPhone,
          "",
          row.motherEducation,
          row.motherOccupation,
          row.idNumber,
          "",
          null,
          row.area,
          "",
          row.houseNumber,
          row.street,
          row.ward,
          row.province,
          row.householdAddress,
          row.disabilityType,
          "",
          "",
          "",
          "",
          "",
        ]
      );

      await client.query(
        `INSERT INTO student_class_history (
           student_id, from_class_id, to_class_id, from_academic_year_id, to_academic_year_id,
           effective_date, note, action, from_status, to_status
         )
         VALUES ($1, NULL, $2, NULL, $3, COALESCE($4::date, CURRENT_DATE), $5, 'transfer', NULL, 'active')`,
        [
          Number(inserted.rows[0].id),
          classId,
          academicYearId,
          row.joinDate,
          `Import ${row.sourceFile} row ${row.excelRow}`,
        ]
      );
    }

    await client.query("COMMIT");
    console.log(`Đã xóa dữ liệu cũ và import ${students.length} học sinh.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

try {
  await importFromCsdlqg();
} catch (error) {
  console.error("CSDLQG student import failed:", error);
  process.exit(1);
}
