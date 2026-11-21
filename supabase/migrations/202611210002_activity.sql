create function public.log_employee_activity() returns trigger
language plpgsql set search_path = public as $$
begin
  insert into audit_events(employee_id, action, description)
  values (new.id, 'employee.' || lower(tg_op), new.first_name || ' ' || new.last_name ||
    case when tg_op = 'INSERT' then ' — profil créé' else ' — profil modifié' end);
  return new;
end;
$$;

create trigger employee_activity after insert or update on public.employees
for each row execute function public.log_employee_activity();

create function public.log_task_activity() returns trigger
language plpgsql set search_path = public as $$
begin
  insert into audit_events(employee_id, action, description)
  values (new.employee_id, 'task.' || new.status, new.title ||
    case when new.status = 'done' then ' — terminée' else ' — rouverte' end);
  return new;
end;
$$;

create trigger task_activity after update of status on public.onboarding_tasks
for each row when (old.status is distinct from new.status)
execute function public.log_task_activity();
