-- Jace Games Live: reports hosts can see after a game (see lib/live/report.ts).
-- A copy of every question and each player's answers, saved when a game with
-- questions ends. Kept for 90 days. Same rules: row-level security on, no policies.

create table if not exists live_reports (
  id uuid primary key default gen_random_uuid(),
  host_id text not null,
  code text not null,
  mode text not null,
  set_title text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days'
);
create index if not exists live_reports_host_idx on live_reports (host_id, created_at desc);
create index if not exists live_reports_expires_idx on live_reports (expires_at);

alter table live_reports enable row level security;
grant select, insert, update, delete on live_reports to service_role;
