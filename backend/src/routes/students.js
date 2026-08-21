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

const exportHeaderLabels = [
  "STT",
  "L\u1edbp",
  "M\u00e3 h\u1ecdc sinh",
  "H\u1ecd v\u00e0 t\u00ean",
  "Gi\u1edbi t\u00ednh",
  "Tr\u1ea1ng th\u00e1i",
  "Ng\u00e0y sinh",
  "D\u00e2n t\u1ed9c",
  "M\u00e3 s\u1ed1 th\u1ebb BHYT",
  "Ng\u00e0y nh\u1eadp h\u1ecdc",
  "\u0110\u1ecba ch\u1ec9 chi ti\u1ebft",
  "T\u1ec9nh/Th\u00e0nh ph\u1ed1(Theo \u0111\u1ecba ch\u1ec9 th\u01b0\u1eddng tr\u00fa)",
  "X\u00e3/Ph\u01b0\u1eddng(Theo \u0111\u1ecba ch\u1ec9 th\u01b0\u1eddng tr\u00fa)",
  "\u0110\u01b0\u1eddng/Th\u00f4n/X\u00f3m (Theo \u0111\u1ecba ch\u1ec9 th\u01b0\u1eddng tr\u00fa)",
  "\u0110\u1ecba ch\u1ec9 hi\u1ec7n t\u1ea1i",
  "S\u1ed1 \u0111\u1ecbnh danh c\u00e1 nh\u00e2n",
  "H\u1ecd v\u00e0 t\u00ean m\u1eb9",
  "Ng\u00e0y sinh m\u1eb9",
  "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i m\u1eb9",
  "Email m\u1eb9",
  "CCCD m\u1eb9",
  "Ngh\u1ec1 nghi\u1ec7p m\u1eb9",
  "H\u1ecd v\u00e0 t\u00ean b\u1ed1",
  "Ng\u00e0y sinh b\u1ed1",
  "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i b\u1ed1",
  "Email b\u1ed1",
  "CCCD b\u1ed1",
  "Ngh\u1ec1 nghi\u1ec7p b\u1ed1",
];

function cleanExportText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatExportDate(value) {
  const text = cleanExportText(value);
  if (!text) return "";
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${value.getFullYear()}`;
  }
  return text;
}

function joinExportAddress(parts) {
  return parts.map(cleanExportText).filter(Boolean).join(", ");
}

function exportGenderLabelText(gender) {
  return gender === "female" ? "N\u1eef" : "Nam";
}

function exportStatusLabelText(status) {
  const s = cleanExportText(status).toLowerCase();
  if (s === "inactive") return "Ngh\u1ec9 h\u1ecdc";
  if (s === "graduated") return "T\u1ed1t nghi\u1ec7p";
  if (s === "leave") return "T\u1ea1m ngh\u1ec9";
  if (s === "monitoring") return "\u0110ang theo d\u00f5i";
  return "\u0110ang h\u1ecdc";
}

function safeSheetName(name, usedNames) {
  const base = (cleanExportText(name) || "Chưa phân lớp")
    .replace(/[\[\]\*\/\\\?\:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31) || "Sheet";
  let candidate = base;
  let index = 2;
  while (usedNames.has(candidate)) {
    const suffix = ` (${index})`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    index += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

function buildStudentExportRow(student, index) {
  const detailAddress = joinExportAddress([student.houseNumber, student.street]);
  const permanentLine = joinExportAddress([student.street, student.hamlet]);
  const currentAddress =
    cleanExportText(student.householdAddress) ||
    joinExportAddress([student.householdHouseNumber, student.householdStreet, student.householdWard, student.householdProvince]) ||
    joinExportAddress([detailAddress, student.ward, student.province]);

  return [
    index + 1,
    cleanExportText(student.className),
    "",
    cleanExportText(student.name),
    exportGenderLabelText(student.gender),
    exportStatusLabelText(student.status),
    formatExportDate(student.dateOfBirth),
    cleanExportText(student.nationality),
    cleanExportText(student.bhytNumber),
    formatExportDate(student.joinDate),
    detailAddress,
    cleanExportText(student.province),
    cleanExportText(student.ward),
    permanentLine,
    currentAddress,
    cleanExportText(student.idNumber),
    cleanExportText(student.motherName),
    formatExportDate(student.motherBirthDate),
    cleanExportText(student.motherPhone),
    cleanExportText(student.motherEmail),
    cleanExportText(student.motherIdNumber),
    cleanExportText(student.motherOccupation),
    cleanExportText(student.fatherName),
    formatExportDate(student.fatherBirthDate),
    cleanExportText(student.fatherPhone),
    cleanExportText(student.fatherEmail),
    cleanExportText(student.fatherIdNumber),
    cleanExportText(student.fatherOccupation),
  ];
}

function escapeXml(value) {
  return cleanExportText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function excelXmlCell(value, styleId = "") {
  const styleAttr = styleId ? ` ss:StyleID="${styleId}"` : "";
  const text = escapeXml(value);
  return `<Cell${styleAttr}><Data ss:Type="String">${text}</Data></Cell>`;
}

function excelXmlHeaderCell(value) {
  return `<Cell ss:MergeDown="1" ss:StyleID="Header"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
}

