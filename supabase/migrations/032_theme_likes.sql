-- Jace Live: likes on market themes (one per person), for "most liked" and "trending".
alter table user_themes add column if not exists likes integer not null default 0;
create table if not exists theme_likes (
  theme_id uuid not null references user_themes (id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (theme_id, user_id)
);
create index if not exists theme_likes_recent_idx on theme_likes (created_at desc);

alter table theme_likes enable row level security;
grant select, insert, update, delete on theme_likes to service_role;
