create table if not exists public.import_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_label text not null,
  row_count integer not null default 0,
  payload jsonb not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '14 days'),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_import_snapshots_created_at on public.import_snapshots(created_at desc);
create index if not exists idx_import_snapshots_expires_at on public.import_snapshots(expires_at asc);
create index if not exists idx_import_snapshots_source_type on public.import_snapshots(source_type);

alter table public.import_snapshots enable row level security;

drop policy if exists "import snapshots admin select" on public.import_snapshots;
create policy "import snapshots admin select"
on public.import_snapshots
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "import snapshots admin insert" on public.import_snapshots;
create policy "import snapshots admin insert"
on public.import_snapshots
for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "import snapshots admin delete" on public.import_snapshots;
create policy "import snapshots admin delete"
on public.import_snapshots
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
