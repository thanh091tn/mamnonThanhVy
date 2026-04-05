import { Router } from "express";
import {
  pool,
  mapStudentAttendanceRow,
  mapTeacherAttendanceRow,
} from "../db.js";

const router = Router();

const STUDENT_ATT_STATUSES = new Set(["present", "absent", "late", "excused"]);
const SESSIONS = new Set(["full", "morning", "afternoon"]);

function isValidDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

function todayStrLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isOnOrAfterToday(dateStr) {
  return dateStr >= todayStrLocal();
}

function datesInRange(from, to) {
  const out = [];
  const cur = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** @returns {{ from: string, to: string }} */
function calendarMonthBounds(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) {
    return { error: "year must be 2000–2100" };
  }
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    return { error: "month must be 1–12" };
  }
  const pad = (n) => String(n).padStart(2, "0");
  const from = `${y}-${pad(m)}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${pad(m)}-${pad(lastDay)}`;
  return { from, to };
}

// ---------------------------------------------------------------------------
// Student attendance
// ---------------------------------------------------------------------------

/**
 * GET /students?classId=&date=&session=full
 * Returns all students in the class with their attendance record for that day/session.
 */
router.get("/students", async (req, res, next) => {
  try {
    const { classId, date, session = "full" } = req.query;
    if (!classId) return res.status(400).json({ error: "classId is required" });
    if (!date || !isValidDate(date))
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    if (!SESSIONS.has(session))
      return res.status(400).json({ error: "session must be full, morning, or afternoon" });

    const cid = Number(classId);
    const cls = await pool.query("SELECT id FROM classes WHERE id = $1", [cid]);
    if (!cls.rowCount) return res.status(404).json({ error: "Class not found" });

    const r = await pool.query(
      `SELECT s.id   AS student_id,
              s.name AS student_name,
              s.avatar AS student_avatar,
              s.gender AS student_gender,
              sa.id,
              sa.class_id,
              sa.attendance_date,
              sa.session,
              sa.status,
              sa.note,
              sa.recorded_by_teacher_id,
              sa.created_at,
              sa.updated_at
       FROM students s
       LEFT JOIN student_attendance sa
              ON sa.student_id = s.id
             AND sa.attendance_date = $2
             AND sa.session = $3
       WHERE s.class_id = $1
         AND s.status = 'active'
       ORDER BY s.name`,
      [cid, date, session]
    );

    const rows = r.rows.map((row) => {
      const base = {
        studentAvatar: row.student_avatar || null,
        studentGender: row.student_gender || 'male',
      };
      if (row.id == null) {
        return {
          ...base,
          studentId: row.student_id,
          studentName: row.student_name,
          classId: cid,
          attendanceDate: date,
          session,
          status: null,
          note: "",
          id: null,
        };
      }
      return { ...base, ...mapStudentAttendanceRow(row) };
    });

    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /students/student/:studentId?from=&to=
 * Attendance history for a single student.
 */
router.get("/students/student/:studentId", async (req, res, next) => {
  try {
    const studentId = Number(req.params.studentId);
    const { from, to } = req.query;
    const params = [studentId];
    let dateFilter = "";
    let idx = 2;
    if (from && isValidDate(from)) {
      dateFilter += ` AND sa.attendance_date >= $${idx}`;
      params.push(from);
      idx++;
    }
    if (to && isValidDate(to)) {
      dateFilter += ` AND sa.attendance_date <= $${idx}`;
      params.push(to);
      idx++;
    }
    const r = await pool.query(
      `SELECT sa.*, s.name AS student_name
       FROM student_attendance sa
       JOIN students s ON s.id = sa.student_id
       WHERE sa.student_id = $1 ${dateFilter}
       ORDER BY sa.attendance_date DESC, sa.session`,
      params
    );
    res.json(r.rows.map(mapStudentAttendanceRow));
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /students/bulk
 * Upsert attendance for multiple students at once.
 * Body: { classId, date, session, items: [{ studentId, status, note? }] }
 */
router.put("/students/bulk", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { classId, date, session = "full", items } = req.body || {};
    if (!classId) return res.status(400).json({ error: "classId is required" });
    if (!date || !isValidDate(date))
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    if (!SESSIONS.has(session))
      return res.status(400).json({ error: "session must be full, morning, or afternoon" });
    if (!Array.isArray(items) || !items.length)
      return res.status(400).json({ error: "items array is required" });

    const cid = Number(classId);
    const cls = await client.query("SELECT id FROM classes WHERE id = $1", [cid]);
    if (!cls.rowCount) return res.status(404).json({ error: "Class not found" });

    for (const it of items) {
      if (!it.studentId) return res.status(400).json({ error: "each item needs studentId" });
      const st = String(it.status || "present").toLowerCase();
      if (!STUDENT_ATT_STATUSES.has(st))
        return res.status(400).json({ error: `Invalid status: ${it.status}` });
    }

    await client.query("BEGIN");

    const upserted = [];
    for (const it of items) {
      const st = String(it.status || "present").toLowerCase();
      const note = it.note != null ? String(it.note) : "";
      const r = await client.query(
        `INSERT INTO student_attendance
           (student_id, class_id, attendance_date, session, status, note, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (student_id, attendance_date, session)
         DO UPDATE SET status = EXCLUDED.status,
                       note = EXCLUDED.note,
                       class_id = EXCLUDED.class_id,
                       updated_at = NOW()
         RETURNING *`,
        [Number(it.studentId), cid, date, session, st, note]
      );
      upserted.push(r.rows[0]);
    }

    await client.query("COMMIT");
    res.json({ saved: upserted.length });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

/**
 * DELETE /students/record?studentId=&date=&session=full
 * Remove a single student attendance record (undo).
 */
router.delete("/students/record", async (req, res, next) => {
  try {
    const { studentId, date, session = "full" } = req.query;
    if (!studentId) return res.status(400).json({ error: "studentId is required" });
    if (!date || !isValidDate(date))
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    if (!SESSIONS.has(session))
      return res.status(400).json({ error: "session must be full, morning, or afternoon" });

    const r = await pool.query(
      `DELETE FROM student_attendance
       WHERE student_id = $1 AND attendance_date = $2 AND session = $3
       RETURNING id`,
      [Number(studentId), date, session]
    );
    res.json({ deleted: r.rowCount });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Teacher attendance
// ---------------------------------------------------------------------------

/**
 * GET /teachers/me?from=&to=
 * Logged-in teacher only: own attendance rows in range.
 */
router.get("/teachers/me", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher" || req.user.teacherId == null) {
      return res.status(403).json({ error: "Chỉ giáo viên đăng nhập mới xem được" });
    }
    const tid = req.user.teacherId;
    const { from, to } = req.query;
    const params = [tid];
    let dateFilter = "";
    let idx = 2;
    if (from && isValidDate(from)) {
      dateFilter += ` AND ta.attendance_date >= $${idx}`;
      params.push(from);
      idx++;
    }
    if (to && isValidDate(to)) {
      dateFilter += ` AND ta.attendance_date <= $${idx}`;
      params.push(to);
      idx++;
    }
    const r = await pool.query(
      `SELECT ta.*, t.name AS teacher_name
       FROM teacher_attendance ta
       JOIN teachers t ON t.id = ta.teacher_id
       WHERE ta.teacher_id = $1 ${dateFilter}
       ORDER BY ta.attendance_date ASC`,
      params
    );
    res.json(r.rows.map(mapTeacherAttendanceRow));
  } catch (e) {
    next(e);
  }
});

/**
 * POST /teachers/me/leave-request
 * Teacher registers leave in advance (today or future). Status: leave.
 */
router.post("/teachers/me/leave-request", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher" || req.user.teacherId == null) {
      return res.status(403).json({ error: "Chỉ giáo viên mới xin nghỉ được" });
    }
    const tid = req.user.teacherId;
    const { date, toDate, note } = req.body || {};
    if (!date || !isValidDate(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }
    const endDate = toDate == null || toDate === "" ? date : toDate;
    if (!isValidDate(endDate)) {
      return res.status(400).json({ error: "toDate must be YYYY-MM-DD" });
    }
    if (endDate < date) {
      return res.status(400).json({ error: "toDate must be on or after date" });
    }
    if (!isOnOrAfterToday(date)) {
      return res.status(400).json({ error: "Chỉ đăng ký nghỉ cho hôm nay hoặc ngày sau" });
    }
    const ex = await pool.query(`SELECT id FROM teachers WHERE id = $1`, [tid]);
    if (!ex.rowCount) return res.status(404).json({ error: "Teacher not found" });
    const noteStr = note != null ? String(note).trim().slice(0, 2000) : "";
    const requestedDates = datesInRange(date, endDate);
    if (requestedDates.length > 31) {
      return res.status(400).json({ error: "Chỉ được đăng ký tối đa 31 ngày mỗi lần" });
    }
    const r = await pool.query(
      `INSERT INTO teacher_attendance
         (teacher_id, attendance_date, status, note, updated_at)
       SELECT $1, d::date, 'leave', $3, NOW()
       FROM unnest($2::text[]) AS d
       ON CONFLICT (teacher_id, attendance_date)
       DO UPDATE SET status = 'leave', note = EXCLUDED.note, updated_at = NOW()
       RETURNING *`,
      [tid, requestedDates, noteStr]
    );
    const nameR = await pool.query(`SELECT name FROM teachers WHERE id = $1`, [tid]);
    res.status(201).json({
      from: date,
      to: endDate,
      count: r.rows.length,
      rows: r.rows
        .sort((a, b) => String(a.attendance_date).localeCompare(String(b.attendance_date)))
        .map((row) =>
          mapTeacherAttendanceRow({ ...row, teacher_name: nameR.rows[0]?.name ?? "" })
        ),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /teachers/me/leave-request?date=
 * Teacher cancels own leave request (only status leave, date not in the past).
 */
router.delete("/teachers/me/leave-request", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher" || req.user.teacherId == null) {
      return res.status(403).json({ error: "Chỉ giáo viên mới hủy được" });
    }
    const tid = req.user.teacherId;
    const { date } = req.query;
    if (!date || !isValidDate(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }
    if (!isOnOrAfterToday(date)) {
      return res.status(400).json({ error: "Không hủy được ngày đã qua" });
    }
    const r = await pool.query(
      `DELETE FROM teacher_attendance
       WHERE teacher_id = $1 AND attendance_date = $2 AND status = 'leave'
       RETURNING id`,
      [tid, date]
    );
    if (!r.rowCount) {
      return res.status(404).json({ error: "Không có đơn xin nghỉ phép cho ngày này" });
    }
    res.json({ deleted: true });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /teachers/leave-calendar?year=&month=
 * Manager only: all teacher leave rows in that calendar month.
 */
router.get("/teachers/leave-calendar", async (req, res, next) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({ error: "Chỉ quản lý mới xem được lịch nghỉ" });
    }
    const { year, month } = req.query;
    if (year == null || month == null) {
      return res.status(400).json({ error: "year and month are required (month 1–12)" });
    }
    const bounds = calendarMonthBounds(year, month);
    if (bounds.error) {
      return res.status(400).json({ error: bounds.error });
    }
    const { from, to } = bounds;
    const r = await pool.query(
      `SELECT ta.id,
              ta.teacher_id,
              ta.attendance_date,
              ta.status,
              ta.note,
              ta.created_at,
              ta.updated_at,
              t.name AS teacher_name
       FROM teacher_attendance ta
       JOIN teachers t ON t.id = ta.teacher_id
       WHERE ta.status = 'leave'
         AND ta.attendance_date >= $1::date
         AND ta.attendance_date <= $2::date
       ORDER BY ta.attendance_date ASC, t.name ASC`,
      [from, to]
    );
    res.json({
      year: Number(year),
      month: Number(month),
      from,
      to,
      leaves: r.rows.map(mapTeacherAttendanceRow),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
