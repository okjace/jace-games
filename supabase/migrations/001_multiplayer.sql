-- Jace Games multiplayer: rooms, the people in them, and match results.
-- Like Jace Social, every table has row-level security on and no policies,
-- so only the server (secret key) can read or write. Players go through
-- Jace Games' /api/rooms routes.
--
-- Everything lives in its own schema, jace_games, so Jace Games can share a
-- Supabase project with Jace without touching its tables. Add jace_games to
-- Settings → Data API → Exposed schemas so the server can reach it.
create schema if not exists jace_games;
set search_path to jace_games, public;

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                      -- what people type or share: /r/<code>
  game text not null,                             -- a lib/games.ts id, or "c:<community game id>"
  mode text not null check (mode in ('race', 'turns', 'live')),
  host text not null,                             -- Jace user id
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'done')),
  seed bigint not null,
  state jsonb,                                    -- the authoritative game state for turn-based games
  version integer not null default 0,             -- bumped on every change; moves must name the version they saw
  channel text not null,                          -- secret Realtime topic, only given to members
  min_players integer not null,
  max_players integer not null,
  settings jsonb not null default '{}'::jsonb,
  deadline timestamptz,                           -- races with a time limit end here
  outcome jsonb,                                  -- placements when done
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index if not exists rooms_host_idx on rooms (host, created_at);
create index if not exists rooms_expires_idx on rooms (expires_at);

create table if not exists room_players (
  room_id uuid not null references rooms (id) on delete cascade,
  user_id text not null,
  username text not null,
  picture text,
  seat integer not null,
  ready boolean not null default false,
  left_at timestamptz,
  result jsonb,                                   -- races: { score, durationMs } or { dnf: true }
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create unique index if not exists room_players_seat_idx on room_players (room_id, seat);

create table if not exists match_results (
  id uuid primary key default gen_random_uuid(),
  room_id uuid,
  game text not null,
  user_id text not null,
  username text not null,
  placement integer not null,                     -- 1 = won (ties share a placement)
  players integer not null,
  won boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists match_results_game_idx on match_results (game, won);
create index if not exists match_results_user_idx on match_results (user_id);

alter table rooms enable row level security;
alter table room_players enable row level security;
alter table match_results enable row level security;

-- Only the server's secret key (service_role) can use the schema. anon and
-- authenticated get nothing, so the browser can't reach these tables even
-- with the publishable key, on top of RLS being on with no policies.
grant usage on schema jace_games to service_role;
grant all on all tables in schema jace_games to service_role;
grant all on all sequences in schema jace_games to service_role;
