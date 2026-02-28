create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  course_id uuid references public.courses(id) on delete cascade not null,
  title text not null,
  day_of_week int not null check (day_of_week between 0 and 6),  -- 0=Sun, 1=Mon, ..., 6=Sat
  type text not null default 'quiz' check (type in ('homework','exam','project','reading','quiz','other')),
  platform text not null default 'in-class' check (platform in ('gradescope','moodle','in-class','unknown')),
  start_date date not null,
  end_date date not null,
  created_at timestamptz default now()
);

alter table public.recurring_rules enable row level security;
create policy "Users can only access their own recurring rules"
  on public.recurring_rules for all using (auth.uid() = user_id);

-- Assignments generated from a recurring rule cascade-delete when the rule is removed
alter table public.assignments
  add column recurring_rule_id uuid references public.recurring_rules(id) on delete cascade;
