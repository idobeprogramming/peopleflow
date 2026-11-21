import { describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { createMemoryEmployeeRepository } from './memory-repository.js'

describe('employee directory API', () => {
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
})
