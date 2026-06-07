BEGIN;

INSERT INTO academic_years (name, start_date, end_date, is_current)
VALUES ('2025-2026', '2025-08-01', '2026-07-31', TRUE)
ON CONFLICT (name) DO UPDATE
SET start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    is_current = TRUE;

UPDATE academic_years
SET is_current = CASE WHEN name = '2025-2026' THEN TRUE ELSE FALSE END
WHERE is_current IS DISTINCT FROM CASE WHEN name = '2025-2026' THEN TRUE ELSE FALSE END;

UPDATE students
SET academic_year_id = (SELECT id FROM academic_years WHERE name = '2025-2026')
WHERE academic_year_id IS DISTINCT FROM (SELECT id FROM academic_years WHERE name = '2025-2026');

SELECT
  (SELECT id FROM academic_years WHERE name = '2025-2026') AS academic_year_id,
  (SELECT COUNT(*) FROM students WHERE academic_year_id = (SELECT id FROM academic_years WHERE name = '2025-2026')) AS assigned_students,
  (SELECT COUNT(*) FROM students) AS total_students;

COMMIT;