alter table public.tasks
  add column if not exists progress_percent integer not null default 0,
  add column if not exists round_number integer not null default 1,
  add column if not exists is_finished boolean not null default false;

alter table public.tasks
  add constraint tasks_progress_percent_range
  check (progress_percent >= 0 and progress_percent <= 100);

alter table public.tasks
  add constraint tasks_round_number_min
  check (round_number >= 1);

create index if not exists tasks_parent_round_idx on public.tasks(parent_id, round_number);
