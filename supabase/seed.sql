insert into public.departments (id, name)
values
  ('20000000-0000-4000-8000-000000000001', 'Direction'),
  ('20000000-0000-4000-8000-000000000002', 'Ventes'),
  ('20000000-0000-4000-8000-000000000003', 'Produit'),
  ('20000000-0000-4000-8000-000000000004', 'Opérations')
on conflict (id) do update set name = excluded.name;

insert into public.employees (
  id, first_name, last_name, email, job_title, department_id, manager_id,
  status, employment_type, hire_date, location
)
values
  (
    '10000000-0000-4000-8000-000000000001', 'Camille', 'Fortin',
    'camille.fortin@example.test', 'Directrice générale',
    '20000000-0000-4000-8000-000000000001', null, 'active', 'full_time',
    current_date - 920, 'Montréal'
  ),
  (
    '10000000-0000-4000-8000-000000000002', 'Jade', 'Mercier',
    'jade.mercier@example.test', 'Gestionnaire de comptes',
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001', 'active', 'full_time',
    current_date - 430, 'Québec'
  ),
  (
    '10000000-0000-4000-8000-000000000006', 'Loïc', 'Tremblay',
    'loic.tremblay@example.test', 'Responsable des opérations',
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001', 'active', 'full_time',
    current_date - 780, 'Trois-Rivières'
  ),
  (
    '10000000-0000-4000-8000-000000000005', 'Zoé', 'Mathieu',
    'zoe.mathieu@example.test', 'Designer produit',
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001', 'active', 'full_time',
    current_date - 210, 'Montréal'
  ),
  (
    '10000000-0000-4000-8000-000000000003', 'Nicolas', 'Gagnon',
    'nicolas.gagnon@example.test', 'Conseiller aux ventes',
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002', 'onboarding', 'full_time',
    current_date - 2, 'Montréal'
  ),
  (
    '10000000-0000-4000-8000-000000000004', 'Sarah', 'Karam',
    'sarah.karam@example.test', 'Coordonnatrice des opérations',
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000006', 'onboarding', 'part_time',
    current_date + 4, 'À distance'
  ),
  (
    '10000000-0000-4000-8000-000000000007', 'Anaïs', 'Pelletier',
    'anais.pelletier@example.test', 'Développeuse logiciel',
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000005', 'active', 'full_time',
    current_date - 160, 'À distance'
  ),
  (
    '10000000-0000-4000-8000-000000000008', 'Yanis', 'Bouchard',
    'yanis.bouchard@example.test', 'Spécialiste de la facturation',
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000006', 'leave', 'contract',
    current_date - 560, 'Québec'
  )
on conflict (id) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  email = excluded.email,
  job_title = excluded.job_title,
  department_id = excluded.department_id,
  manager_id = excluded.manager_id,
  status = excluded.status,
  employment_type = excluded.employment_type,
  hire_date = excluded.hire_date,
  location = excluded.location,
  updated_at = now();

insert into public.onboarding_tasks (
  id, employee_id, title, owner_name, due_date, status, sort_order
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    'Préparer l’accès aux outils', 'Loïc Tremblay', current_date - 1,
    'in_progress', 1
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    'Planifier la rencontre d’accueil', 'Jade Mercier', current_date + 1,
    'pending', 2
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000004',
    'Préparer l’équipement', 'Loïc Tremblay', current_date + 2,
    'pending', 1
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000004',
    'Partager le plan des premières semaines', 'Camille Fortin',
    current_date + 3, 'pending', 2
  )
on conflict (id) do update set
  employee_id = excluded.employee_id,
  title = excluded.title,
  owner_name = excluded.owner_name,
  due_date = excluded.due_date,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();
