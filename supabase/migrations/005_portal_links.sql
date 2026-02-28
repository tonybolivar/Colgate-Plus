create table public.portal_links (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  url text not null,
  icon text,
  sort_order int default 0
);

alter table public.portal_links enable row level security;

-- Portal links are public read
create policy "Portal links are publicly readable"
  on public.portal_links for select
  using (true);

insert into public.portal_links (label, url, icon, sort_order) values
  ('Self-Service', 'https://banner.colgate.edu/StudentSelfService/ssb/studentProfile', 'user', 1),
  ('Degree Audit', 'https://degreeworks.colgate.edu/', 'check-square', 2),
  ('Financial Aid', 'https://finaid.colgate.edu/NetPartnerStudent', 'dollar-sign', 3),
  ('TouchNet', 'https://secure.touchnet.net/C20587_tsa/web/caslogin.jsp', 'calendar', 4),
  ('Print', 'https://pcngvm01.colgate.edu:9192/user', 'help-circle', 5);