function excelXmlWorksheet(name, students) {
  const columns = exportHeaderLabels
    .map((_, index) => {
      if (index === 0) return '<Column ss:Width="42"/>';
      if ([3, 14, 16, 22].includes(index)) return '<Column ss:Width="196"/>';
      if ([4, 5].includes(index)) return '<Column ss:Width="98"/>';
      return '<Column ss:Width="147"/>';
    })
    .join("");
  const header = `<Row ss:Height="34">${exportHeaderLabels.map(excelXmlHeaderCell).join("")}</Row><Row ss:Height="34"></Row>`;
  const body = students
    .map((student, index) => `<Row>${buildStudentExportRow(student, index).map((value) => excelXmlCell(value)).join("")}</Row>`)
    .join("");

  return `
    <Worksheet ss:Name="${escapeXml(name)}">
      <Table>
        ${columns}
        ${header}
        ${body}
      </Table>
    </Worksheet>`;
}

function buildStudentExportWorkbookXml(groups) {
  const worksheets = groups.map((group) => excelXmlWorksheet(group.name, group.students)).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10"/>
    </Style>
    <Style ss:ID="Header">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#1F2A44"/>
      <Interior ss:Color="#FFF2CC" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
      </Borders>
    </Style>
  </Styles>
  ${worksheets}
</Workbook>`;
}

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
  SELECT s.id, s.name, s.last_name, s.first_name, s.grade, s.email, s.date_of_birth, s.class_id, s.academic_year_id,
         s.avatar, s.join_date, s.status, s.gender,
         s.phone, s.nationality, s.religion, s.province, s.ward, s.house_number, s.street, s.hamlet,
         s.birth_place, s.birth_address, s.birth_ward, s.birth_province,
         s.hometown_ward, s.hometown_province,
         s.birth_registration_ward, s.birth_registration_district, s.birth_registration_province,
         s.birth_registration_new_ward, s.birth_registration_new_province, s.student_id_issued_date,
         s.father_birth_year, s.mother_birth_year,
         s.father_name, s.father_birth_date, s.father_phone, s.father_email,
         s.father_login, s.father_id_number, s.father_id_issued_date, s.father_education, s.father_occupation,
         s.mother_name, s.mother_birth_date, s.mother_phone, s.mother_email,
         s.mother_login, s.mother_id_number, s.mother_id_issued_date, s.mother_education, s.mother_occupation,
         s.id_number, s.id_issued_place, s.id_issued_date, s.area, s.bhyt_number,
         s.household_house_number, s.household_street, s.household_ward, s.household_province, s.household_address,
         s.doc_household_registration, s.doc_parent_id, s.doc_birth_certificate, s.doc_student_id_form,
         s.doc_health_check, s.doc_residence_confirmation, s.doc_birth_certificate_copy,
         s.doc2_household_registration, s.doc2_parent_id, s.doc2_birth_certificate, s.doc2_student_id_form,
         s.doc2_health_check, s.doc2_residence_confirmation, s.doc2_birth_certificate_04,
         s.disability_type, s.policy_beneficiary, s.eye_disease,
         s.guardian_name, s.guardian_occupation, s.guardian_birth_year,
         c.name AS class_name, ay.name AS academic_year_name
  FROM students s
  LEFT JOIN classes c ON c.id = s.class_id
  LEFT JOIN academic_years ay ON ay.id = s.academic_year_id
`;

const studentNameOrder = `
  ORDER BY
    NULLIF(TRIM(s.first_name), '') NULLS LAST,
    NULLIF(TRIM(s.last_name), '') NULLS LAST,
    NULLIF(TRIM(s.name), '') NULLS LAST,
    s.id
`;

function mapAcademicYear(row) {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date ? String(row.start_date).slice(0, 10) : "",
    endDate: row.end_date ? String(row.end_date).slice(0, 10) : "",
    isCurrent: row.is_current === true,
  };
}

