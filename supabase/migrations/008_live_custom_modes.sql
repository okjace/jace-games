-- Jace Games Live: Game Studio games as Live modes.
-- A Studio game opts in with live_mode; hosts can then pick it as the
-- "custom" mode. The game's code is copied into the Live game's settings
-- when the game is made, so later edits don't change a game in progress.

alter table community_games add column if not exists live_mode boolean not null default false;

alter table live_games drop constraint if exists live_games_mode_check;
alter table live_games add constraint live_games_mode_check
  check (mode in ('classic', 'gold', 'rocket', 'tower', 'snack', 'factory', 'fishing', 'hack', 'baseball', 'custom'));
