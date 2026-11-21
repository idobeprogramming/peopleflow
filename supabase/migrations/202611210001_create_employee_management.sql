create extension if not exists pgcrypto with schema extensions;

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null unique,
  job_title text not null,
  department_id uuid not null references public.departments(id),
  manager_id uuid references public.employees(id) on delete set null,
  status text not null check (status in ('active', 'onboarding', 'leave', 'inactive')),
  employment_type text not null check (employment_type in ('full_time', 'part_time', 'contract')),
  hire_date date not null,
  location text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index employees_department_id_idx on public.employees(department_id);
create index employees_manager_id_idx on public.employees(manager_id);
create index employees_status_idx on public.employees(status);

create table public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  owner_name text not null,
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index onboarding_tasks_employee_id_idx on public.onboarding_tasks(employee_id);
create index onboarding_tasks_due_date_idx on public.onboarding_tasks(due_date);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  action text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index audit_events_created_at_idx on public.audit_events(created_at desc);

alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.onboarding_tasks enable row level security;
alter table public.audit_events enable row level security;