function mapClassOption(row) {
  return {
    id: row.id,
    name: row.name,
    level: row.level ?? "",
    academicYearId: row.academic_year_id != null ? Number(row.academic_year_id) : null,
  };
}

async function ensureAcademicYearsSeeded() {
  const currentYearRow = await pool.query(
    `SELECT name
     FROM academic_years
     WHERE is_current = TRUE
     ORDER BY id
     LIMIT 1`
  );

  const now = new Date();
  const thisYear = now.getFullYear();
  const defaultCurrentStartYear = now.getMonth() >= 7 ? thisYear : thisYear - 1;
  const currentStartYear = currentYearRow.rowCount
    ? Number(String(currentYearRow.rows[0].name || "").slice(0, 4)) || defaultCurrentStartYear
    : defaultCurrentStartYear;

  for (let startYear = currentStartYear - 1; startYear <= 2035; startYear += 1) {
    await pool.query(
      `INSERT INTO academic_years (name, start_date, end_date, is_current)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO NOTHING`,
      [
        `${startYear}-${startYear + 1}`,
        `${startYear}-08-01`,
        `${startYear + 1}-07-31`,
        startYear === currentStartYear,
      ]
    );
  }
}

async function resolveAcademicYearId(raw) {
  if (raw == null || raw === "") return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    return { error: "academicYearId must be a positive integer or empty" };
  }
  const r = await pool.query(`SELECT id FROM academic_years WHERE id = $1`, [id]);
  if (!r.rowCount) return { error: "Academic year not found" };
  return { id };
}

async function resolveClassId(raw) {
  if (raw == null || raw === "") return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    return { error: "classId must be a positive integer or empty" };
  }
  const c = await pool.query(`SELECT id, academic_year_id FROM classes WHERE id = $1`, [id]);
  if (!c.rowCount) return { error: "Class not found" };
  return {
    id,
    academicYearId: c.rows[0].academic_year_id != null ? Number(c.rows[0].academic_year_id) : null,
  };
}

