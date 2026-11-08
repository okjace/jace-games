-- Jace Games Live: badges the site owner gives someone by hand, on top of
-- the ones they earn by playing (see lib/live/locker.ts BADGES).

alter table live_lockers add column if not exists granted_badges jsonb not null default '[]'::jsonb;
