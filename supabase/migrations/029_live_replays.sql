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

-- What each player saw on their own screen during the game (sent by their device when it ends).
create table if not exists live_replay_povs (
  replay_id uuid not null references live_replays (id) on delete cascade,
  player_id text not null,
  frames jsonb not null,
  created_at timestamptz not null default now(),
  primary key (replay_id, player_id)
);

alter table live_replay_povs enable row level security;
grant select, insert, update, delete on live_replay_povs to service_role;