async function resolveAcademicPlacement({ classId, academicYearId }) {
  const cid = await resolveClassId(classId);
  if (cid?.error) return { error: cid.error };
  const aid = await resolveAcademicYearId(academicYearId);
  if (aid?.error) return { error: aid.error };

  const nextAcademicYearId = aid?.id ?? cid?.academicYearId ?? null;
  if (cid?.academicYearId != null && nextAcademicYearId != null && cid.academicYearId !== nextAcademicYearId) {
    return { error: "Class does not belong to selected academic year" };
  }

  return {
    classId: cid?.id ?? null,
    academicYearId: nextAcademicYearId,
  };
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

router.get("/birthdays", async (req, res, next) => {
  try {
    const now = new Date();
    let month = Number(req.query.month);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      month = now.getMonth() + 1;
    }

    const params = [];
    const whereParts = [
      `s.date_of_birth IS NOT NULL`,
      `NULLIF(TRIM(s.date_of_birth::text), '') IS NOT NULL`,
    ];

    if (req.user?.role === "teacher") {
      if (req.user.teacherId == null) {
        return res.json({ month, year: now.getFullYear(), counts: Array(12).fill(0), items: [] });
      }
      params.push(req.user.teacherId);
      whereParts.push(`EXISTS (
        SELECT 1 FROM class_teachers ct
        WHERE ct.class_id = s.class_id AND ct.teacher_id = $${params.length}
      )`);
    }

    // Prefer currently enrolled-ish statuses for birthday list
    const statusFilter = String(req.query.status || "active,monitoring,leave").trim();
    if (statusFilter && statusFilter !== "all") {
      const statuses = statusFilter
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (statuses.length) {
        params.push(statuses);
        whereParts.push(`COALESCE(s.status, 'active') = ANY($${params.length}::text[])`);
      }
    }

    const whereSql = `WHERE ${whereParts.join(" AND ")}`;

    const countParams = [...params];
    const countSql = `
      SELECT EXTRACT(MONTH FROM s.date_of_birth::date)::int AS month, COUNT(*)::int AS count
      FROM students s
      ${whereSql}
      AND s.date_of_birth::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      GROUP BY 1
    `;
    const countResult = await pool.query(countSql, countParams);
    const counts = Array(12).fill(0);
    for (const row of countResult.rows) {
      const m = Number(row.month);
      if (m >= 1 && m <= 12) counts[m - 1] = Number(row.count) || 0;
    }

    params.push(month);
    const listSql = `
      SELECT s.id, s.name, s.last_name, s.first_name, s.date_of_birth, s.gender, s.avatar, s.status,
             s.class_id,
             c.name AS class_name,
             EXTRACT(DAY FROM s.date_of_birth::date)::int AS birthday_day,
             EXTRACT(MONTH FROM s.date_of_birth::date)::int AS birthday_month
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      ${whereSql}
      AND s.date_of_birth::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      AND EXTRACT(MONTH FROM s.date_of_birth::date) = $${params.length}
      ORDER BY COALESCE(NULLIF(TRIM(c.name), ''), 'zzzz'),
               EXTRACT(DAY FROM s.date_of_birth::date),
               NULLIF(TRIM(s.first_name), '') NULLS LAST,
               NULLIF(TRIM(s.name), '') NULLS LAST,
               s.id
    `;
    const listResult = await pool.query(listSql, params);
    const year = now.getFullYear();
    const items = listResult.rows.map((row) => {
      const dob = String(row.date_of_birth).slice(0, 10);
      const birthYear = Number(dob.slice(0, 4));
      const ageTurning = Number.isFinite(birthYear) ? year - birthYear : null;
      const fullName = [row.last_name, row.first_name].map((v) => String(v || "").trim()).filter(Boolean).join(" ")
        || String(row.name || "").trim();
      return {
        id: row.id,
        name: fullName,
        dateOfBirth: dob,
        birthdayDay: Number(row.birthday_day),
        birthdayMonth: Number(row.birthday_month),
        ageTurning,
        classId: row.class_id != null ? Number(row.class_id) : null,
        className: row.class_name || "",
        gender: row.gender === "female" ? "female" : "male",
        avatar: row.avatar || "",
        status: row.status || "active",
      };
    });

    res.json({ month, year, counts, items });
  } catch (e) {
    next(e);
  }
});

const birthdayExportHeaders = [
  "STT",
  "Lớp",
  "Họ và tên",
  "Giới tính",
  "Ngày sinh",
  "Thứ",
  "Ngày",
  "Tuổi",
  "SĐT mẹ",
  "SĐT cha",
];

