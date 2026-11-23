import type { CreateEmployeeInput } from '../../../../packages/domain/src/types.js'
import { filterEmployees } from '../../../../packages/domain/src/directory.js'
import type { EmployeeRepository } from './repository.js'
import { EmployeeError } from './error.js'

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
    const checks = await this.repository.checkEmployeeSave(input, id)
    if (id && !checks.employeeExists) {
      throw new EmployeeError('notFound', 'Employé introuvable.')
    }
    if (checks.managerCycle) {
      throw new EmployeeError('invalid', 'Ce gestionnaire créerait une boucle hiérarchique.')
    }
    if (!checks.departmentExists) {
      throw new EmployeeError('invalid', 'Département introuvable.')
    }
    if (!checks.managerExists) {
      throw new EmployeeError('invalid', 'Gestionnaire introuvable.')
    }
    if (checks.emailTaken) {
      throw new EmployeeError('conflict', 'Cette adresse courriel est déjà utilisée.')
    }

    return id ? this.repository.updateEmployee(id, input) : this.repository.createEmployee(input)
  }
}
