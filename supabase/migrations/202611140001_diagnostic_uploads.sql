-- Lexirus diagnostic uploads.
-- The bucket is private. Only the Edge Function's service-role client can
-- write/read objects; no anon/authenticated storage policies are created.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('diagnostic-logs', 'diagnostic-logs', false, 5242880, null)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = null;

create table if not exists public.diagnostic_uploads (
  id uuid primary key default gen_random_uuid(),
  object_path text not null unique,
  original_filename text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 5242880),
  uploaded_at timestamptz not null default now(),
  app_version text,
  build_version text,
  os_version text,
  bug_type text,
  note text
);

alter table public.diagnostic_uploads enable row level security;
revoke all on table public.diagnostic_uploads from anon, authenticated;
grant all on table public.diagnostic_uploads to service_role;
