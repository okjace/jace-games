-- Jace Games Live: more locker rewards (see lib/live/locker.ts). A custom
-- frame someone designed, a frame effect, a name color, a win celebration,
-- the badge they show, and the stats badges are earned from.

alter table live_lockers add column if not exists custom_frame jsonb;
alter table live_lockers add column if not exists fx text not null default '';
alter table live_lockers add column if not exists name_color text not null default '';
alter table live_lockers add column if not exists effect text not null default '';
alter table live_lockers add column if not exists badge text not null default '';
alter table live_lockers add column if not exists stats jsonb not null default '{}'::jsonb;
