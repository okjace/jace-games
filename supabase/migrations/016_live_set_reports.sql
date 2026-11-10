-- Jace Games Live: people reporting question sets for the site owner to review.
-- One report per person per set. Same rules: row-level security on, no policies.

create table if not exists live_set_reports (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references live_sets (id) on delete cascade,
  reporter_id text not null,
  reporter_name text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (set_id, reporter_id)
);
create index if not exists live_set_reports_set_idx on live_set_reports (set_id, created_at desc);

alter table live_set_reports enable row level security;
grant select, insert, update, delete on live_set_reports to service_role;
