import { EmployeeError } from './error.js'
import { createClient } from '@supabase/supabase-js'
import type {
  CreateEmployeeInput,
  Department, DepartmentReport, EmployeeFilters, EmployeePage,
  Employee,
  EmployeeStatus,
  EmploymentType,
  OnboardingTask,
  OnboardingTaskStatus,
} from '../../../../packages/domain/src/types.js'
import type { EmployeeRepository, EmployeeSaveChecks } from './repository.js'

interface EmployeeProfileRow {
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
  department_name: string
  manager_name: string | null
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

  function mapEmployee(row: EmployeeProfileRow): Employee {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      jobTitle: row.job_title,
      departmentId: row.department_id,
      departmentName: row.department_name,
      managerId: row.manager_id,
      managerName: row.manager_name,
      status: row.status,
      employmentType: row.employment_type,
      hireDate: row.hire_date,
      location: row.location,
      createdAt: row.created_at,
    }
  }

  async function directoryPage(filters: EmployeeFilters, offset: number, size: number): Promise<EmployeePage> {
    const { data, error } = await client.rpc('employee_directory_page', {
      search_text: filters.query ?? '', department_filter: filters.departmentId ?? null,
      status_filter: filters.status ?? null, page_offset: offset, page_size: size,
    })
    if (error) throw error
    const page = data as { items: EmployeeProfileRow[]; total: number }
    return { items: page.items.map(mapEmployee), total: page.total }
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

  async function getEmployee(id: string) {
    const { data, error } = await client.from('employee_profiles').select('*').eq('id', id).maybeSingle()
    if (error?.code === '22P02') return null
    if (error) throw error
    return data ? mapEmployee(data as EmployeeProfileRow) : null
  }

  async function loadWrittenEmployee(id: string) {
    const employee = await getEmployee(id)
    if (!employee) throw new EmployeeError('notFound', 'Employé introuvable.')
    return employee
  }

  function throwWriteError(error: { code: string; message: string }): never {
    if (error.code === 'PF001') throw new EmployeeError('invalid', 'Ce gestionnaire créerait une boucle hiérarchique.')
    if (error.code === '23505' && error.message.includes('employees_email_key')) {
      throw new EmployeeError('conflict', 'Cette adresse courriel est déjà utilisée.')
    }
    throw error
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
    async checkEmployeeSave(input, id) {
      const { data, error } = await client.rpc('check_employee_save', {
        employee_id: id ?? null, department_id: input.departmentId,
        manager_id: input.managerId ?? null, employee_email: input.email,
      }).single<EmployeeSaveChecks>()
      if (error?.code === '22P02' && id) throw new EmployeeError('notFound', 'Employé introuvable.')
      if (error) throw error
      return data
    },
    async updateEmployee(id, input) {
      const { data, error } = await client.from('employees').update(employeeValues(input))
        .eq('id', id).select('id').maybeSingle()
      if (error) throwWriteError(error)
      if (!data) throw new EmployeeError('notFound', 'Employé introuvable.')
      return loadWrittenEmployee(data.id)
    },
    directoryPage,
    async listEmployees(filters = {}) {
      const employees: Employee[] = []
      for (;;) {
        const page = await directoryPage(filters, employees.length, 500)
        employees.push(...page.items)
        if (!page.items.length || employees.length >= page.total) return employees
      }
    },
    async departmentReport() {
      const { data, error } = await client.rpc('employee_department_report')
      if (error) throw error
      return data as DepartmentReport[]
    },
    getEmployee,
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
      const { data, error } = await client.from('employees').insert(employeeValues(input)).select('id').single()
      if (error) throwWriteError(error)
      return loadWrittenEmployee(data.id)
    },
  }
}
