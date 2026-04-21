-- Set default password for all current teacher accounts during deployment.
-- Default password: 123456
-- Login for teachers uses phone or email.
--
-- This script is idempotent:
-- - Existing teacher-linked users get password_hash reset to the default.
-- - Missing teacher users are created when the teacher has a phone or email.
-- - Manager accounts are not changed.

BEGIN;

WITH teacher_accounts AS (
  SELECT
    t.id AS teacher_id,
    NULLIF(TRIM(t.email), '') AS email,
    NULLIF(REGEXP_REPLACE(TRIM(COALESCE(t.phone, '')), '[\s().-]', '', 'g'), '') AS phone,
    COALESCE(NULLIF(TRIM(t.name), ''), 'Teacher') AS name
  FROM teachers t
)
UPDATE users u
SET
  password_hash = '$2b$10$tF7FYBNDum.2Go2.yb1uc.YwND8gqU5n0AjfC1YrdeE79EnUcLZPm',
  role = 'teacher',
  name = ta.name
FROM teacher_accounts ta
WHERE u.teacher_id = ta.teacher_id
  AND u.role = 'teacher';

WITH teacher_accounts AS (
  SELECT
    t.id AS teacher_id,
    NULLIF(TRIM(t.email), '') AS email,
    NULLIF(REGEXP_REPLACE(TRIM(COALESCE(t.phone, '')), '[\s().-]', '', 'g'), '') AS phone,
    COALESCE(NULLIF(TRIM(t.name), ''), 'Teacher') AS name
  FROM teachers t
)
INSERT INTO users (email, phone, password_hash, role, name, teacher_id)
SELECT
  ta.email,
  COALESCE(ta.phone, ''),
  '$2b$10$tF7FYBNDum.2Go2.yb1uc.YwND8gqU5n0AjfC1YrdeE79EnUcLZPm',
  'teacher',
  ta.name,
  ta.teacher_id
FROM teacher_accounts ta
WHERE (ta.phone IS NOT NULL OR ta.email IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.teacher_id = ta.teacher_id
  )
  AND (
    ta.phone IS NULL
    OR NOT EXISTS (SELECT 1 FROM users u WHERE u.phone = ta.phone)
  )
  AND (
    ta.email IS NULL
    OR NOT EXISTS (SELECT 1 FROM users u WHERE u.email = ta.email)
  );

COMMIT;
