create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  moodle_course_id int not null,
  name text not null,
  short_name text,
  color text default '#821C24',
  syllabus_parsed boolean default false,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, moodle_course_id)
);

alter table public.courses enable row level security;

create policy "Users can only access their own courses"
  on public.courses for all
  using (auth.uid() = user_id);