function formatExportDateDotted(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    return `${day}.${month}.${value.getFullYear()}`;
  }
  const text = cleanExportText(value);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  return formatExportDate(value).replace(/\//g, ".");
}

function weekdayVi(year, month, day) {
  const date = new Date(year, month - 1, Number(day) || 1);
  if (Number.isNaN(date.getTime())) return "";
  const labels = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
  return labels[date.getDay()] || "";
}

function excelXmlBirthdayWorksheet(name, rows) {
  const columns = birthdayExportHeaders
    .map((_, index) => {
      if (index === 0 || index === 6 || index === 7) return '<Column ss:Width="48"/>';
      if (index === 2) return '<Column ss:Width="196"/>';
      if (index === 4) return '<Column ss:Width="110"/>';
      return '<Column ss:Width="120"/>';
    })
    .join("");
  const header = `<Row ss:Height="28">${birthdayExportHeaders.map((label) => excelXmlCell(label, "Header")).join("")}</Row>`;
  const body = rows
    .map((row) => `<Row>${row.map((value) => excelXmlCell(value)).join("")}</Row>`)
    .join("");

  return `
    <Worksheet ss:Name="${escapeXml(name)}">
      <Table>
        ${columns}
        ${header}
        ${body}
      </Table>
    </Worksheet>`;
}

function buildBirthdayExportWorkbookXml(sheetName, rows) {
  const worksheets = excelXmlBirthdayWorksheet(sheetName, rows);
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10"/>
    </Style>
    <Style ss:ID="Header">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#1F2A44"/>
      <Interior ss:Color="#D7F1E8" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  ${worksheets}
</Workbook>`;
}

router.get("/birthdays/export", async (req, res, next) => {
  try {
    const now = new Date();
    let month = Number(req.query.month);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      month = now.getMonth() + 1;
    }
    const year = now.getFullYear();

    const params = [];
    const whereParts = [
      `s.date_of_birth IS NOT NULL`,
      `NULLIF(TRIM(s.date_of_birth::text), '') IS NOT NULL`,
    ];

    if (req.user?.role === "teacher") {
      if (req.user.teacherId == null) {
        return res.status(403).json({ error: "Teacher is not assigned to any class" });
      }
      params.push(req.user.teacherId);
      whereParts.push(`EXISTS (
        SELECT 1 FROM class_teachers ct
        WHERE ct.class_id = s.class_id AND ct.teacher_id = $${params.length}
      )`);
    }

    const statusFilter = String(req.query.status || "active,monitoring,leave").trim();
    if (statusFilter && statusFilter !== "all") {
      const statuses = statusFilter
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (statuses.length) {
        params.push(statuses);
        whereParts.push(`COALESCE(s.status, 'active') = ANY($${params.length}::text[])`);
      }
    }

    params.push(month);
    const listSql = `
      SELECT s.id, s.name, s.last_name, s.first_name, s.date_of_birth, s.gender,
             s.mother_phone, s.father_phone, s.class_id,
             c.name AS class_name,
             to_char(s.date_of_birth::date, 'DD.MM.YYYY') AS date_of_birth_export,
             EXTRACT(YEAR FROM s.date_of_birth::date)::int AS birth_year,
             EXTRACT(DAY FROM s.date_of_birth::date)::int AS birthday_day
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      WHERE ${whereParts.join(" AND ")}
      AND s.date_of_birth::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      AND EXTRACT(MONTH FROM s.date_of_birth::date) = $${params.length}
      ORDER BY COALESCE(NULLIF(TRIM(c.name), ''), 'zzzz'),
               EXTRACT(DAY FROM s.date_of_birth::date),
               NULLIF(TRIM(s.first_name), '') NULLS LAST,
               NULLIF(TRIM(s.name), '') NULLS LAST,
               s.id
    `;
    const listResult = await pool.query(listSql, params);

    const exportRows = listResult.rows.map((row, index) => {
      const birthYear = Number(row.birth_year);
      const ageTurning = Number.isFinite(birthYear) ? year - birthYear : "";
      const fullName = [row.last_name, row.first_name].map((v) => String(v || "").trim()).filter(Boolean).join(" ")
        || String(row.name || "").trim();
      const className = cleanExportText(row.class_name) || "Chưa xếp lớp";
      const day = Number(row.birthday_day) || 0;
      return [
        index + 1,
        className,
        fullName,
        exportGenderLabelText(row.gender === "female" ? "female" : "male"),
        row.date_of_birth_export || formatExportDateDotted(row.date_of_birth),
        weekdayVi(year, month, day),
        day || "",
        ageTurning,
        cleanExportText(row.mother_phone),
        cleanExportText(row.father_phone),
      ];
    });

    const monthLabel = String(month).padStart(2, "0");
    const sheetName = `Sinh nhật T${monthLabel}`;
    const buffer = Buffer.from(`\ufeff${buildBirthdayExportWorkbookXml(sheetName, exportRows)}`, "utf8");
    res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="sinh-nhat-thang-${monthLabel}-${year}.xls"`
    );
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

