create view public.employee_profiles with (security_invoker = true) as
select e.id, e.first_name, e.last_name, e.email, e.job_title, e.department_id,
       e.manager_id, e.status, e.employment_type, e.hire_date, e.location, e.created_at,
       d.name as department_name, m.first_name || ' ' || m.last_name as manager_name
from public.employees e
join public.departments d on d.id = e.department_id
left join public.employees m on m.id = e.manager_id;

grant select on public.employee_profiles to service_role;

create index employees_lower_email_idx on public.employees (lower(email));

create function public.check_employee_save(employee_id uuid, department_id uuid, manager_id uuid, employee_email text)
returns table ("employeeExists" boolean, "departmentExists" boolean, "managerExists" boolean,
               "managerCycle" boolean, "emailTaken" boolean)
language sql stable security invoker set search_path = '' as $$
  with recursive ancestors(id, parent_id) as (
    select e.id, e.manager_id from public.employees e where e.id = $3
    union all
    select e.id, e.manager_id from public.employees e join ancestors a on e.id = a.parent_id
  ) cycle id set is_cycle using path
  select exists(select from public.employees e where e.id = $1),
         exists(select from public.departments d where d.id = $2),
         $3 is null or exists(select from ancestors),
         exists(select from ancestors where id = $1 or is_cycle),
         exists(select from public.employees e where lower(e.email) = lower($4) and e.id is distinct from $1);
$$;

revoke all on function public.check_employee_save(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.check_employee_save(uuid, uuid, uuid, text) to service_role;
