create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  course_id uuid references public.courses(id) on delete cascade not null,
  title text not null,
  due_date date,
  due_time time,
  type text check (type in ('homework','exam','project','reading','quiz','other')) default 'other',
  platform text check (platform in ('gradescope','moodle','in-class','unknown')) default 'unknown',
  points numeric,
  status text default 'pending' check (status in ('pending','submitted','graded','excused','archived')),
  source text default 'syllabus' check (source in ('syllabus','moodle','manual')),
  notes text,
  parse_confidence text check (parse_confidence in ('high','medium','low')),
  created_at timestamptz default now()
);

alter table public.assignments enable row level security;

create policy "Users can only access their own assignments"
  on public.assignments for all
  using (auth.uid() = user_id);

create index assignments_user_due on public.assignments(user_id, due_date);
create index assignments_course on public.assignments(course_id);
