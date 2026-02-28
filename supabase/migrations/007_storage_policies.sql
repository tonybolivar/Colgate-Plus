-- Create the syllabi bucket if it doesn't exist
insert into storage.buckets (id, name, public)
  values ('syllabi', 'syllabi', false)
  on conflict (id) do nothing;

-- Users can upload to their own folder: syllabi/{user_id}/...
create policy "Users can upload their own syllabi"
  on storage.objects for insert
  with check (
    bucket_id = 'syllabi' and
    auth.uid()::text = (string_to_array(name, '/'))[2]
  );

-- Users can read their own syllabi
create policy "Users can read their own syllabi"
  on storage.objects for select
  using (
    bucket_id = 'syllabi' and
    auth.uid()::text = (string_to_array(name, '/'))[2]
  );

-- Users can replace (upsert) their own syllabi
create policy "Users can update their own syllabi"
  on storage.objects for update
  using (
    bucket_id = 'syllabi' and
    auth.uid()::text = (string_to_array(name, '/'))[2]
  );

-- Users can delete their own syllabi
create policy "Users can delete their own syllabi"
  on storage.objects for delete
  using (
    bucket_id = 'syllabi' and
    auth.uid()::text = (string_to_array(name, '/'))[2]
  );
