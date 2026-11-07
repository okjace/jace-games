-- Jace Games Live: each signed-in player's locker (see lib/live/locker.ts):
-- their XP and the icon and frame they show in games.

create table if not exists live_lockers (
  user_id text primary key,                         -- Jace user id
  xp integer not null default 0,
  icon text not null default 'smile',               -- an icon id, or 'jace' for their Jace picture
  frame text not null default 'none',
  updated_at timestamptz not null default now()
);

-- Adding XP in one statement, so two games ending at once can't lose any.
create or replace function live_locker_add_xp(uid text, amount integer) returns void
language sql as $$
  insert into live_lockers (user_id, xp) values (uid, amount)
  on conflict (user_id) do update set xp = live_lockers.xp + excluded.xp, updated_at = now();
$$;
revoke execute on function live_locker_add_xp(text, integer) from public, anon, authenticated;
grant execute on function live_locker_add_xp(text, integer) to service_role;

alter table live_lockers enable row level security;
grant select, insert, update, delete on live_lockers to service_role;
