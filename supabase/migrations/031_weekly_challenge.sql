-- Jace Live: weekly challenges. One featured mode a week; each player's best for that week (only if they chose to
-- put their score on the leaderboards). The top 3 claim a prize once the week is over.
create table if not exists live_weekly_scores (
  week text not null,
  user_id text not null,
  mode text not null,
  best integer not null,
  username text not null,
  avatar jsonb,
  claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (week, user_id)
);
create index if not exists live_weekly_scores_board_idx on live_weekly_scores (week, best desc);

alter table live_weekly_scores enable row level security;
grant select, insert, update, delete on live_weekly_scores to service_role;
