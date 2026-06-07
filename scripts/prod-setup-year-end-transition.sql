BEGIN;

INSERT INTO academic_years (name, start_date, end_date, is_current)
VALUES
  ('2024-2025', '2024-08-01', '2025-07-31', FALSE),
  ('2025-2026', '2025-08-01', '2026-07-31', TRUE),
  ('2026-2027', '2026-08-01', '2027-07-31', FALSE),
  ('2027-2028', '2027-08-01', '2028-07-31', FALSE),
  ('2028-2029', '2028-08-01', '2029-07-31', FALSE),
  ('2029-2030', '2029-08-01', '2030-07-31', FALSE),
  ('2030-2031', '2030-08-01', '2031-07-31', FALSE),
  ('2031-2032', '2031-08-01', '2032-07-31', FALSE),
  ('2032-2033', '2032-08-01', '2033-07-31', FALSE),
  ('2033-2034', '2033-08-01', '2034-07-31', FALSE),
  ('2034-2035', '2034-08-01', '2035-07-31', FALSE)
ON CONFLICT (name) DO UPDATE
SET start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date;

UPDATE academic_years
SET is_current = CASE WHEN name = '2025-2026' THEN TRUE ELSE FALSE END
WHERE is_current IS DISTINCT FROM CASE WHEN name = '2025-2026' THEN TRUE ELSE FALSE END;

UPDATE students
SET academic_year_id = (SELECT id FROM academic_years WHERE name = '2025-2026')
WHERE academic_year_id IS DISTINCT FROM (SELECT id FROM academic_years WHERE name = '2025-2026');

UPDATE classes
SET academic_year_id = (SELECT id FROM academic_years WHERE name = '2025-2026')
WHERE academic_year_id IS DISTINCT FROM (SELECT id FROM academic_years WHERE name = '2025-2026');

COMMIT;
