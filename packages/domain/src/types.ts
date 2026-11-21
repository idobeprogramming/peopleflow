export type EmployeeStatus = 'active' | 'onboarding' | 'leave' | 'inactive'

export type EmploymentType = 'full_time' | 'part_time' | 'contract'

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
