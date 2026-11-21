import { Hono } from 'hono'
import type { Employee } from '../../../packages/domain/src/types.js'
import {
  createMemoryEmployeeRepository,
  type EmployeeRepository,
} from './employees/memory-repository.js'

export function createApp(
  repository: EmployeeRepository = createMemoryEmployeeRepository(),
) {
  const app = new Hono()

  app.get('/api/health', (context) => context.json({ status: 'ok' }))

  app.get('/api/departments', async (context) => {
    return context.json(await repository.listDepartments())
  })

  app.get('/api/employees', async (context) => {
    const query = (context.req.query('q') ?? '').trim().toLocaleLowerCase('fr-CA')
    const departmentId = context.req.query('departmentId')
    const status = context.req.query('status')
    const employees = await repository.listEmployees()
    const filtered = employees.filter((employee: Employee) => {
      const matchesQuery =
        query.length === 0 ||
        [
          employee.firstName,
          employee.lastName,
          employee.email,
          employee.jobTitle,
          employee.departmentName,
        ].some((value) => value.toLocaleLowerCase('fr-CA').includes(query))
      const matchesDepartment = !departmentId || employee.departmentId === departmentId
      const matchesStatus = !status || employee.status === status

      return matchesQuery && matchesDepartment && matchesStatus
    })

    return context.json(filtered)
  })

  app.get('/api/employees/:id', async (context) => {
    const employee = await repository.getEmployee(context.req.param('id'))

    if (!employee) {
      return context.json({ error: 'Employé introuvable.' }, 404)
    }

    return context.json(employee)
  })

  return app
}
