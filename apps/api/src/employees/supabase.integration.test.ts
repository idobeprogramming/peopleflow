import { beforeAll, describe, expect, it } from 'vitest'
import { createSupabaseEmployeeRepository } from './supabase-repository.js'

// Runs only when a local Supabase is available (CI database job or `npm run test:integration`).
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const isLocal = !!url && ['localhost', '127.0.0.1'].includes(new URL(url).hostname)

describe.skipIf(!isLocal || !key)('Supabase repository against the seeded local database', () => {
  let repository: ReturnType<typeof createSupabaseEmployeeRepository>
  beforeAll(() => {
    repository = createSupabaseEmployeeRepository(url!, key!)
  })

  it('reads the seeded departments and employees', async () => {
    const departments = await repository.listDepartments()
    expect(departments.map((department) => department.name)).toContain('Ventes')

    const employees = await repository.listEmployees()
    const nicolas = employees.find((employee) => employee.lastName === 'Gagnon')
    expect(nicolas).toMatchObject({ firstName: 'Nicolas', departmentName: 'Ventes', status: 'onboarding' })
  })

  it('checks only the proposed reporting chain and excludes the current email owner', async () => {
    const id = '10000000-0000-4000-8000-000000000001'
    const employee = await repository.getEmployee(id)
    if (!employee) throw new Error('Missing seed employee')
    const checks = await repository.checkEmployeeSave({
      ...employee, email: employee.email.toUpperCase(),
      managerId: '10000000-0000-4000-8000-000000000003',
    }, id)
    expect(checks).toEqual({
      employeeExists: true, departmentExists: true, managerExists: true,
      managerCycle: true, emailTaken: false,
    })
  })

  it('persists a new employee with its department name', async () => {
    const [department] = await repository.listDepartments()
    const email = `integration.${Date.now()}@exemple.ca`
    const created = await repository.createEmployee({
      firstName: 'Intégration', lastName: 'Test', email, jobTitle: 'Vérification',
      departmentId: department!.id, managerId: null, status: 'onboarding',
      employmentType: 'contract', hireDate: '2026-12-01', location: 'À distance',
    })
    expect(created).toMatchObject({ email, departmentName: department!.name })
    expect(await repository.getEmployee(created.id)).toMatchObject({ email })
  })

  it('persists an onboarding task status and records it in the activity log', async () => {
    const [task] = await repository.listOnboardingTasks()
    const next = task!.status === 'done' ? 'pending' : 'done'
    expect(await repository.setTaskStatus(task!.id, next)).toMatchObject({ id: task!.id, status: next })
    const reloaded = (await repository.listOnboardingTasks(task!.employeeId)).find((item) => item.id === task!.id)
    expect(reloaded?.status).toBe(next)
    expect((await repository.listActivity()).length).toBeGreaterThan(0)
  })

  it('returns null for an unknown task instead of throwing', async () => {
    expect(await repository.setTaskStatus('00000000-0000-4000-8000-000000000000', 'done')).toBeNull()
  })
})
