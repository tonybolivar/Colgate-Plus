create table public.users (
  id uuid references auth.users(id) primary key,
  email text not null,
  full_name text,
  grad_year int,
  major text,
  moodle_token_encrypted text,
  moodle_token_iv text,
  onboarding_complete boolean default false,
  created_at timestamptz default now()
);

alter table public.users enable row level security;

create policy "Users can only access their own row"
  on public.users for all
  using (auth.uid() = id);

-- Auto-create user row on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
