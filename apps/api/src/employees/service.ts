import type { CreateEmployeeInput } from '../../../../packages/domain/src/types.js'
import { filterEmployees } from '../../../../packages/domain/src/directory.js'
import type { EmployeeRepository } from './repository.js'

export class EmployeeError extends Error {
  constructor(readonly kind: 'invalid' | 'notFound' | 'conflict', message: string) {
    super(message)
  }
}

export class EmployeeService {
  constructor(private readonly repository: EmployeeRepository) {}

  async list(query: string, departmentId?: string, status?: string) {
    return filterEmployees(await this.repository.listEmployees(), query, departmentId, status)
  }

  async get(id: string) {
    const employee = await this.repository.getEmployee(id)
    if (!employee) throw new EmployeeError('notFound', 'Employé introuvable.')
    return employee
  }

  async save(input: CreateEmployeeInput, id?: string) {
    const [employees, departments] = await Promise.all([
      this.repository.listEmployees(),
      this.repository.listDepartments(),
    ])
    if (id && !employees.some((employee) => employee.id === id)) {
      throw new EmployeeError('notFound', 'Employé introuvable.')
    }
    const byId = new Map(employees.map((employee) => [employee.id, employee]))
    const visited = new Set<string>()
    let ancestor = input.managerId
    while (ancestor) {
      if (ancestor === id || visited.has(ancestor)) {
        throw new EmployeeError('invalid', 'Ce gestionnaire créerait une boucle hiérarchique.')
      }
      visited.add(ancestor)
      ancestor = byId.get(ancestor)?.managerId
    }

    if (!departments.some((department) => department.id === input.departmentId)) {
      throw new EmployeeError('invalid', 'Département introuvable.')
    }

    if (input.managerId && !employees.some((employee) => employee.id === input.managerId)) {
      throw new EmployeeError('invalid', 'Gestionnaire introuvable.')
    }

    if (employees.some((employee) => employee.id !== id && employee.email.toLowerCase() === input.email)) {
      throw new EmployeeError('conflict', 'Cette adresse courriel est déjà utilisée.')
    }

    return id ? this.repository.updateEmployee(id, input) : this.repository.createEmployee(input)
  }
}
