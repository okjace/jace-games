-- Jace Games Live: chat in a game (players and the host). Deleted with the game.

create table if not exists live_chat (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references live_games (id) on delete cascade,
  player_id text,                                  -- null for the host
  name text not null,
  host boolean not null default false,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists live_chat_game_idx on live_chat (game_id, created_at);

alter table live_chat enable row level security;
grant select, insert, update, delete on live_chat to service_role;
