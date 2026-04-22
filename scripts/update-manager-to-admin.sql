-- Update existing 'manager' roles to 'admin'
-- This script should be run after updating the database constraint

BEGIN;

-- First, drop the existing constraint if it exists
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Update the users table to change 'manager' to 'admin'
UPDATE users 
SET role = 'admin' 
WHERE role = 'manager';

-- Staff accounts with role "Quản trị hệ thống" are application admins.
UPDATE users u
SET role = 'admin'
FROM teachers t
JOIN teacher_roles tr ON tr.id = t.role_id
WHERE u.teacher_id = t.id
  AND LOWER(TRIM(tr.name)) = LOWER('Quản trị hệ thống');

-- Recreate the constraint to allow 'admin', 'teacher', and 'accountant' roles
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'teacher', 'accountant'));

COMMIT;

-- Verify the changes
SELECT id, email, role, name FROM users ORDER BY role, id;
