alter table public.tasks
  add column if not exists today_update text,
  add column if not exists next_day_focus text;
