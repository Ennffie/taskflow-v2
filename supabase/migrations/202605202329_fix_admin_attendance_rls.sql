-- Allow admin users to insert/update/delete attendance records for any user
drop policy if exists "attendance insert own" on public.attendance_logs;
drop policy if exists "attendance insert own or admin" on public.attendance_logs;
create policy "attendance insert own or admin"
on public.attendance_logs
for insert
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "attendance update own" on public.attendance_logs;
drop policy if exists "attendance update own or admin" on public.attendance_logs;
create policy "attendance update own or admin"
on public.attendance_logs
for update
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "attendance delete own" on public.attendance_logs;
drop policy if exists "attendance delete own or admin" on public.attendance_logs;
create policy "attendance delete own or admin"
on public.attendance_logs
for delete
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
