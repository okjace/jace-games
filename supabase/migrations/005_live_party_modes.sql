-- Jace Games Live party modes: Tower Siege, Snack Shack, Gadget Factory,
-- Lake Frenzy and Code Breakers (see lib/live/party.ts).

alter table live_games drop constraint if exists live_games_mode_check;
alter table live_games add constraint live_games_mode_check
  check (mode in ('classic', 'gold', 'rocket', 'tower', 'snack', 'factory', 'fishing', 'hack'));
