create policy "attendance delete own"
on public.attendance_logs
for delete
using (auth.uid() = user_id);
