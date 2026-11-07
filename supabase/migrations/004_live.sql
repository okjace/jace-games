-- Jace Games Live: question sets people make, and live games hosted from
-- them (or with no set at all). Same rules as the other migrations: row-
-- level security on and no policies, so only the server (secret key) can
-- read or write. Everyone goes through /api/live.

create table if not exists live_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,                          -- Jace user id
  owner_name text not null,
  title text not null,
  description text not null default '',
  cover text not null default '❓',                 -- one emoji
  tags text[] not null default '{}',
  visibility text not null default 'private' check (visibility in ('public', 'unlisted', 'private')),
  questions jsonb not null default '[]'::jsonb,    -- see lib/live/types.ts
  plays integer not null default 0,
  removed boolean not null default false,          -- taken down by the site owner
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_sets_owner_idx on live_sets (owner_id, updated_at desc);
create index if not exists live_sets_discover_idx on live_sets (visibility, removed, plays desc);

create table if not exists live_games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- 6 digits, what players type
  host_id text not null,
  host_name text not null,
  set_id uuid references live_sets (id) on delete set null,
  set_title text,
  questions jsonb,                                 -- a snapshot of the set when the game was made
  mode text not null check (mode in ('classic', 'gold', 'rocket')),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'ended')),
  settings jsonb not null default '{}'::jsonb,
  state jsonb not null default '{}'::jsonb,        -- phase, current question, deadlines
  version integer not null default 0,
  channel text not null,                           -- secret Realtime topic, given to joined players
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  expires_at timestamptz not null default now() + interval '12 hours'
);
create index if not exists live_games_host_idx on live_games (host_id, created_at);
create index if not exists live_games_expires_idx on live_games (expires_at);

create table if not exists live_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references live_games (id) on delete cascade,
  name text not null,
  user_id text,                                    -- Jace user id when signed in, else null (guest)
  token_hash text not null,                        -- sha256 of the player's secret token
  score bigint not null default 0,                 -- points, gold, or rocket progress
  streak integer not null default 0,
  correct integer not null default 0,
  answered integer not null default 0,
  data jsonb not null default '{}'::jsonb,         -- mode details (current question, chests, answers)
  joined_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index if not exists live_players_name_idx on live_players (game_id, lower(name));
create index if not exists live_players_game_idx on live_players (game_id, score desc);

alter table live_sets enable row level security;
alter table live_games enable row level security;
alter table live_players enable row level security;

grant select, insert, update, delete on live_sets, live_games, live_players to service_role;

create or replace function live_set_add_play(set_id uuid) returns void language sql as $$
  update live_sets set plays = plays + 1 where id = set_id;
$$;
grant execute on function live_set_add_play(uuid) to service_role;
