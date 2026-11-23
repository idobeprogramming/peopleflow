export type EmployeeStatus = 'active' | 'onboarding' | 'leave' | 'inactive'

export type EmploymentType = 'full_time' | 'part_time' | 'contract'

export type OnboardingTaskStatus = 'pending' | 'in_progress' | 'done'

export interface Department {
  id: string
  name: string
}

export interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
  jobTitle: string
  departmentId: string
  departmentName: string
  managerId: string | null
  managerName: string | null
  status: EmployeeStatus
  employmentType: EmploymentType
  hireDate: string
  location: string
  createdAt: string
}

export interface CreateEmployeeInput {
  firstName: string
  lastName: string
  email: string
  jobTitle: string
  departmentId: string
  managerId?: string | null
  status: EmployeeStatus
  employmentType: EmploymentType
  hireDate: string
  location: string
}

export interface OnboardingTask {
  id: string
  employeeId: string
  title: string
  ownerName: string
  dueDate: string
  status: OnboardingTaskStatus
  sortOrder: number
}

export interface Activity {
  id: string
  description: string
  createdAt: string
}

export type UserRole = 'admin' | 'hr' | 'manager'

/** The signed-in user as the API exposes it: never includes credentials. */
export interface AuthUser {
  id: string
  email: string
  displayName: string
  role: UserRole
}

export interface EmployeeFilters {
  query?: string
  departmentId?: string
  status?: string
}

export interface EmployeePage {
  items: Employee[]
  total: number
}

export interface DepartmentReport extends Department {
  total: number
  active: number
}
