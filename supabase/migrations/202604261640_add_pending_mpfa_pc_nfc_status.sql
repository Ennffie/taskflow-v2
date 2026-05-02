alter table public.tasks drop constraint if exists tasks_status_check;

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
        'review'::text,
        'done'::text,
        'cancelled'::text
      ]
    )
  );
