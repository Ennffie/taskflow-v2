create table if not exists public.external_leave_people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  linked_user_id uuid references public.profiles(id) on delete set null,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (name)
);

create table if not exists public.external_leave_records (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.external_leave_people(id) on delete cascade,
  date date not null,
  status text not null,
  note text,
  source text default 'admin_external',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (person_id, date)
);

create index if not exists idx_external_leave_people_sort
  on public.external_leave_people(sort_order asc, name asc);

create index if not exists idx_external_leave_records_date
  on public.external_leave_records(date desc);

create index if not exists idx_external_leave_records_person_date
  on public.external_leave_records(person_id, date desc);

alter table public.external_leave_records
  drop constraint if exists external_leave_records_status_check;

alter table public.external_leave_records
  add constraint external_leave_records_status_check
  check (status in ('al', 'sl', 'bl', 'other'));

create or replace function public.set_external_leave_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_external_leave_people_updated_at on public.external_leave_people;
create trigger trg_external_leave_people_updated_at
before update on public.external_leave_people
for each row
execute function public.set_external_leave_updated_at();

drop trigger if exists trg_external_leave_records_updated_at on public.external_leave_records;
create trigger trg_external_leave_records_updated_at
before update on public.external_leave_records
for each row
execute function public.set_external_leave_updated_at();

alter table public.external_leave_people enable row level security;
alter table public.external_leave_records enable row level security;

drop policy if exists "external leave people authenticated select" on public.external_leave_people;
create policy "external leave people authenticated select"
on public.external_leave_people
for select
using (auth.role() = 'authenticated');

drop policy if exists "external leave people admin write" on public.external_leave_people;
create policy "external leave people admin write"
on public.external_leave_people
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "external leave records authenticated select" on public.external_leave_records;
create policy "external leave records authenticated select"
on public.external_leave_records
for select
using (auth.role() = 'authenticated');

drop policy if exists "external leave records admin write" on public.external_leave_records;
create policy "external leave records admin write"
on public.external_leave_records
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

insert into public.external_leave_people (name, sort_order)
values
  ('Benne', 10),
  ('Mandy', 20),
  ('Jade', 30),
  ('Samantha', 40),
  ('Chelsy', 50),
  ('Claire', 60),
  ('Shani', 70)
on conflict (name) do update
set
  active = true,
  sort_order = excluded.sort_order;
