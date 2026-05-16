alter table public.attendance_logs
  add column if not exists status text;

update public.attendance_logs
set status = 'present'
where status is null;

alter table public.attendance_logs
  alter column status set not null;

alter table public.attendance_logs
  alter column check_in_at drop not null;

alter table public.attendance_logs
  drop constraint if exists attendance_logs_status_check;

alter table public.attendance_logs
  add constraint attendance_logs_status_check
  check (status in ('present', 'al', 'sl', 'bl', 'other'));

alter table public.attendance_logs
  drop constraint if exists attendance_logs_status_time_check;

alter table public.attendance_logs
  add constraint attendance_logs_status_time_check
  check (
    (status = 'present' and check_in_at is not null)
    or
    (status in ('al', 'sl', 'bl', 'other'))
  );

create index if not exists idx_attendance_logs_date
  on public.attendance_logs(date desc);

create index if not exists idx_attendance_logs_status
  on public.attendance_logs(status);

drop policy if exists "attendance select own" on public.attendance_logs;
create policy "attendance select own"
on public.attendance_logs
for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

comment on column public.attendance_logs.status is 'present | al | sl | bl | other';
comment on column public.attendance_logs.note is 'Same-day editable note for late reason / off details';
