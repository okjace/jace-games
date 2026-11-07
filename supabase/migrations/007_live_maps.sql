-- Jace Games Live: maps people make for Tower Siege (see lib/live/maps.ts).
-- Same rules as the other migrations: row-level security on, no policies.

create table if not exists live_maps (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  owner_name text not null,
  title text not null,
  mode text not null default 'tower' check (mode in ('tower')),
  data jsonb not null,                              -- { cols, rows, theme, path: [[x,y]…], decor: [{x,y,icon}…] }
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  plays integer not null default 0,
  removed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_maps_owner_idx on live_maps (owner_id, updated_at desc);
create index if not exists live_maps_public_idx on live_maps (mode, visibility, removed, plays desc);

alter table live_maps enable row level security;
grant select, insert, update, delete on live_maps to service_role;
