-- Jace Games Live: pictures and videos people upload for their questions
-- (see lib/live/media.ts and app/api/live/media). Files live in a public
-- Storage bucket; browsers upload straight to it with one-time signed links
-- the server hands out, and the bucket itself enforces the size and types.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'live-media', 'live-media', true, 52428800,
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Who uploaded what, for the daily limit (and to find a person's files later).
create table if not exists live_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  path text not null unique,
  type text not null,
  bytes integer not null,
  created_at timestamptz not null default now()
);
create index if not exists live_uploads_user_idx on live_uploads (user_id, created_at desc);

alter table live_uploads enable row level security;
grant select, insert, update, delete on live_uploads to service_role;
