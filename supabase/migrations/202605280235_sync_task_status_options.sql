alter table public.tasks drop constraint if exists tasks_status_check;

update public.tasks
set
  status = case
    when status = 'done' then 'finished'
    when status = 'review' then 'internal_review'
    else status
  end,
  is_finished = case
    when status = 'done' then true
    else is_finished
  end
where status in ('done', 'review');

alter table public.tasks
  add constraint tasks_status_check
  check (
    status = any (
      array[
        'todo'::text,
        'planning'::text,
        'in_progress'::text,
        'internal_review'::text,
        'round_1_wip'::text,
        'round_1_review'::text,
        'round_2_wip'::text,
        'round_2_review'::text,
        'round_3_wip'::text,
        'round_3_review'::text,
        'pending_mpfa_pc_nfc'::text,
        'finished'::text,
        'cancelled'::text,
        'archived'::text
      ]
    )
  );
