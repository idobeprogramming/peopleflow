import { filterEmployees } from '../../../../packages/domain/src/directory.js'
import type { EmployeeRepository } from './repository.js'
import type {
  Activity,
  Department,
  Employee,
  OnboardingTask,
} from '../../../../packages/domain/src/types.js'

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

const seedOnboardingTasks: OnboardingTask[] = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    employeeId: '10000000-0000-4000-8000-000000000003',
    title: 'Préparer l’accès aux outils',
    ownerName: 'Loïc Tremblay',
    dueDate: dateFromToday(-1),
    status: 'in_progress',
    sortOrder: 1,
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    employeeId: '10000000-0000-4000-8000-000000000003',
    title: 'Planifier la rencontre d’accueil',
    ownerName: 'Jade Mercier',
    dueDate: dateFromToday(1),
    status: 'pending',
    sortOrder: 2,
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    employeeId: '10000000-0000-4000-8000-000000000004',
    title: 'Préparer l’équipement',
    ownerName: 'Loïc Tremblay',
    dueDate: dateFromToday(2),
    status: 'pending',
    sortOrder: 1,
  },
  {
    id: '30000000-0000-4000-8000-000000000004',
    employeeId: '10000000-0000-4000-8000-000000000004',
    title: 'Partager le plan des premières semaines',
    ownerName: 'Camille Fortin',
    dueDate: dateFromToday(3),
    status: 'pending',
    sortOrder: 2,
  },
]

export function createMemoryEmployeeRepository(
  initialEmployees: Employee[] = seedEmployees,
): EmployeeRepository {
  const employees = initialEmployees.map((employee) => ({ ...employee }))

  const tasks = seedOnboardingTasks.map((task) => ({ ...task }))
  const activity: Activity[] = []
  function record(description: string) {
    activity.unshift({ id: crypto.randomUUID(), description, createdAt: new Date().toISOString() })
  }
  return {
    async checkEmployeeSave(input, id) {
      const byId = (key: string) => employees.find((employee) => employee.id === key)
      const visited = new Set<string>()
      let ancestor = input.managerId
      while (ancestor && ancestor !== id && !visited.has(ancestor)) {
        visited.add(ancestor)
        ancestor = byId(ancestor)?.managerId
      }
      return {
        employeeExists: !!id && !!byId(id),
        departmentExists: departments.some((department) => department.id === input.departmentId),
        managerExists: !input.managerId || !!byId(input.managerId),
        managerCycle: !!ancestor,
        emailTaken: employees.some((employee) => employee.id !== id
          && employee.email.toLowerCase() === input.email.toLowerCase()),
      }
    },
    async listActivity() { return activity.slice(0, 10) },
    async setTaskStatus(id, status) {
      const task = tasks.find((item) => item.id === id)
      if (!task) return null
      if (task.status !== status) {
        task.status = status
        record(task.title + (status === 'done' ? ' — terminée' : ' — rouverte'))
      }
      return { ...task }
    },
    async updateEmployee(id, input) {
      const employee = employees.find((item) => item.id === id)
      if (!employee) throw new Error('Employé introuvable.')
      const manager = employees.find((item) => item.id === input.managerId)
      Object.assign(employee, input, {
        managerId: input.managerId ?? null,
        managerName: manager ? manager.firstName + ' ' + manager.lastName : null,
        departmentName: departments.find((item) => item.id === input.departmentId)!.name,
      })
      for (const report of employees.filter((item) => item.managerId === id)) {
        report.managerName = employee.firstName + ' ' + employee.lastName
      }
      record(employee.firstName + ' ' + employee.lastName + ' — profil modifié')
      return { ...employee }
    },
    async listEmployees(filters = {}) {
      return filterEmployees(employees, filters.query ?? '', filters.departmentId, filters.status)
        .map((employee) => ({ ...employee }))
    },
    async directoryPage(filters, offset, size) {
      const rows = await this.listEmployees(filters)
      rows.sort((a, b) => a.lastName.localeCompare(b.lastName)
        || a.firstName.localeCompare(b.firstName) || a.id.localeCompare(b.id))
      return { items: rows.slice(offset, offset + size), total: rows.length }
    },
    async departmentReport() {
      return departments.map((department) => {
        const members = employees.filter((employee) => employee.departmentId === department.id)
        return { ...department, total: members.length, active: members.filter((e) => e.status === 'active').length }
      })
    },
    async getEmployee(id) {
      const employee = employees.find((item) => item.id === id)
      return employee ? { ...employee } : null
    },
    async listDepartments() {
      return departments.map((department) => ({ ...department }))
    },
    async listOnboardingTasks(employeeId) {
      return tasks
        .filter((task) => !employeeId || task.employeeId === employeeId)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((task) => ({ ...task }))
    },
    async createEmployee(input) {
      const department = departments.find((item) => item.id === input.departmentId)
      const manager = employees.find((item) => item.id === input.managerId)
      const employee: Employee = {
        id: crypto.randomUUID(),
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        jobTitle: input.jobTitle,
        departmentId: input.departmentId,
        departmentName: department?.name ?? 'Sans département',
        managerId: input.managerId ?? null,
        managerName: manager ? `${manager.firstName} ${manager.lastName}` : null,
        status: input.status,
        employmentType: input.employmentType,
        hireDate: input.hireDate,
        location: input.location,
        createdAt: new Date().toISOString(),
      }
      employees.push(employee)
      record(employee.firstName + ' ' + employee.lastName + ' — profil créé')
      return { ...employee }
    },
  }
}
