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
