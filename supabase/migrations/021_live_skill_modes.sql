-- Jace Live: six skill modes (Territory Wars, Vault Cracker, King of the Hill, Memory Match, Minefield, Sky Stacker) and Snake Arena.

alter table live_games drop constraint if exists live_games_mode_check;
alter table live_games add constraint live_games_mode_check
  check (mode in ('classic', 'gold', 'rocket', 'tower', 'snack', 'factory', 'fishing', 'hack', 'baseball', 'custom', 'banana',
                  'summit', 'survival', 'boss', 'tug', 'hatchery', 'pinata', 'rare',
                  'territory', 'vault', 'king', 'memory', 'sweep', 'stack', 'snake'));
