CREATE TABLE IF NOT EXISTS academic_years (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_years_current
ON academic_years(is_current) WHERE is_current = TRUE;

ALTER TABLE classes ADD COLUMN IF NOT EXISTS academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS max_students INTEGER NOT NULL DEFAULT 35;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS min_age_months INTEGER;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS max_age_months INTEGER;

ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL;

ALTER TABLE student_class_history ADD COLUMN IF NOT EXISTS from_academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL;
ALTER TABLE student_class_history ADD COLUMN IF NOT EXISTS to_academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL;
ALTER TABLE student_class_history ADD COLUMN IF NOT EXISTS action VARCHAR(40) NOT NULL DEFAULT 'class_transfer';
ALTER TABLE student_class_history ADD COLUMN IF NOT EXISTS from_status VARCHAR(50) DEFAULT '';
ALTER TABLE student_class_history ADD COLUMN IF NOT EXISTS to_status VARCHAR(50) DEFAULT '';

CREATE TABLE IF NOT EXISTS student_bulk_jobs (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  total_count INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
