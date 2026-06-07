import { Router } from "express";
import { pool, mapStudentRow, normalizeDateInput, normalizeStudentStatus } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

const EXECUTE_THRESHOLD = 100;
const VALID_ACTIONS = new Set(["transfer", "status"]);
const TRANSITION_STATUSES = new Set(["graduated", "inactive", "leave"]);

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeId(value, field) {
  if (value == null || value === "") return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) return { error: `${field} must be a positive integer` };
  return id;
}

function normalizeIds(value) {
  if (!Array.isArray(value)) return { error: "studentIds must be an array" };
  const ids = [];
  for (const raw of value) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) return { error: "studentIds must contain positive integers" };
    if (!ids.includes(id)) ids.push(id);
  }
  if (!ids.length) return { error: "Select at least one student" };
  return ids;
}

function sameNullableNumber(left, right) {
  const a = left == null ? null : Number(left);
  const b = right == null ? null : Number(right);
  return a === b;
}

function ageMonthsOn(dateOfBirth, effectiveDate) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const eff = new Date(effectiveDate);
  if (Number.isNaN(dob.getTime()) || Number.isNaN(eff.getTime())) return null;
  let months = (eff.getFullYear() - dob.getFullYear()) * 12 + (eff.getMonth() - dob.getMonth());
  if (eff.getDate() < dob.getDate()) months -= 1;
  return Math.max(months, 0);
}

function ageRangeForLevel(level) {
  const text = cleanText(level).toLowerCase();
  const digit = text.match(/\d+/)?.[0];
  if (digit) {
    const age = Number(digit);
    if (age >= 1 && age <= 6) return { min: age * 12, max: age * 12 + 11 };
  }
  if (text.includes("nha tre") || text.includes("nhà trẻ")) return { min: 18, max: 35 };
  if (text.includes("mam") || text.includes("mầm")) return { min: 36, max: 47 };
  if (text.includes("choi") || text.includes("chồi")) return { min: 48, max: 59 };
  if (text.includes("la") || text.includes("lá")) return { min: 60, max: 71 };
  return { min: null, max: null };
}

function mapYear(row) {
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
    maxStudents: row.max_students != null ? Number(row.max_students) : 35,
    minAgeMonths: row.min_age_months != null ? Number(row.min_age_months) : null,
    maxAgeMonths: row.max_age_months != null ? Number(row.max_age_months) : null,
    currentStudents: row.current_students != null ? Number(row.current_students) : 0,
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

  const seeds = [];
  for (let startYear = currentStartYear - 1; startYear <= 2035; startYear += 1) {
    seeds.push({
      name: `${startYear}-${startYear + 1}`,
      start: `${startYear}-08-01`,
      end: `${startYear + 1}-07-31`,
      isCurrent: startYear === currentStartYear,
    });
  }

  for (const seed of seeds) {
    await pool.query(
      `INSERT INTO academic_years (name, start_date, end_date, is_current)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO NOTHING`,
      [seed.name, seed.start, seed.end, seed.isCurrent]
    );
  }
}

