create function public.employee_directory_page(search_text text, department_filter text,
  status_filter text, page_offset integer, page_size integer)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with matches as (
    select p.* from public.employee_profiles p
    where (department_filter is null or p.department_id::text = department_filter)
      and (status_filter is null or p.status = status_filter)
      and (search_text = '' or exists (
        select from unnest(array[p.first_name || ' ' || p.last_name, p.email, p.job_title, p.department_name]) field
        where strpos(lower(field), lower(search_text)) > 0
      ))
  ), page as (
    select * from matches order by last_name, first_name, id
    limit least(greatest(page_size, 1), 500) offset greatest(page_offset, 0)
  )
  select jsonb_build_object('total', (select count(*) from matches), 'items',
    coalesce((select jsonb_agg(page order by last_name, first_name, id) from page), '[]'::jsonb));
$$;

create function public.employee_department_report() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(r order by r.name, r.id), '[]'::jsonb) from (
    select d.id, d.name, count(e.id) as total,
           count(e.id) filter (where e.status = 'active') as active
    from public.departments d left join public.employees e on e.department_id = d.id
    group by d.id
  ) r;
$$;

revoke all on function public.employee_directory_page(text,text,text,integer,integer),
  public.employee_department_report() from public, anon, authenticated;
grant execute on function public.employee_directory_page(text,text,text,integer,integer),
  public.employee_department_report() to service_role;

-- Serialize hierarchy mutations before taking employee row locks. Updating a real
-- guard row also causes stale repeatable-read transactions to abort and retry.
create table public.employee_hierarchy_guard (id boolean primary key check (id));
insert into public.employee_hierarchy_guard values (true);
alter table public.employee_hierarchy_guard enable row level security;
revoke all on public.employee_hierarchy_guard from public, anon, authenticated;
grant select, update on public.employee_hierarchy_guard to service_role;

create function public.lock_employee_hierarchy() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.employee_hierarchy_guard set id = true where id;
  return null;
end;
$$;
create trigger lock_employee_hierarchy before insert or update of manager_id on public.employees
for each statement execute function public.lock_employee_hierarchy();

create function public.check_employee_hierarchy() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (
    with recursive chain(id) as (
      select new.manager_id union
      select e.manager_id from public.employees e join chain c on e.id = c.id
    )
    select from chain where id = new.id
  ) then
    raise exception using errcode = 'PF001', message = 'Employee manager cycle';
  end if;
  return null;
end;
$$;
create trigger check_employee_hierarchy after insert or update of manager_id on public.employees
for each row when (new.manager_id is not null) execute function public.check_employee_hierarchy();
