-- Jace Live: each person's own settings (their theme, special modes…), so they follow them to any device.

create table if not exists user_prefs (
  user_id text primary key,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table user_prefs enable row level security;
grant select, insert, update, delete on user_prefs to service_role;
