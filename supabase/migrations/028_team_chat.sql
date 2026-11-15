-- Jace Live: team chat. A message with a team number only goes to that team (and the host).
alter table live_chat add column if not exists team integer;
