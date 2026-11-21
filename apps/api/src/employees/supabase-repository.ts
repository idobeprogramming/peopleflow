import { createClient } from '@supabase/supabase-js'
import type {
  Department,
  Employee,
  EmployeeStatus,
  EmploymentType,
} from '../../../../packages/domain/src/types.js'
import {
  createMemoryEmployeeRepository,
  type EmployeeRepository,
} from './memory-repository.js'

interface EmployeeRow {
  id: string
  first_name: string
  last_name: string
  email: string
  job_title: string
  department_id: string
  manager_id: string | null
  status: EmployeeStatus
  employment_type: EmploymentType
  hire_date: string
  location: string
  created_at: string
}

interface DepartmentRow {
  id: string
  name: string
}

export function createSupabaseEmployeeRepository(
  url: string,
  serviceRoleKey: string,
): EmployeeRepository {
  const client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  async function fetchDepartments(): Promise<Department[]> {
    const { data, error } = await client
      .from('departments')
      .select('id, name')
      .order('name')

    if (error) throw new Error(`Could not load departments: ${error.message}`)

    return ((data ?? []) as DepartmentRow[]).map((row) => ({
      id: row.id,
      name: row.name,
    }))
  }

  async function fetchEmployeeRows(): Promise<EmployeeRow[]> {
    const { data, error } = await client
      .from('employees')
      .select(
        'id, first_name, last_name, email, job_title, department_id, manager_id, status, employment_type, hire_date, location, created_at',
      )
      .order('last_name')

    if (error) throw new Error(`Could not load employees: ${error.message}`)

    return (data ?? []) as EmployeeRow[]
  }

  async function mapEmployees(rows: EmployeeRow[]): Promise<Employee[]> {
    const departmentList = await fetchDepartments()
    const departmentNames = new Map(
      departmentList.map((department) => [department.id, department.name]),
    )
    const employeeNames = new Map(
      rows.map((row) => [row.id, `${row.first_name} ${row.last_name}`]),
    )

    return rows.map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      jobTitle: row.job_title,
      departmentId: row.department_id,
      departmentName: departmentNames.get(row.department_id) ?? 'Sans département',
      managerId: row.manager_id,
      managerName: row.manager_id ? employeeNames.get(row.manager_id) ?? null : null,
      status: row.status,
      employmentType: row.employment_type,
      hireDate: row.hire_date,
      location: row.location,
      createdAt: row.created_at,
    }))
  }

  return {
    async listEmployees() {
      return mapEmployees(await fetchEmployeeRows())
    },
    async getEmployee(id) {
      const rows = await fetchEmployeeRows()
      const employee = (await mapEmployees(rows)).find((item) => item.id === id)
      return employee ?? null
    },
    listDepartments: fetchDepartments,
  }
}

export function createConfiguredEmployeeRepository(): EmployeeRepository {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (url && serviceRoleKey) {
    return createSupabaseEmployeeRepository(url, serviceRoleKey)
  }

  return createMemoryEmployeeRepository()
}
