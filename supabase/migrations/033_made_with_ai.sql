-- Jace Live: "made with AI" on Studio games and question sets.
--   'helper' = made with the AI helper (always shown, can't be turned off); 'self' = the maker said so; null = no.
alter table community_games add column if not exists ai text check (ai in ('helper', 'self'));
alter table live_sets add column if not exists ai text check (ai in ('helper', 'self'));
