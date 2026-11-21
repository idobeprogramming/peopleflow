import { Hono } from 'hono'
import { z } from 'zod'
import { filterEmployees } from '../../../packages/domain/src/directory.js'
import {
  createMemoryEmployeeRepository,
  type EmployeeRepository,
} from './employees/memory-repository.js'

export function createApp(
  repository: EmployeeRepository = createMemoryEmployeeRepository(),
) {
  const app = new Hono()
  const employeeInputSchema = z.object({
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    email: z.string().trim().email().max(180).transform((value) => value.toLowerCase()),
    jobTitle: z.string().trim().min(1).max(100),
    departmentId: z.string().uuid(),
    managerId: z.string().uuid().nullable().optional(),
    status: z.enum(['active', 'onboarding', 'leave', 'inactive']),
    employmentType: z.enum(['full_time', 'part_time', 'contract']),
    hireDate: z.iso.date(),
    location: z.string().trim().min(1).max(100),
  })

  app.get('/api/health', (context) => context.json({ status: 'ok' }))

  app.get('/api/departments', async (context) => {
    return context.json(await repository.listDepartments())
  })

  app.get('/api/employees', async (context) => {
    const query = (context.req.query('q') ?? '').trim().toLocaleLowerCase('fr-CA')
    const departmentId = context.req.query('departmentId')
    const status = context.req.query('status')
    const employees = await repository.listEmployees()
    return context.json(filterEmployees(employees, query, departmentId, status))
  })

  const saveEmployee: import('hono').Handler = async (context) => {
    const id = context.req.param('id')
    const parsed = employeeInputSchema.safeParse(await context.req.json().catch(() => null))

    if (!parsed.success) {
      return context.json({ error: 'Données invalides.', details: parsed.error.issues }, 400)
    }

    const [employees, departments] = await Promise.all([
      repository.listEmployees(),
      repository.listDepartments(),
    ])
    const input = parsed.data
    if (id && !employees.some((employee) => employee.id === id)) {
      return context.json({ error: 'Employé introuvable.' }, 404)
    }
    const visited = new Set<string>()
    let ancestor = input.managerId
    while (ancestor) {
      if (ancestor === id || visited.has(ancestor)) {
        return context.json({ error: 'Ce gestionnaire créerait une boucle hiérarchique.' }, 400)
      }
      visited.add(ancestor)
      ancestor = employees.find((employee) => employee.id === ancestor)?.managerId
    }

    if (!departments.some((department) => department.id === input.departmentId)) {
      return context.json({ error: 'Département introuvable.' }, 400)
    }

    if (input.managerId && !employees.some((employee) => employee.id === input.managerId)) {
      return context.json({ error: 'Gestionnaire introuvable.' }, 400)
    }

    if (employees.some((employee) => employee.id !== id && employee.email.toLowerCase() === input.email)) {
      return context.json({ error: 'Cette adresse courriel est déjà utilisée.' }, 409)
    }

    if (id) return context.json(await repository.updateEmployee(id, input))
    return context.json(await repository.createEmployee(input), 201)
  }
  app.post('/api/employees', saveEmployee)
  app.put('/api/employees/:id', saveEmployee)

  app.get('/api/activity', async (context) => context.json(await repository.listActivity()))
  app.patch('/api/onboarding-tasks/:id', async (context) => {
    const parsed = z.object({ status: z.enum(['done', 'pending']) })
      .safeParse(await context.req.json().catch(() => null))
    if (!parsed.success) return context.json({ error: 'Statut de tâche invalide.' }, 400)
    const task = await repository.setTaskStatus(context.req.param('id'), parsed.data.status)
    if (!task) return context.json({ error: 'Tâche introuvable.' }, 404)
    return context.json(task)
  })

  app.get('/api/employees/:id', async (context) => {
    const employee = await repository.getEmployee(context.req.param('id'))

    if (!employee) {
      return context.json({ error: 'Employé introuvable.' }, 404)
    }

    return context.json(employee)
  })

  app.get('/api/onboarding-tasks', async (context) => {
    const employeeId = context.req.query('employeeId')
    const tasks = await repository.listOnboardingTasks(employeeId)

    return context.json(tasks)
  })

  return app
}
