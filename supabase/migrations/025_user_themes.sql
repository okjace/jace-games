-- Jace Live: custom themes from the theme maker, the theme market, and reports about them.

create table if not exists user_themes (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  owner_name text not null,
  name text not null,
  icon text not null default '🎨',
  data jsonb not null,
  published boolean not null default false,
  installs integer not null default 0,
  removed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_themes_owner_idx on user_themes (owner_id, updated_at desc);
create index if not exists user_themes_market_idx on user_themes (published, removed, installs desc);

create table if not exists theme_reports (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references user_themes (id) on delete cascade,
  reporter_id text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (theme_id, reporter_id)
);

alter table user_themes enable row level security;
alter table theme_reports enable row level security;
grant select, insert, update, delete on user_themes, theme_reports to service_role;