async function buildPreview(studentIds, action, config, effectiveDate) {
  const studentResult = await pool.query(
    `SELECT s.id, s.name, s.last_name, s.first_name, s.grade, s.email, s.date_of_birth,
            s.class_id, s.academic_year_id, s.avatar, s.join_date, s.status, s.gender,
            c.name AS class_name, c.level AS class_level, ay.name AS academic_year_name
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_id
     LEFT JOIN academic_years ay ON ay.id = s.academic_year_id
     WHERE s.id = ANY($1::int[])
     ORDER BY s.name, s.id`,
    [studentIds]
  );
  if (studentResult.rowCount !== studentIds.length) {
    return { error: "One or more students were not found" };
  }

  let targetClass = null;
  let targetYear = null;
  if (action === "transfer") {
    const targetClassId = normalizeId(config.targetClassId, "targetClassId");
    if (targetClassId && targetClassId.error) return { error: targetClassId.error };
    if (!targetClassId) return { error: "targetClassId is required" };
    const classResult = await pool.query(
      `SELECT c.id, c.name, c.level, c.academic_year_id, c.max_students, c.min_age_months, c.max_age_months,
              COUNT(s.id) FILTER (WHERE COALESCE(s.status, 'active') IN ('active', 'leave')) AS current_students
       FROM classes c
       LEFT JOIN students s ON s.class_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [targetClassId]
    );
    if (!classResult.rowCount) return { error: "Target class not found" };
    targetClass = mapClassOption(classResult.rows[0]);

    const targetYearId = normalizeId(config.targetAcademicYearId ?? targetClass.academicYearId, "targetAcademicYearId");
    if (targetYearId && targetYearId.error) return { error: targetYearId.error };
    if (targetYearId) {
      const yearResult = await pool.query(`SELECT * FROM academic_years WHERE id = $1`, [targetYearId]);
      if (!yearResult.rowCount) return { error: "Target academic year not found" };
      targetYear = mapYear(yearResult.rows[0]);
    }
  }

  let nextStatus = null;
  if (action === "status") {
    nextStatus = normalizeStudentStatus(config.status);
    if (typeof nextStatus === "object" && nextStatus.error) return { error: nextStatus.error };
    if (!TRANSITION_STATUSES.has(nextStatus)) return { error: "status must be graduated, inactive, or leave" };
  }

  const ageRange = targetClass
    ? {
        min: targetClass.minAgeMonths ?? ageRangeForLevel(targetClass.level).min,
        max: targetClass.maxAgeMonths ?? ageRangeForLevel(targetClass.level).max,
      }
    : { min: null, max: null };

  const items = studentResult.rows.map((row) => {
    const ageMonths = ageMonthsOn(row.date_of_birth, effectiveDate);
    const warnings = [];
    const errors = [];
    if (targetClass && ageMonths != null && ageRange.min != null && ageMonths < ageRange.min) {
      warnings.push("Học sinh nhỏ hơn độ tuổi khối mới");
    }
    if (targetClass && ageMonths != null && ageRange.max != null && ageMonths > ageRange.max) {
      warnings.push("Học sinh lớn hơn độ tuổi khối mới");
    }
    return {
      student: mapStudentRow(row),
      before: {
        academicYearId: row.academic_year_id != null ? Number(row.academic_year_id) : null,
        academicYearName: row.academic_year_name ?? "",
        classId: row.class_id != null ? Number(row.class_id) : null,
        className: row.class_name ?? "",
        status: row.status ?? "active",
      },
      after:
        action === "transfer"
          ? {
              academicYearId: targetYear?.id ?? targetClass.academicYearId,
              academicYearName: targetYear?.name ?? "",
              classId: targetClass.id,
              className: targetClass.name,
              status: row.status ?? "active",
            }
          : {
              academicYearId: row.academic_year_id != null ? Number(row.academic_year_id) : null,
              academicYearName: row.academic_year_name ?? "",
              classId: row.class_id != null ? Number(row.class_id) : null,
              className: row.class_name ?? "",
              status: nextStatus,
            },
      ageMonths,
      warnings,
      errors,
    };
  });

  return {
    summary: {
      total: items.length,
      errors: items.reduce((sum, item) => sum + item.errors.length, 0),
      warnings: items.reduce((sum, item) => sum + item.warnings.length, 0),
      targetClass,
      targetAcademicYear: targetYear,
    },
    items,
  };
}

async function applyTransition(studentIds, action, config, effectiveDate, note, client = pool) {
  const preview = await buildPreview(studentIds, action, config, effectiveDate);
  if (preview.error) return { error: preview.error };
  if (preview.summary.errors > 0) return { error: "Validation failed", preview };

  const targetClassId = action === "transfer" ? Number(config.targetClassId) : null;
  const targetYearId =
    action === "transfer"
      ? Number(config.targetAcademicYearId || preview.summary.targetClass?.academicYearId || 0) || null
      : null;
  const nextStatus = action === "status" ? normalizeStudentStatus(config.status) : null;

  await client.query("BEGIN");
  try {
    const rows = await client.query(
      `SELECT id, class_id, academic_year_id, status FROM students WHERE id = ANY($1::int[]) FOR UPDATE`,
      [studentIds]
    );
    for (const row of rows.rows) {
      if (action === "transfer") {
        const classChanged = !sameNullableNumber(row.class_id, targetClassId);
        const academicYearChanged = !sameNullableNumber(row.academic_year_id, targetYearId);
        if (!classChanged && !academicYearChanged) {
          continue;
        }
        await client.query(
          `INSERT INTO student_class_history (
             student_id, from_class_id, to_class_id, from_academic_year_id, to_academic_year_id,
             effective_date, note, action, from_status, to_status
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'transfer', $8, $9)`,
          [
            row.id,
            row.class_id,
            targetClassId,
            row.academic_year_id,
            targetYearId,
            effectiveDate,
            note,
            row.status ?? "active",
            row.status ?? "active",
          ]
        );
        await client.query(
          `UPDATE students SET class_id = $1, academic_year_id = $2 WHERE id = $3`,
          [targetClassId, targetYearId, row.id]
        );
      } else {
        if ((row.status ?? "active") === nextStatus) {
          continue;
        }
        await client.query(
          `INSERT INTO student_class_history (
             student_id, from_class_id, to_class_id, from_academic_year_id, to_academic_year_id,
             effective_date, note, action, from_status, to_status
           )
           VALUES ($1, $2, $2, $3, $3, $4, $5, 'status_update', $6, $7)`,
          [row.id, row.class_id, row.academic_year_id, effectiveDate, note, row.status ?? "active", nextStatus]
        );
        await client.query(`UPDATE students SET status = $1 WHERE id = $2`, [nextStatus, row.id]);
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  }

  return { processed: studentIds.length, preview };
}

async function runJob(jobId) {
  const client = await pool.connect();
  try {
    const jobResult = await pool.query(`SELECT * FROM student_bulk_jobs WHERE id = $1`, [jobId]);
    if (!jobResult.rowCount) return;
    const job = jobResult.rows[0];
    const payload = job.payload || {};
    await pool.query(`UPDATE student_bulk_jobs SET status = 'running', started_at = NOW() WHERE id = $1`, [jobId]);
    const ids = payload.studentIds || [];
    let success = 0;
    let failed = 0;
    for (let i = 0; i < ids.length; i += 25) {
      const chunk = ids.slice(i, i + 25);
      const result = await applyTransition(
        chunk,
        payload.action,
        payload.config,
        payload.effectiveDate,
        payload.note,
        client
      );
      if (result.error) {
        failed += chunk.length;
      } else {
        success += chunk.length;
      }
      await pool.query(
        `UPDATE student_bulk_jobs
         SET processed_count = $2, success_count = $3, failed_count = $4
         WHERE id = $1`,
        [jobId, Math.min(i + chunk.length, ids.length), success, failed]
      );
    }
    await pool.query(
      `UPDATE student_bulk_jobs
       SET status = $2, completed_at = NOW(), error_message = $3
       WHERE id = $1`,
      [jobId, failed ? "failed" : "completed", failed ? "Some students failed validation during background processing" : ""]
    );
  } catch (e) {
    await pool.query(
      `UPDATE student_bulk_jobs
       SET status = 'failed', completed_at = NOW(), error_message = $2
       WHERE id = $1`,
      [jobId, "Background job failed"]
    ).catch(() => {});
  } finally {
    client.release();
  }
}

router.use(requireAdmin);

router.get("/metadata", async (_req, res, next) => {
  try {
    await ensureAcademicYearsSeeded();
    const [years, classes] = await Promise.all([
      pool.query(`SELECT * FROM academic_years ORDER BY start_date NULLS LAST, name`),
      pool.query(
        `SELECT c.id, c.name, c.level, c.academic_year_id, c.max_students, c.min_age_months, c.max_age_months,
                COUNT(s.id) FILTER (WHERE COALESCE(s.status, 'active') IN ('active', 'leave')) AS current_students
         FROM classes c
         LEFT JOIN students s ON s.class_id = c.id
         GROUP BY c.id
         ORDER BY c.name, c.id`
      ),
    ]);
    res.json({ academicYears: years.rows.map(mapYear), classes: classes.rows.map(mapClassOption) });
  } catch (e) {
    next(e);
  }
});

router.get("/students", async (req, res, next) => {
  try {
    const params = [];
    const where = [];
    const classId = normalizeId(req.query.classId, "classId");
    if (classId?.error) return res.status(400).json({ error: classId.error });
    const academicYearId = normalizeId(req.query.academicYearId, "academicYearId");
    if (academicYearId?.error) return res.status(400).json({ error: academicYearId.error });
    if (academicYearId) {
      params.push(academicYearId);
      where.push(`s.academic_year_id = $${params.length}`);
    }
    if (classId) {
      params.push(classId);
      where.push(`s.class_id = $${params.length}`);
    }
    if (req.query.status) {
      const statuses = String(req.query.status).split(",").map((s) => s.trim()).filter(Boolean);
      if (statuses.length) {
        params.push(statuses);
        where.push(`COALESCE(s.status, 'active') = ANY($${params.length}::text[])`);
      }
    }
    const result = await pool.query(
      `SELECT s.id, s.name, s.last_name, s.first_name, s.grade, s.email, s.date_of_birth, s.class_id,
              s.avatar, s.join_date, s.status, s.gender,
              c.name AS class_name
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY s.name, s.id`,
      params
    );
    res.json(result.rows.map(mapStudentRow));
  } catch (e) {
    next(e);
  }
});

router.post("/preview", async (req, res, next) => {
  try {
    const ids = normalizeIds(req.body?.studentIds);
    if (ids.error) return res.status(400).json({ error: ids.error });
    const action = cleanText(req.body?.action);
    if (!VALID_ACTIONS.has(action)) return res.status(400).json({ error: "action must be transfer or status" });
    const effectiveDate = normalizeDateInput(req.body?.effectiveDate) || new Date().toISOString().slice(0, 10);
    const preview = await buildPreview(ids, action, req.body?.config || {}, effectiveDate);
    if (preview.error) return res.status(400).json({ error: preview.error });
    res.json(preview);
  } catch (e) {
    next(e);
  }
});

router.post("/execute", async (req, res, next) => {
  try {
    const ids = normalizeIds(req.body?.studentIds);
    if (ids.error) return res.status(400).json({ error: ids.error });
    const action = cleanText(req.body?.action);
    if (!VALID_ACTIONS.has(action)) return res.status(400).json({ error: "action must be transfer or status" });
    const effectiveDate = normalizeDateInput(req.body?.effectiveDate) || new Date().toISOString().slice(0, 10);
    const note = cleanText(req.body?.note).slice(0, 2000);

    if (ids.length > EXECUTE_THRESHOLD) {
      const preview = await buildPreview(ids, action, req.body?.config || {}, effectiveDate);
      if (preview.error) return res.status(400).json({ error: preview.error });
      if (preview.summary.errors > 0) return res.status(400).json({ error: "Validation failed", preview });
      const job = await pool.query(
        `INSERT INTO student_bulk_jobs (job_type, total_count, payload, created_by_user_id)
         VALUES ('year_end_transition', $1, $2::jsonb, $3)
         RETURNING id, status, total_count, processed_count, success_count, failed_count`,
        [ids.length, JSON.stringify({ studentIds: ids, action, config: req.body?.config || {}, effectiveDate, note }), req.user.id]
      );
      setTimeout(() => runJob(job.rows[0].id), 0);
      return res.status(202).json({ mode: "background", job: job.rows[0] });
    }

    const result = await applyTransition(ids, action, req.body?.config || {}, effectiveDate, note);
    if (result.error) return res.status(400).json({ error: result.error, preview: result.preview });
    res.json({ mode: "sync", processed: result.processed, preview: result.preview });
  } catch (e) {
    next(e);
  }
});

router.get("/jobs/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: "Job not found" });
    const result = await pool.query(
      `SELECT id, job_type, status, total_count, processed_count, success_count, failed_count,
              error_message, created_at, started_at, completed_at
       FROM student_bulk_jobs
       WHERE id = $1`,
      [id]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Job not found" });
    const row = result.rows[0];
    res.json({
      id: row.id,
      jobType: row.job_type,
      status: row.status,
      totalCount: Number(row.total_count),
      processedCount: Number(row.processed_count),
      successCount: Number(row.success_count),
      failedCount: Number(row.failed_count),
      progress: row.total_count > 0 ? Math.round((Number(row.processed_count) / Number(row.total_count)) * 100) : 0,
      errorMessage: row.error_message ?? "",
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
