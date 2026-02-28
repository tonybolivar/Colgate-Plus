create table public.syllabi (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  course_id uuid references public.courses(id) on delete cascade not null,
  file_path text,
  moodle_file_url text,
  parsed_at timestamptz,
  raw_claude_response jsonb,
  created_at timestamptz default now()
);

alter table public.syllabi enable row level security;

create policy "Users can only access their own syllabi"
  on public.syllabi for all
  using (auth.uid() = user_id);