router.get("/export/classes", async (req, res, next) => {
  try {
    const params = [];
    let where = "";
    if (req.user?.role === "teacher") {
      if (req.user.teacherId == null) {
        return res.status(403).json({ error: "Teacher is not assigned to any class" });
      }
      params.push(req.user.teacherId);
      where = `
        WHERE EXISTS (
          SELECT 1
          FROM class_teachers ct
          WHERE ct.class_id = s.class_id AND ct.teacher_id = $1
        )
      `;
    }

    const classesResult = await pool.query(
      `SELECT c.id, c.name
       FROM classes c
       ${req.user?.role === "teacher"
         ? "WHERE EXISTS (SELECT 1 FROM class_teachers ct WHERE ct.class_id = c.id AND ct.teacher_id = $1)"
         : ""}
       ORDER BY c.id`,
      params
    );
    const result = await pool.query(`${studentSelect} ${where} ${studentNameOrder}`, params);
    const students = result.rows.map(mapStudentRow);
    const groups = new Map();
    for (const row of classesResult.rows) {
      groups.set(`class:${row.id}`, {
        name: row.name || "Chưa đặt tên lớp",
        students: [],
      });
    }
    for (const student of students) {
      const key = student.classId != null ? `class:${student.classId}` : "unassigned";
      if (!groups.has(key)) {
        groups.set(key, {
          name: student.className || "Chưa phân lớp",
          students: [],
        });
      }
      groups.get(key).students.push(student);
    }
    if (!groups.size) groups.set("all", { name: "Danh sách", students: [] });

    const usedSheetNames = new Set();
    const exportGroups = [...groups.values()]
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .map((group) => ({
        name: safeSheetName(group.name, usedSheetNames),
        students: group.students,
      }));

    const buffer = Buffer.from(`\ufeff${buildStudentExportWorkbookXml(exportGroups)}`, "utf8");
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="danh-sach-hoc-sinh-theo-lop-${today}.xls"`);
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

const historySelect = `
  SELECT h.id, h.student_id, h.from_class_id, h.to_class_id,
         h.from_academic_year_id, h.to_academic_year_id, h.effective_date, h.note, h.created_at,
         cf.name AS from_class_name, ct.name AS to_class_name
  FROM student_class_history h
  LEFT JOIN classes cf ON cf.id = h.from_class_id
  LEFT JOIN classes ct ON ct.id = h.to_class_id
`;

router.get("/metadata", async (req, res, next) => {
  try {
    await ensureAcademicYearsSeeded();
    const params = [];
    const classAccess =
      req.user?.role === "teacher"
        ? req.user.teacherId == null
          ? "WHERE FALSE"
          : "WHERE EXISTS (SELECT 1 FROM class_teachers ct WHERE ct.class_id = c.id AND ct.teacher_id = $1)"
        : "";
    if (req.user?.role === "teacher" && req.user.teacherId != null) {
      params.push(req.user.teacherId);
    }
    const [years, classes] = await Promise.all([
      pool.query(`SELECT * FROM academic_years ORDER BY start_date NULLS LAST, name`),
      pool.query(
        `SELECT c.id, c.name, c.level, c.academic_year_id
         FROM classes c
         ${classAccess}
         ORDER BY c.name, c.id`,
        params
      ),
    ]);
    res.json({
      academicYears: years.rows.map(mapAcademicYear),
      classes: classes.rows.map(mapClassOption),
    });
  } catch (e) {
    next(e);
  }
});

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

const studentExtraFieldMap = [
  ["birthAddress", "birth_address"],
  ["birthWard", "birth_ward"],
  ["birthProvince", "birth_province"],
  ["hometownWard", "hometown_ward"],
  ["hometownProvince", "hometown_province"],
  ["birthRegistrationWard", "birth_registration_ward"],
  ["birthRegistrationDistrict", "birth_registration_district"],
  ["birthRegistrationProvince", "birth_registration_province"],
  ["birthRegistrationNewWard", "birth_registration_new_ward"],
  ["birthRegistrationNewProvince", "birth_registration_new_province"],
  ["studentIdIssuedDate", "student_id_issued_date", "date"],
  ["motherIdIssuedDate", "mother_id_issued_date", "date"],
  ["motherEducation", "mother_education"],
  ["fatherIdIssuedDate", "father_id_issued_date", "date"],
  ["fatherEducation", "father_education"],
  ["householdHouseNumber", "household_house_number"],
  ["householdStreet", "household_street"],
  ["householdWard", "household_ward"],
  ["householdProvince", "household_province"],
  ["householdAddress", "household_address"],
  ["docHouseholdRegistration", "doc_household_registration"],
  ["docParentId", "doc_parent_id"],
  ["docBirthCertificate", "doc_birth_certificate"],
  ["docStudentIdForm", "doc_student_id_form"],
  ["docHealthCheck", "doc_health_check"],
  ["docResidenceConfirmation", "doc_residence_confirmation"],
  ["docBirthCertificateCopy", "doc_birth_certificate_copy"],
  ["doc2HouseholdRegistration", "doc2_household_registration"],
  ["doc2ParentId", "doc2_parent_id"],
  ["doc2BirthCertificate", "doc2_birth_certificate"],
  ["doc2StudentIdForm", "doc2_student_id_form"],
  ["doc2HealthCheck", "doc2_health_check"],
  ["doc2ResidenceConfirmation", "doc2_residence_confirmation"],
  ["doc2BirthCertificate04", "doc2_birth_certificate_04"],
];

async function updateStudentExtraFields(client, studentId, body) {
  const sets = [];
  const values = [];
  for (const [camel, snake, type] of studentExtraFieldMap) {
    if (body[camel] === undefined) continue;
    values.push(type === "date" ? normalizeDateInput(body[camel]) : str(body[camel]));
    sets.push(`${snake} = $${values.length}`);
  }
  if (!sets.length) return;
  values.push(studentId);
  await client.query(`UPDATE students SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
}

router.post("/", async (req, res, next) => {
  try {
    const b = req.body || {};
    const { name, lastName, firstName, grade, email, dateOfBirth, classId, academicYearId, avatar, joinDate, status, gender } = b;
    const personName = normalizePersonName({ name, lastName, firstName });
    if (!personName.name) {
      return res.status(400).json({ error: "name is required" });
    }
    const placement = await resolveAcademicPlacement({ classId, academicYearId });
    if (placement.error) return res.status(400).json({ error: placement.error });
    const class_id = placement.classId;
    const academic_year_id = placement.academicYearId;
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
           name, last_name, first_name, grade, email, date_of_birth, class_id, academic_year_id, avatar, join_date, status, gender,
           phone, nationality, religion, province, ward, house_number, street, hamlet,
           birth_place, father_birth_year, mother_birth_year,
           father_name, father_birth_date, father_phone, father_email,
           father_login, father_id_number, father_occupation,
           mother_name, mother_birth_date, mother_phone, mother_email,
           mother_login, mother_id_number, mother_occupation,
           id_number, id_issued_place, id_issued_date, area, bhyt_number,
           disability_type, policy_beneficiary, eye_disease,
           guardian_name, guardian_occupation, guardian_birth_year
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48)
          RETURNING id`,
        [
          personName.name,
          personName.lastName,
          personName.firstName,
          str(grade),
          str(email),
          normalizeDateInput(dateOfBirth),
          class_id,
          academic_year_id,
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
      await updateStudentExtraFields(client, newId, b);
      if (class_id != null) {
        const eff = normalizeDateInput(joinDate);
        await client.query(
          `INSERT INTO student_class_history (
             student_id, from_class_id, to_class_id, from_academic_year_id, to_academic_year_id,
             effective_date, note, action, from_status, to_status
           )
           VALUES ($1, NULL, $2, NULL, $3, COALESCE($4::date, CURRENT_DATE), $5, 'transfer', NULL, $6)`,
          [newId, class_id, academic_year_id, eff, normalizeHistoryNote(req.body?.classHistoryNote), st]
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
      name, grade, email, dateOfBirth, classId, academicYearId, avatar, joinDate, status, gender,
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
      let nextAcademicYearId = cur.academic_year_id;
      if (classId !== undefined || academicYearId !== undefined) {
        const placement = await resolveAcademicPlacement({
          classId: classId !== undefined ? classId : cur.class_id,
          academicYearId: academicYearId !== undefined ? academicYearId : cur.academic_year_id,
        });
        if (placement.error) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: placement.error });
        }
        nextClassId = placement.classId;
        nextAcademicYearId = placement.academicYearId;
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

      if (classIdsDiffer(cur.class_id, nextClassId) || classIdsDiffer(cur.academic_year_id, nextAcademicYearId)) {
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
          `INSERT INTO student_class_history (
             student_id, from_class_id, to_class_id, from_academic_year_id, to_academic_year_id,
             effective_date, note, action, from_status, to_status
           )
           VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7, 'transfer', $8, $9)`,
          [
            id,
            cur.class_id,
            nextClassId,
            cur.academic_year_id,
            nextAcademicYearId,
            effParam,
            normalizeHistoryNote(classChangeNote),
            cur.status ?? "active",
            nextStatus,
          ]
        );
      }

      const upd = (field) => b[field] != null ? String(b[field]).trim() : (cur[field] ?? "");
      const updSnake = (camel, snake) => b[camel] != null ? String(b[camel]).trim() : (cur[snake] ?? "");

      await client.query(
        `UPDATE students SET
           name=$1, last_name=$2, first_name=$3, grade=$4, email=$5, date_of_birth=$6, class_id=$7, academic_year_id=$8,
           avatar=$9, join_date=$10, status=$11, gender=$12,
           phone=$13, nationality=$14, religion=$15, province=$16, ward=$17, house_number=$18, street=$19, hamlet=$20,
           birth_place=$21, father_birth_year=$22, mother_birth_year=$23,
           father_name=$24, father_birth_date=$25, father_phone=$26, father_email=$27,
           father_login=$28, father_id_number=$29, father_occupation=$30,
           mother_name=$31, mother_birth_date=$32, mother_phone=$33, mother_email=$34,
           mother_login=$35, mother_id_number=$36, mother_occupation=$37,
           id_number=$38, id_issued_place=$39, id_issued_date=$40, area=$41, bhyt_number=$42,
           disability_type=$43, policy_beneficiary=$44, eye_disease=$45,
           guardian_name=$46, guardian_occupation=$47, guardian_birth_year=$48
         WHERE id = $49`,
        [
          nextName, personName.lastName, personName.firstName, nextGrade, nextEmail, nextDob, nextClassId, nextAcademicYearId,
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
      await updateStudentExtraFields(client, id, b);
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
