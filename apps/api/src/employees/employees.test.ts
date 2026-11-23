import { describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { createMemoryEmployeeRepository } from './memory-repository.js'

describe('employee directory API', () => {
  const newEmployee = {
    firstName: 'Maya',
    lastName: 'Renaud',
    email: 'maya.renaud@example.test',
    jobTitle: 'Agente de soutien',
    departmentId: '20000000-0000-4000-8000-000000000004',
    managerId: '10000000-0000-4000-8000-000000000006',
    status: 'active',
    employmentType: 'full_time',
    hireDate: '2026-12-01',
    location: 'Montréal',
  }

  it('maps a duplicate email from the service to an HTTP conflict', async () => {
    const app = createApp()
    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEmployee),
    }
    expect((await app.request('/api/employees', request)).status).toBe(201)
    const duplicate = await app.request('/api/employees', request)
    expect(duplicate.status).toBe(409)
    expect(await duplicate.json()).toEqual({ error: 'Cette adresse courriel est déjà utilisée.' })
  })

  it('returns the fictional seed employees with their department', async () => {
    const response = await createApp(createMemoryEmployeeRepository()).request(
      '/api/employees',
    )
    const employees = await response.json()

    expect(response.status).toBe(200)
    expect(employees).toHaveLength(8)
    expect(employees[0]).toMatchObject({
      firstName: 'Camille',
      lastName: 'Fortin',
      departmentName: 'Direction',
      status: 'active',
    })
  })

  it('filters by department and employment status', async () => {
    const response = await createApp(createMemoryEmployeeRepository()).request(
      '/api/employees?departmentId=20000000-0000-4000-8000-000000000002&status=onboarding',
    )
    const employees = await response.json()

    expect(response.status).toBe(200)
    expect(employees).toHaveLength(1)
    expect(employees[0]).toMatchObject({
      firstName: 'Nicolas',
      status: 'onboarding',
    })
  })

  it('returns departments for the filter controls', async () => {
    const response = await createApp(createMemoryEmployeeRepository()).request(
      '/api/departments',
    )
    const departments = await response.json()

    expect(response.status).toBe(200)
    expect(departments).toHaveLength(4)
    expect(departments.map((department: { name: string }) => department.name))
      .toContain('Ventes');
  })

  it('returns seeded onboarding tasks and filters them by employee', async () => {
    const response = await createApp(createMemoryEmployeeRepository()).request(
      '/api/onboarding-tasks?employeeId=10000000-0000-4000-8000-000000000003',
    )
    const tasks = await response.json()

    expect(response.status).toBe(200)
    expect(tasks).toHaveLength(2)
    expect(tasks[0]).toMatchObject({
      employeeId: '10000000-0000-4000-8000-000000000003',
      title: 'Préparer l’accès aux outils',
    })
  })

  it('creates an employee and returns the completed profile', async () => {
    const response = await createApp(createMemoryEmployeeRepository()).request(
      '/api/employees',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newEmployee) },
    )
    const employee = await response.json()

    expect(response.status).toBe(201)
    expect(employee).toMatchObject({
      firstName: 'Maya',
      lastName: 'Renaud',
      departmentName: 'Opérations',
      managerName: 'Loïc Tremblay',
    })
  })

  it('rejects an invalid email address', async () => {
    const response = await createApp(createMemoryEmployeeRepository()).request(
      '/api/employees',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newEmployee, email: 'not-an-email' }),
      },
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'Données invalides.' })
  })
  it('saves edited profiles while preserving their identity', async () => {
    const app = createApp()
    const id = '10000000-0000-4000-8000-000000000003'
    const response = await app.request('/api/employees/' + id, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEmployee),
    })
    expect(response.status).toBe(200)
    expect(await (await app.request('/api/employees/' + id)).json()).toMatchObject({
      id, firstName: 'Maya', departmentName: 'Opérations',
    })
  })

  it('logs completion and reopening once per change', async () => {
    const app = createApp()
    const path = '/api/onboarding-tasks/30000000-0000-4000-8000-000000000001'
    for (const status of ['done', 'done', 'pending']) {
      const response = await app.request(path, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ status })
    }
    expect(await (await app.request('/api/activity')).json()).toHaveLength(2)
  })

})
