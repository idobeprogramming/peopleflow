import { Hono } from 'hono'
import { employeeController } from './employees/controller.js'
import { createMemoryEmployeeRepository } from './employees/memory-repository.js'
import type { EmployeeRepository } from './employees/repository.js'
import { EmployeeService } from './employees/service.js'
import { onboardingController } from './onboarding/controller.js'

export function createApp(repository: EmployeeRepository = createMemoryEmployeeRepository()) {
  const app = new Hono()
  app.route('/api/employees', employeeController(new EmployeeService(repository)))
  app.route('/api/onboarding-tasks', onboardingController(repository))
  app.get('/api/activity', async (context) => context.json(await repository.listActivity()))
  app.get('/api/health', (context) => {
    const version = process.env.APP_VERSION
    return context.json(version ? { status: 'ok', version } : { status: 'ok' })
  })

  app.get('/api/departments', async (context) => {
    return context.json(await repository.listDepartments())
  })

  return app
}
