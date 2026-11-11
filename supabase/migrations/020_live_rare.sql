-- Jace Games Live: the Rare Finds mode.

alter table live_games drop constraint if exists live_games_mode_check;
alter table live_games add constraint live_games_mode_check
  check (mode in ('classic', 'gold', 'rocket', 'tower', 'snack', 'factory', 'fishing', 'hack', 'baseball', 'custom', 'banana',
                  'summit', 'survival', 'boss', 'tug', 'hatchery', 'pinata', 'rare'));
