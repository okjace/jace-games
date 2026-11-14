-- Jace Live: global leaderboards, one best score per player per game mode (players choose to add theirs when a game ends).

create table if not exists live_mode_scores (
  user_id text not null,
  mode text not null,
  best integer not null,
  username text not null,
  avatar jsonb,
  game_code text,
  updated_at timestamptz not null default now(),
  primary key (user_id, mode)
);
create index if not exists live_mode_scores_board_idx on live_mode_scores (mode, best desc);

alter table live_mode_scores enable row level security;
grant select, insert, update, delete on live_mode_scores to service_role;
