import type { Department, Employee } from '../../../../packages/domain/src/types.js'

const departments: Department[] = [
  { id: '20000000-0000-4000-8000-000000000001', name: 'Direction' },
  { id: '20000000-0000-4000-8000-000000000002', name: 'Ventes' },
  { id: '20000000-0000-4000-8000-000000000003', name: 'Produit' },
  { id: '20000000-0000-4000-8000-000000000004', name: 'Opérations' },
]

function dateFromToday(offsetInDays: number): string {
  return new Date(Date.now() + offsetInDays * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

const seedEmployees: Employee[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    firstName: 'Camille',
    lastName: 'Fortin',
    email: 'camille.fortin@example.test',
    jobTitle: 'Directrice générale',
    departmentId: departments[0]!.id,
    departmentName: departments[0]!.name,
    managerId: null,
    managerName: null,
    status: 'active',
    employmentType: 'full_time',
    hireDate: dateFromToday(-920),
    location: 'Montréal',
    createdAt: dateFromToday(-920),
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    firstName: 'Jade',
    lastName: 'Mercier',
    email: 'jade.mercier@example.test',
    jobTitle: 'Gestionnaire de comptes',
    departmentId: departments[1]!.id,
    departmentName: departments[1]!.name,
    managerId: '10000000-0000-4000-8000-000000000001',
    managerName: 'Camille Fortin',
    status: 'active',
    employmentType: 'full_time',
    hireDate: dateFromToday(-430),
    location: 'Québec',
    createdAt: dateFromToday(-430),
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    firstName: 'Nicolas',
    lastName: 'Gagnon',
    email: 'nicolas.gagnon@example.test',
    jobTitle: 'Conseiller aux ventes',
    departmentId: departments[1]!.id,
    departmentName: departments[1]!.name,
    managerId: '10000000-0000-4000-8000-000000000002',
    managerName: 'Jade Mercier',
    status: 'onboarding',
    employmentType: 'full_time',
    hireDate: dateFromToday(-2),
    location: 'Montréal',
    createdAt: dateFromToday(-20),
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    firstName: 'Sarah',
    lastName: 'Karam',
    email: 'sarah.karam@example.test',
    jobTitle: 'Coordonnatrice des opérations',
    departmentId: departments[3]!.id,
    departmentName: departments[3]!.name,
    managerId: '10000000-0000-4000-8000-000000000006',
    managerName: 'Loïc Tremblay',
    status: 'onboarding',
    employmentType: 'part_time',
    hireDate: dateFromToday(4),
    location: 'À distance',
    createdAt: dateFromToday(-10),
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    firstName: 'Zoé',
    lastName: 'Mathieu',
    email: 'zoe.mathieu@example.test',
    jobTitle: 'Designer produit',
    departmentId: departments[2]!.id,
    departmentName: departments[2]!.name,
    managerId: '10000000-0000-4000-8000-000000000001',
    managerName: 'Camille Fortin',
    status: 'active',
    employmentType: 'full_time',
    hireDate: dateFromToday(-210),
    location: 'Montréal',
    createdAt: dateFromToday(-210),
  },
  {
    id: '10000000-0000-4000-8000-000000000006',
    firstName: 'Loïc',
    lastName: 'Tremblay',
    email: 'loic.tremblay@example.test',
    jobTitle: 'Responsable des opérations',
    departmentId: departments[3]!.id,
    departmentName: departments[3]!.name,
    managerId: '10000000-0000-4000-8000-000000000001',
    managerName: 'Camille Fortin',
    status: 'active',
    employmentType: 'full_time',
    hireDate: dateFromToday(-780),
    location: 'Trois-Rivières',
    createdAt: dateFromToday(-780),
  },
  {
    id: '10000000-0000-4000-8000-000000000007',
    firstName: 'Anaïs',
    lastName: 'Pelletier',
    email: 'anais.pelletier@example.test',
    jobTitle: 'Développeuse logiciel',
    departmentId: departments[2]!.id,
    departmentName: departments[2]!.name,
    managerId: '10000000-0000-4000-8000-000000000005',
    managerName: 'Zoé Mathieu',
    status: 'active',
    employmentType: 'full_time',
    hireDate: dateFromToday(-160),
    location: 'À distance',
    createdAt: dateFromToday(-160),
  },
  {
    id: '10000000-0000-4000-8000-000000000008',
    firstName: 'Yanis',
    lastName: 'Bouchard',
    email: 'yanis.bouchard@example.test',
    jobTitle: 'Spécialiste de la facturation',
    departmentId: departments[3]!.id,
    departmentName: departments[3]!.name,
    managerId: '10000000-0000-4000-8000-000000000006',
    managerName: 'Loïc Tremblay',
    status: 'leave',
    employmentType: 'contract',
    hireDate: dateFromToday(-560),
    location: 'Québec',
    createdAt: dateFromToday(-560),
  },
]

export interface EmployeeRepository {
  listEmployees(): Promise<Employee[]>
  getEmployee(id: string): Promise<Employee | null>
  listDepartments(): Promise<Department[]>
}

export function createMemoryEmployeeRepository(
  initialEmployees: Employee[] = seedEmployees,
): EmployeeRepository {
  const employees = initialEmployees.map((employee) => ({ ...employee }))

  return {
    async listEmployees() {
      return employees.map((employee) => ({ ...employee }))
    },
    async getEmployee(id) {
      const employee = employees.find((item) => item.id === id)
      return employee ? { ...employee } : null
    },
    async listDepartments() {
      return departments.map((department) => ({ ...department }))
    },
  }
}
