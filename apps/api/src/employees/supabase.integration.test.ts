import { createClient } from '@supabase/supabase-js'
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

  it('allows exactly one of two concurrent reciprocal manager assignments', async () => {
    const db = createClient(url!, key!)
    const [department] = await repository.listDepartments()
    const input = {
      firstName: 'Concurrent', lastName: 'Test', jobTitle: 'Test', departmentId: department!.id,
      status: 'active' as const, employmentType: 'contract' as const,
      hireDate: '2026-01-01', location: 'Test',
    }
    const a = await repository.createEmployee({ ...input, email: crypto.randomUUID() + '@example.test' })
    const b = await repository.createEmployee({ ...input, email: crypto.randomUUID() + '@example.test' })
    try {
      const results = await Promise.allSettled([
        repository.updateEmployee(a.id, { ...a, managerId: b.id }),
        repository.updateEmployee(b.id, { ...b, managerId: a.id }),
      ])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(results.find((r) => r.status === 'rejected')).toMatchObject({ reason: { kind: 'invalid' } })
      const after = await Promise.all([repository.getEmployee(a.id), repository.getEmployee(b.id)])
      expect(after.map((employee) => employee?.managerId).filter(Boolean)).toHaveLength(1)
    } finally {
      const { error } = await db.from('employees').delete().in('id', [a.id, b.id])
      if (error) throw error
    }
  })

  it('pages, searches and counts a department with more than 1000 employees', async () => {
    const db = createClient(url!, key!)
    const departmentId = crypto.randomUUID()
    const { error } = await db.from('departments').insert({ id: departmentId, name: departmentId })
    if (error) throw error
    try {
      const rows = Array.from({ length: 1001 }, (_, i) => ({
        department_id: departmentId, first_name: 'Test', last_name: String(i).padStart(4, '0'),
        email: departmentId + i + '@example.test', job_title: 'Test', hire_date: '2026-01-01',
        status: i === 1000 ? 'leave' : 'active', employment_type: 'contract', location: 'Test',
      }))
      const inserted = await db.from('employees').insert(rows)
      if (inserted.error) throw inserted.error
      const last = await repository.directoryPage({ departmentId }, 1000, 50)
      expect(last.total).toBe(1001)
      expect(last.items.map((employee) => employee.lastName)).toEqual(['1000'])
      const result = await repository.directoryPage({ departmentId, query: 'TEST 1000', status: 'leave' }, 0, 50)
      expect(result.items).toEqual(last.items)
      expect((await repository.departmentReport()).find((row) => row.id === departmentId))
        .toMatchObject({ total: 1001, active: 1000 })
    } finally {
      const employees = await db.from('employees').delete().eq('department_id', departmentId)
      if (employees.error) throw employees.error
      const department = await db.from('departments').delete().eq('id', departmentId)
      if (department.error) throw department.error
    }
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
