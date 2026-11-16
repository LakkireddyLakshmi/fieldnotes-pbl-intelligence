CREATE TABLE IF NOT EXISTS grants (
  grant_id text PRIMARY KEY,
  donor text NOT NULL,
  grant_name text NOT NULL,
  period_start text,
  period_end text,
  covered_districts text
);

CREATE TABLE IF NOT EXISTS pbl_responses (
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  school_code text NOT NULL,
  school_name text NOT NULL,
  district text NOT NULL,
  block text NOT NULL,
  participated boolean NOT NULL,
  evidence boolean NOT NULL,
  classes smallint[] NOT NULL DEFAULT '{}',
  subjects text[] NOT NULL DEFAULT '{}',
  enrollment integer[] NOT NULL CHECK (array_length(enrollment, 1) = 3),
  math_attendance integer[] NOT NULL CHECK (array_length(math_attendance, 1) = 3),
  science_attendance integer[] NOT NULL CHECK (array_length(science_attendance, 1) = 3),
  PRIMARY KEY (month, school_code),
  CHECK (enrollment[1] >= 0 AND enrollment[2] >= 0 AND enrollment[3] >= 0),
  CHECK (math_attendance[1] >= 0 AND math_attendance[2] >= 0 AND math_attendance[3] >= 0),
  CHECK (science_attendance[1] >= 0 AND science_attendance[2] >= 0 AND science_attendance[3] >= 0)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'pbl_responses_month_geo_idx') THEN
    EXECUTE 'CREATE INDEX pbl_responses_month_geo_idx ON pbl_responses (month, district, block)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'pbl_responses_subjects_idx') THEN
    EXECUTE 'CREATE INDEX pbl_responses_subjects_idx ON pbl_responses USING GIN (subjects)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'pbl_responses_classes_idx') THEN
    EXECUTE 'CREATE INDEX pbl_responses_classes_idx ON pbl_responses USING GIN (classes)';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS auth_users (
  id bigserial PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'analyst', 'viewer')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash text PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id);

CREATE TABLE IF NOT EXISTS follow_up_actions (
  id bigserial PRIMARY KEY,
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  district text NOT NULL DEFAULT 'all',
  block text NOT NULL DEFAULT 'all',
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  detail text NOT NULL CHECK (length(trim(detail)) BETWEEN 1 AND 1200),
  owner text NOT NULL CHECK (length(trim(owner)) BETWEEN 1 AND 120),
  priority text NOT NULL CHECK (priority IN ('On Track', 'Behind', 'At Risk', 'Critical', 'No data')),
  metric text NOT NULL CHECK (length(trim(metric)) BETWEEN 1 AND 160),
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'In Progress', 'Complete')),
  created_by bigint NOT NULL REFERENCES auth_users (id),
  updated_by bigint NOT NULL REFERENCES auth_users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS follow_up_actions_month_due_idx ON follow_up_actions (month, due_date, id);

CREATE TABLE IF NOT EXISTS grant_finance (
  grant_id text NOT NULL REFERENCES grants (grant_id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  budget_line text NOT NULL,
  approved_budget numeric(14, 2) NOT NULL CHECK (approved_budget >= 0),
  monthly_utilized numeric(14, 2) NOT NULL CHECK (monthly_utilized >= 0),
  cumulative_utilized numeric(14, 2) NOT NULL CHECK (cumulative_utilized >= 0),
  source_utilization_rate numeric(8, 6),
  finance_note text NOT NULL DEFAULT '',
  PRIMARY KEY (grant_id, month, budget_line)
);

CREATE TABLE IF NOT EXISTS grant_performance (
  grant_id text NOT NULL REFERENCES grants (grant_id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  period_end text,
  report_due text,
  report_status text NOT NULL,
  sampled integer NOT NULL CHECK (sampled >= 0),
  completed integer NOT NULL CHECK (completed >= 0),
  completion_rate numeric(8, 6),
  evidence_count integer NOT NULL CHECK (evidence_count >= 0),
  evidence_rate numeric(8, 6),
  enrollment integer NOT NULL CHECK (enrollment >= 0),
  attendance integer NOT NULL CHECK (attendance >= 0),
  attendance_rate numeric(8, 6),
  source_risk text NOT NULL,
  milestones text NOT NULL DEFAULT '',
  draft_report text NOT NULL DEFAULT '',
  PRIMARY KEY (grant_id, month)
);

CREATE TABLE IF NOT EXISTS grant_media (
  record_id text PRIMARY KEY,
  grant_id text NOT NULL REFERENCES grants (grant_id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  record_type text NOT NULL,
  district text NOT NULL,
  title text NOT NULL,
  caption text NOT NULL,
  file_name text NOT NULL,
  relative_path text NOT NULL,
  usage_note text NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'grant_media_selection_idx') THEN
    EXECUTE 'CREATE INDEX grant_media_selection_idx ON grant_media (grant_id, month)';
  END IF;
END
$$;
