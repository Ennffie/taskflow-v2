create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  check_in_at timestamptz not null,
  note text,
  source text default 'manual',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, date)
);

create index if not exists idx_attendance_logs_user_date on public.attendance_logs(user_id, date desc);

create or replace function public.set_attendance_logs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

 drop trigger if exists trg_attendance_logs_updated_at on public.attendance_logs;
create trigger trg_attendance_logs_updated_at
before update on public.attendance_logs
for each row
execute function public.set_attendance_logs_updated_at();

alter table public.attendance_logs enable row level security;

create policy "attendance select own"
on public.attendance_logs
for select
using (auth.uid() = user_id);

create policy "attendance insert own"
on public.attendance_logs
for insert
with check (auth.uid() = user_id);

create policy "attendance update own"
on public.attendance_logs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
