-- Jace Live: game replays (kept 30 days). Anyone with the link can watch; the host's screen saves it when the game ends.
create table if not exists live_replays (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  host_id text not null,
  mode text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists live_replays_expires_idx on live_replays (expires_at);

alter table live_replays enable row level security;
grant select, insert, update, delete on live_replays to service_role;
