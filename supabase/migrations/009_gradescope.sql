-- Rename moodle_url → external_url (used for both Moodle + Gradescope links)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'moodle_url'
  ) THEN
    ALTER TABLE public.assignments RENAME COLUMN moodle_url TO external_url;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'external_url'
  ) THEN
    ALTER TABLE public.assignments ADD COLUMN external_url text;
  END IF;
END $$;

-- Gradescope credentials on users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS gradescope_password_encrypted text,
  ADD COLUMN IF NOT EXISTS gradescope_password_iv text,
  ADD COLUMN IF NOT EXISTS gradescope_connected boolean DEFAULT false;

-- Gradescope course ID on courses (for linking after first match)
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS gradescope_course_id text;
