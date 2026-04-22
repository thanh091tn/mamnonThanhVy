import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

function todayStrLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysStr(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function currentMonthKey() {
  return todayStrLocal().slice(0, 7);
}

function normalizeMonthKey(raw) {
  const fallback = currentMonthKey();
  if (raw == null || raw === "") return fallback;
  const value = String(raw).trim();
  if (!/^\d{4}-\d{2}$/.test(value)) return fallback;
  const [year, month] = value.split("-").map(Number);
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || month < 1 || month > 12) {
    return fallback;
  }
  return value > fallback ? fallback : value;
}

function monthBounds(monthKey, today = todayStrLocal()) {
  const [year, month] = monthKey.split("-").map(Number);
  const pad = (n) => String(n).padStart(2, "0");
  const from = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;
  const to = monthKey === today.slice(0, 7) ? today : monthEnd;
  const dayCount =
    Math.floor((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000) + 1;
  return { from, to, dayCount: Math.max(dayCount, 0) };
}

function monthOptions(selectedMonth, count = 12) {
  const [year, month] = currentMonthKey().split("-").map(Number);
  const options = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(year, month - 1 - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({
      value,
      label: `Tháng ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`,
      selected: value === selectedMonth,
    });
  }
  return options;
}

function pct(done, total) {
  const t = Number(total || 0);
  if (!t) return 0;
  return Math.round((Number(done || 0) / t) * 100);
}

function num(v) {
  return Number(v || 0);
}

function classRow(row) {
  const studentCount = num(row.student_count);
  const presentCount = num(row.present_count);
  const absentCount = num(row.absent_count);
  const lateCount = num(row.late_count);
  const excusedCount = num(row.excused_count);
  const markedCount = num(row.marked_count);
  const unmarkedCount = Math.max(studentCount - markedCount, 0);
  return {
    id: row.id,
    name: row.name,
    level: row.level ?? "",
    room: row.room ?? "",
    teacherNames: Array.isArray(row.teacher_names) ? row.teacher_names.filter(Boolean) : [],
    studentCount,
    presentCount,
    absentCount,
    lateCount,
    excusedCount,
    markedCount,
    unmarkedCount,
    progressPercent: pct(markedCount, studentCount),
  };
}

function monthlyClassRow(row, dayCount) {
  const studentCount = num(row.student_count);
  const totalSlots = studentCount * dayCount;
  const presentCount = num(row.present_count);
  const absentCount = num(row.absent_count);
  const lateCount = num(row.late_count);
  const excusedCount = num(row.excused_count);
  const markedCount = num(row.marked_count);
  const unmarkedCount = Math.max(totalSlots - markedCount, 0);
  return {
    classId: row.id,
    className: row.name,
    studentCount,
    totalSlots,
    presentCount,
    absentCount,
    lateCount,
    excusedCount,
    markedCount,
    unmarkedCount,
    progressPercent: pct(markedCount, totalSlots),
  };
}

async function loadClassAttendance(db, today, teacherId = null) {
  const params = [today];
  let where = "";
  if (teacherId != null) {
    params.push(teacherId);
    where = `
      WHERE EXISTS (
        SELECT 1 FROM class_teachers mine
        WHERE mine.class_id = c.id AND mine.teacher_id = $2
      )
    `;
  }
  const result = await db.query(
    `
    WITH attendance AS (
      SELECT c.id,
             c.name,
             c.level,
             c.room,
             COUNT(s.id) AS student_count,
             COUNT(sa.id) AS marked_count,
             COUNT(sa.id) FILTER (WHERE sa.status = 'present') AS present_count,
             COUNT(sa.id) FILTER (WHERE sa.status = 'absent') AS absent_count,
             COUNT(sa.id) FILTER (WHERE sa.status = 'late') AS late_count,
             COUNT(sa.id) FILTER (WHERE sa.status = 'excused') AS excused_count
      FROM classes c
      LEFT JOIN students s
        ON s.class_id = c.id
       AND COALESCE(s.status, 'active') = 'active'
      LEFT JOIN student_attendance sa
        ON sa.student_id = s.id
       AND sa.attendance_date = $1::date
       AND sa.session = 'full'
      ${where}
      GROUP BY c.id, c.name, c.level, c.room
    ),
    teachers AS (
      SELECT ct.class_id,
             ARRAY_REMOVE(ARRAY_AGG(t.name ORDER BY t.name, t.id), NULL) AS teacher_names
      FROM class_teachers ct
      JOIN teachers t ON t.id = ct.teacher_id
      GROUP BY ct.class_id
    )
    SELECT a.*, COALESCE(t.teacher_names, ARRAY[]::varchar[]) AS teacher_names
    FROM attendance a
    LEFT JOIN teachers t ON t.class_id = a.id
    ORDER BY a.id
    `,
    params
  );
  return result.rows.map(classRow);
}

async function loadMonthlyAttendance(db, bounds, teacherId = null) {
  const params = [bounds.from, bounds.to];
  let classWhere = "";
  if (teacherId != null) {
    params.push(teacherId);
    classWhere = `
      WHERE EXISTS (
        SELECT 1
        FROM class_teachers mine
        WHERE mine.class_id = c.id AND mine.teacher_id = $3
      )
    `;
  }
  const result = await db.query(
    `
    WITH eligible_classes AS (
      SELECT c.id, c.name
      FROM classes c
      ${classWhere}
    ),
    student_counts AS (
      SELECT s.class_id, COUNT(*) AS student_count
      FROM students s
      JOIN eligible_classes c ON c.id = s.class_id
      WHERE COALESCE(s.status, 'active') = 'active'
      GROUP BY s.class_id
    ),
    attendance_counts AS (
      SELECT s.class_id,
             COUNT(sa.id) AS marked_count,
             COUNT(sa.id) FILTER (WHERE sa.status = 'present') AS present_count,
             COUNT(sa.id) FILTER (WHERE sa.status = 'absent') AS absent_count,
             COUNT(sa.id) FILTER (WHERE sa.status = 'late') AS late_count,
             COUNT(sa.id) FILTER (WHERE sa.status = 'excused') AS excused_count
      FROM student_attendance sa
      JOIN students s ON s.id = sa.student_id
      JOIN eligible_classes c ON c.id = s.class_id
      WHERE COALESCE(s.status, 'active') = 'active'
        AND sa.attendance_date >= $1::date
        AND sa.attendance_date <= $2::date
        AND sa.session = 'full'
      GROUP BY s.class_id
    )
    SELECT c.id,
           c.name,
           COALESCE(sc.student_count, 0) AS student_count,
           COALESCE(ac.marked_count, 0) AS marked_count,
           COALESCE(ac.present_count, 0) AS present_count,
           COALESCE(ac.absent_count, 0) AS absent_count,
           COALESCE(ac.late_count, 0) AS late_count,
           COALESCE(ac.excused_count, 0) AS excused_count
    FROM eligible_classes c
    LEFT JOIN student_counts sc ON sc.class_id = c.id
    LEFT JOIN attendance_counts ac ON ac.class_id = c.id
    ORDER BY c.id
    `,
    params
  );

  const byClass = result.rows.map((row) => monthlyClassRow(row, bounds.dayCount));
  const totals = byClass.reduce(
    (acc, row) => {
      acc.studentCount += row.studentCount;
      acc.totalSlots += row.totalSlots;
      acc.presentCount += row.presentCount;
      acc.absentCount += row.absentCount;
      acc.lateCount += row.lateCount;
      acc.excusedCount += row.excusedCount;
      acc.markedCount += row.markedCount;
      acc.unmarkedCount += row.unmarkedCount;
      return acc;
    },
    {
      studentCount: 0,
      totalSlots: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      markedCount: 0,
      unmarkedCount: 0,
    }
  );
  return {
    from: bounds.from,
    to: bounds.to,
    dayCount: bounds.dayCount,
    ...totals,
    progressPercent: pct(totals.markedCount, totals.totalSlots),
    chart: [
      { label: "Có mặt", value: totals.presentCount, color: "#16a34a" },
      { label: "Nghỉ", value: totals.absentCount, color: "#dc2626" },
      { label: "Trễ", value: totals.lateCount, color: "#f59e0b" },
      { label: "Có phép", value: totals.excusedCount, color: "#2563eb" },
      { label: "Chưa điểm danh", value: totals.unmarkedCount, color: "#94a3b8" },
    ],
    byClass,
  };
}

function summarizeAttendance(rows) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.studentCount += row.studentCount;
      acc.presentCount += row.presentCount;
      acc.absentCount += row.absentCount;
      acc.lateCount += row.lateCount;
      acc.excusedCount += row.excusedCount;
      acc.markedCount += row.markedCount;
      acc.unmarkedCount += row.unmarkedCount;
      return acc;
    },
    {
      studentCount: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      markedCount: 0,
      unmarkedCount: 0,
    }
  );
  return {
    ...totals,
    progressPercent: pct(totals.markedCount, totals.studentCount),
    byClass: rows,
  };
}

