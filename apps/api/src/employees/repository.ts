import type {
  Activity,
  Department,
  CreateEmployeeInput,
  Employee,
  OnboardingTask,
} from '../../../../packages/domain/src/types.js'

export interface EmployeeSaveChecks {
  employeeExists: boolean
  departmentExists: boolean
  managerExists: boolean
  managerCycle: boolean
  emailTaken: boolean
}

export interface EmployeeRepository {
  checkEmployeeSave(input: CreateEmployeeInput, id?: string): Promise<EmployeeSaveChecks>
  listEmployees(): Promise<Employee[]>
  getEmployee(id: string): Promise<Employee | null>
  listDepartments(): Promise<Department[]>
  listOnboardingTasks(employeeId?: string): Promise<OnboardingTask[]>
  setTaskStatus(id: string, status: 'done' | 'pending'): Promise<OnboardingTask | null>
  listActivity(): Promise<Activity[]>
  updateEmployee(id: string, input: CreateEmployeeInput): Promise<Employee>
  createEmployee(input: CreateEmployeeInput): Promise<Employee>
}
