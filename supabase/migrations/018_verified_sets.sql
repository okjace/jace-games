-- Jace Games Live: sets the site owner has checked and marked as verified.

alter table live_sets add column if not exists verified boolean not null default false;
create index if not exists live_sets_verified_idx on live_sets (verified, plays desc) where visibility = 'public' and removed = false;
