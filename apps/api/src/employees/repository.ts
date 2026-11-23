import type {
  Activity,
  Department,
  CreateEmployeeInput,
  Employee,
  OnboardingTask,
} from '../../../../packages/domain/src/types.js'

export interface EmployeeRepository {
  listEmployees(): Promise<Employee[]>
  getEmployee(id: string): Promise<Employee | null>
  listDepartments(): Promise<Department[]>
  listOnboardingTasks(employeeId?: string): Promise<OnboardingTask[]>
  setTaskStatus(id: string, status: 'done' | 'pending'): Promise<OnboardingTask | null>
  listActivity(): Promise<Activity[]>
  updateEmployee(id: string, input: CreateEmployeeInput): Promise<Employee>
  createEmployee(input: CreateEmployeeInput): Promise<Employee>
}
