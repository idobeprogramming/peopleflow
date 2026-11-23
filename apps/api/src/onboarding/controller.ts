import { Hono } from 'hono'
import { z } from 'zod'
import type { EmployeeRepository } from '../employees/repository.js'

export function onboardingController(repository: Pick<EmployeeRepository, 'listOnboardingTasks' | 'setTaskStatus'>) {
  const app = new Hono()
  app.patch('/:id', async (context) => {
    const parsed = z.object({ status: z.enum(['done', 'pending']) })
      .safeParse(await context.req.json().catch(() => null))
    if (!parsed.success) return context.json({ error: 'Statut de tâche invalide.' }, 400)
    const task = await repository.setTaskStatus(context.req.param('id'), parsed.data.status)
    if (!task) return context.json({ error: 'Tâche introuvable.' }, 404)
    return context.json(task)
  })

  app.get('/', async (context) => {
    const employeeId = context.req.query('employeeId')
    const tasks = await repository.listOnboardingTasks(employeeId)

    return context.json(tasks)
  })

  return app
}
