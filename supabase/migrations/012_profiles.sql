-- Jace Games profiles: the display name someone picks (see lib/profile.ts).
-- The username always comes from Jace; this only holds what people add here.

create table if not exists profiles (
  user_id text primary key,                         -- Jace user id
  display_name text not null default '',
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
grant select, insert, update, delete on profiles to service_role;

-- Lockers remember the username, so the site owner can find people to give XP.
alter table live_lockers add column if not exists username text;
create index if not exists live_lockers_username_idx on live_lockers (lower(username));

-- More locker rewards: a title shown under your name, and the daily first-game XP bonus.
alter table live_lockers add column if not exists title text not null default '';
alter table live_lockers add column if not exists last_daily date;