function leaveRow(row) {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name ?? "",
    attendanceDate: row.attendance_date ? String(row.attendance_date).slice(0, 10) : "",
    status: row.status,
    note: row.note ?? "",
  };
}

async function adminDashboard(req, res, next) {
  try {
    const today = todayStrLocal();
    const selectedMonth = normalizeMonthKey(req.query.month);
    const bounds = monthBounds(selectedMonth, today);
    const weekTo = addDaysStr(today, 7);
    const [overviewRes, unassignedStudentsRes, classRows, monthlyAttendance, leaveRes] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM students) AS student_count,
          (SELECT COUNT(*) FROM students WHERE COALESCE(status, 'active') = 'active') AS active_student_count,
          (SELECT COUNT(*) FROM teachers) AS teacher_count,
          (SELECT COUNT(*) FROM teachers WHERE COALESCE(status, 'active') = 'active') AS active_teacher_count,
          (SELECT COUNT(*) FROM classes) AS class_count,
          (
            SELECT COUNT(*)
            FROM classes c
            WHERE NOT EXISTS (SELECT 1 FROM class_teachers ct WHERE ct.class_id = c.id)
          ) AS unassigned_class_count
      `),
      pool.query(`
        SELECT COUNT(*) AS count
        FROM students
        WHERE class_id IS NULL
          AND COALESCE(status, 'active') = 'active'
      `),
      loadClassAttendance(pool, today),
      loadMonthlyAttendance(pool, bounds),
      pool.query(
        `
        SELECT ta.id, ta.teacher_id, ta.attendance_date, ta.status, ta.note, t.name AS teacher_name
        FROM teacher_attendance ta
        JOIN teachers t ON t.id = ta.teacher_id
        WHERE ta.status = 'leave'
          AND ta.attendance_date >= $1::date
          AND ta.attendance_date <= $2::date
        ORDER BY ta.attendance_date ASC, t.name ASC
        LIMIT 20
        `,
        [today, weekTo]
      ),
    ]);

    const overview = overviewRes.rows[0] || {};
    const attendanceToday = summarizeAttendance(classRows);
    const todayLeaveRows = leaveRes.rows.filter(
      (row) => String(row.attendance_date).slice(0, 10) === today
    );
    const alerts = [];
    const unassignedClassCount = num(overview.unassigned_class_count);
    const unassignedStudentCount = num(unassignedStudentsRes.rows[0]?.count);
    const unfinishedClassCount = attendanceToday.byClass.filter(
      (row) => row.studentCount > 0 && row.unmarkedCount > 0
    ).length;

    if (unassignedClassCount > 0) {
      alerts.push({
        type: "class",
        level: "warning",
        message: `${unassignedClassCount} lớp chưa có giáo viên phụ trách.`,
        actionTo: "/school",
      });
    }
    if (unassignedStudentCount > 0) {
      alerts.push({
        type: "student",
        level: "warning",
        message: `${unassignedStudentCount} học sinh đang chưa xếp lớp.`,
        actionTo: "/school",
      });
    }
    if (unfinishedClassCount > 0) {
      alerts.push({
        type: "attendance",
        level: "danger",
        message: `${unfinishedClassCount} lớp chưa điểm danh xong hôm nay.`,
        actionTo: "/attendance",
      });
    }
    if (todayLeaveRows.length > 0) {
      alerts.push({
        type: "leave",
        level: "info",
        message: `${todayLeaveRows.length} giáo viên nghỉ phép hôm nay.`,
        actionTo: "/leave-calendar",
      });
    }

    res.json({
      role: "admin",
      today,
      overview: {
        studentCount: num(overview.student_count),
        activeStudentCount: num(overview.active_student_count),
        teacherCount: num(overview.teacher_count),
        activeTeacherCount: num(overview.active_teacher_count),
        classCount: num(overview.class_count),
        unassignedClassCount,
        unassignedStudentCount,
      },
      attendanceToday,
      selectedMonth,
      monthOptions: monthOptions(selectedMonth),
      monthlyAttendance,
      teacherLeave: {
        todayCount: todayLeaveRows.length,
        upcoming: leaveRes.rows.map(leaveRow),
      },
      alerts,
    });
  } catch (e) {
    next(e);
  }
}

async function teacherDashboard(req, res, next) {
  try {
    const today = todayStrLocal();
    const selectedMonth = normalizeMonthKey(req.query.month);
    const bounds = monthBounds(selectedMonth, today);
    const weekTo = addDaysStr(today, 14);
    const teacherId = req.user.teacherId;
    if (teacherId == null) {
      return res.status(403).json({ error: "Teacher account is not linked to a teacher profile" });
    }

    const [classRows, monthlyAttendance, leaveRes] = await Promise.all([
      loadClassAttendance(pool, today, teacherId),
      loadMonthlyAttendance(pool, bounds, teacherId),
      pool.query(
        `
        SELECT ta.id, ta.teacher_id, ta.attendance_date, ta.status, ta.note, t.name AS teacher_name
        FROM teacher_attendance ta
        JOIN teachers t ON t.id = ta.teacher_id
        WHERE ta.teacher_id = $1
          AND ta.attendance_date >= $2::date
          AND ta.attendance_date <= $3::date
        ORDER BY ta.attendance_date ASC
        LIMIT 20
        `,
        [teacherId, today, weekTo]
      ),
    ]);
    const attendanceToday = summarizeAttendance(classRows);
    const alerts = [];
    const unfinishedClassCount = classRows.filter(
      (row) => row.studentCount > 0 && row.unmarkedCount > 0
    ).length;

    if (!classRows.length) {
      alerts.push({
        type: "class",
        level: "warning",
        message: "Bạn chưa được phân công lớp nào.",
        actionTo: "/profile",
      });
    }
    if (unfinishedClassCount > 0) {
      alerts.push({
        type: "attendance",
        level: "danger",
        message: `${unfinishedClassCount} lớp còn học sinh chưa điểm danh hôm nay.`,
        actionTo: "/attendance",
      });
    }

    res.json({
      role: "teacher",
      today,
      overview: {
        assignedClassCount: classRows.length,
        studentCount: attendanceToday.studentCount,
      },
      classes: classRows,
      attendanceToday,
      selectedMonth,
      monthOptions: monthOptions(selectedMonth),
      monthlyAttendance,
      myLeave: {
        upcoming: leaveRes.rows.map(leaveRow),
      },
      alerts,
    });
  } catch (e) {
    next(e);
  }
}

router.get("/", async (req, res, next) => {
  if (req.user?.role === "admin") return adminDashboard(req, res, next);
  if (req.user?.role === "teacher") return teacherDashboard(req, res, next);
  return res.status(403).json({ error: "Unsupported user role" });
});

export default router;