-- Jace Live: leaderboard scores remember the game they came from (time limit, set, players, place, answers…).
alter table live_mode_scores add column if not exists details jsonb;
