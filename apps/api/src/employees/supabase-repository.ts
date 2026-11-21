import { createClient } from '@supabase/supabase-js'
import type {
  CreateEmployeeInput,
  Department,
  Employee,
  EmployeeStatus,
  EmploymentType,
  OnboardingTask,
  OnboardingTaskStatus,
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

interface OnboardingTaskRow {
  id: string
  employee_id: string
  title: string
  owner_name: string
  due_date: string
  status: OnboardingTaskStatus
  sort_order: number
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

  function employeeValues(input: CreateEmployeeInput) {
    return {
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      job_title: input.jobTitle,
      department_id: input.departmentId,
      manager_id: input.managerId ?? null,
      status: input.status,
      employment_type: input.employmentType,
      hire_date: input.hireDate,
      location: input.location,
    }
  }

  return {
    async listActivity() {
      const { data, error } = await client.from('audit_events')
        .select('id, description, createdAt:created_at').order('created_at', { ascending: false }).limit(10)
      if (error) throw error
      return data ?? []
    },
    async setTaskStatus(id, status) {
      const { data, error } = await client.from('onboarding_tasks').update({ status }).eq('id', id)
        .select('id, employeeId:employee_id, title, ownerName:owner_name, dueDate:due_date, status, sortOrder:sort_order').maybeSingle()
      if (error) throw error
      return data as OnboardingTask | null
    },
    async updateEmployee(id, input) {
      const { error } = await client.from('employees').update(employeeValues(input)).eq('id', id)
      if (error) throw error
      const employee = await this.getEmployee(id)
      if (!employee) throw new Error('Employé introuvable.')
      return employee
    },
    async listEmployees() {
      return mapEmployees(await fetchEmployeeRows())
    },
    async getEmployee(id) {
      const rows = await fetchEmployeeRows()
      const employee = (await mapEmployees(rows)).find((item) => item.id === id)
      return employee ?? null
    },
    listDepartments: fetchDepartments,
    async listOnboardingTasks(employeeId) {
      let query = client
        .from('onboarding_tasks')
        .select('id, employee_id, title, owner_name, due_date, status, sort_order')
        .order('sort_order')

      if (employeeId) query = query.eq('employee_id', employeeId)

      const { data, error } = await query

      if (error) throw new Error(`Could not load onboarding tasks: ${error.message}`)

      return ((data ?? []) as OnboardingTaskRow[]).map((row): OnboardingTask => ({
        id: row.id,
        employeeId: row.employee_id,
        title: row.title,
        ownerName: row.owner_name,
        dueDate: row.due_date,
        status: row.status,
        sortOrder: row.sort_order,
      }))
    },
    async createEmployee(input: CreateEmployeeInput) {
      const { error } = await client.from('employees').insert(employeeValues(input))

      if (error) throw new Error(`Could not create employee: ${error.message}`)

      const employee = (await mapEmployees(await fetchEmployeeRows())).find(
        (item) => item.email === input.email,
      )

      if (!employee) throw new Error('Created employee could not be reloaded.')

      return employee
    },
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
