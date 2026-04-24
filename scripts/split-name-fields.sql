-- Split current full names into two fields:
-- - last_name: "ho" = everything before the final word
-- - first_name: "ten" = the final word
--
-- Example:
--   "Nguyen Van An" -> last_name = "Nguyen Van", first_name = "An"
--   "An"            -> last_name = "", first_name = "An"
--
-- Run from backend:
--   node src/run-sql-file.js ../scripts/split-name-fields.sql

BEGIN;

ALTER TABLE students ADD COLUMN IF NOT EXISTS last_name TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS first_name TEXT DEFAULT '';

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS last_name TEXT DEFAULT '';
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS first_name TEXT DEFAULT '';

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT DEFAULT '';

WITH normalized AS (
  SELECT
    id,
    regexp_replace(trim(coalesce(name, '')), '\s+', ' ', 'g') AS full_name
  FROM students
)
UPDATE students s
SET
  last_name = CASE
    WHEN n.full_name = '' THEN ''
    WHEN position(' ' IN n.full_name) = 0 THEN ''
    ELSE regexp_replace(n.full_name, '\s+\S+$', '')
  END,
  first_name = CASE
    WHEN n.full_name = '' THEN ''
    ELSE regexp_replace(n.full_name, '^.*\s+', '')
  END
FROM normalized n
WHERE s.id = n.id;

WITH normalized AS (
  SELECT
    id,
    regexp_replace(trim(coalesce(name, '')), '\s+', ' ', 'g') AS full_name
  FROM teachers
)
UPDATE teachers t
SET
  last_name = CASE
    WHEN n.full_name = '' THEN ''
    WHEN position(' ' IN n.full_name) = 0 THEN ''
    ELSE regexp_replace(n.full_name, '\s+\S+$', '')
  END,
  first_name = CASE
    WHEN n.full_name = '' THEN ''
    ELSE regexp_replace(n.full_name, '^.*\s+', '')
  END
FROM normalized n
WHERE t.id = n.id;

WITH normalized AS (
  SELECT
    id,
    regexp_replace(trim(coalesce(name, '')), '\s+', ' ', 'g') AS full_name
  FROM users
)
UPDATE users u
SET
  last_name = CASE
    WHEN n.full_name = '' THEN ''
    WHEN position(' ' IN n.full_name) = 0 THEN ''
    ELSE regexp_replace(n.full_name, '\s+\S+$', '')
  END,
  first_name = CASE
    WHEN n.full_name = '' THEN ''
    ELSE regexp_replace(n.full_name, '^.*\s+', '')
  END
FROM normalized n
WHERE u.id = n.id;

COMMIT;

SELECT 'students' AS table_name, id, name, last_name, first_name
FROM students
ORDER BY id
LIMIT 20;

SELECT 'teachers' AS table_name, id, name, last_name, first_name
FROM teachers
ORDER BY id
LIMIT 20;

SELECT 'users' AS table_name, id, name, last_name, first_name
FROM users
ORDER BY id
LIMIT 20;
