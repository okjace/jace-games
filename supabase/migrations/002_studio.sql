-- Jace Games Game Studio: games people make, their saved versions, their
-- (unverified) high scores, and reports. Same rules as 001: row-level
-- security on and no policies, so only the server (secret key) can read or
-- write. Everyone goes through Jace Games' /api/studio routes.
--
-- Like 001, everything lives in its own schema, jace_games, so Jace Games can share a
-- Supabase project with Jace without touching its tables. Add jace_games to
-- Settings → Data API → Exposed schemas so the server can reach it.
create schema if not exists jace_games;
set search_path to jace_games, public;

create table if not exists community_games (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,                         -- Jace user id
  owner_name text not null,
  title text not null,
  description text not null default '',
  icon text not null default '🎮',                -- one emoji
  kind text not null check (kind in ('code', 'blocks')),
  html text not null default '',                  -- the draft: a whole HTML document (for blocks, the compiled game)
  blocks_json jsonb,                              -- the Blockly workspace, for kind = 'blocks'
  published_html text,                            -- what players get: a snapshot of html taken when published
  published boolean not null default false,
  removed boolean not null default false,         -- taken down by the site owner (SITE_OWNER_JACE_ID)
  multiplayer jsonb,                              -- null, or { "mode": "race" | "live", "min": n, "max": n }
  plays integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists community_games_owner_idx on community_games (owner_id, updated_at desc);
create index if not exists community_games_published_idx on community_games (published, removed, published_at desc);

create table if not exists community_versions (
  game_id uuid not null references community_games (id) on delete cascade,
  version integer not null,
  html text not null,
  blocks_json jsonb,
  created_at timestamptz not null default now(),
  primary key (game_id, version)
);

-- Best score per player. Games report their own scores from the player's
-- browser, so these can't be checked and the UI labels them unverified.
create table if not exists community_scores (
  game_id uuid not null references community_games (id) on delete cascade,
  user_id text not null,
  username text not null,
  score bigint not null,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index if not exists community_scores_top_idx on community_scores (game_id, score desc);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references community_games (id) on delete cascade,
  reporter_id text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (game_id, reporter_id)
);

-- Counting plays in one statement, so two at once can't lose one.
create or replace function community_add_play(game uuid) returns void
language sql set search_path = jace_games as $$
  update community_games set plays = plays + 1 where id = game;
$$;
revoke execute on function community_add_play(uuid) from public, anon, authenticated;
grant execute on function community_add_play(uuid) to service_role;

alter table community_games enable row level security;
alter table community_versions enable row level security;
alter table community_scores enable row level security;
alter table reports enable row level security;

-- Only the server's secret key (service_role) can use the schema. anon and
-- authenticated get nothing, so the browser can't reach these tables even
-- with the publishable key, on top of RLS being on with no policies.
grant usage on schema jace_games to service_role;
grant all on all tables in schema jace_games to service_role;
grant all on all sequences in schema jace_games to service_role;
