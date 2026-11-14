-- Jace Live: site-wide settings the site owner changes (like the site theme).

create table if not exists site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table site_settings enable row level security;
grant select, insert, update, delete on site_settings to service_role;
