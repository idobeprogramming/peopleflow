import { Hono } from 'hono'
import { createMemoryAuthRepository } from './auth/memory-repository.js'
import { authRoutes, requireSession, sameOriginWrites, type AuthVariables } from './auth/routes.js'
import { createAuthService, type AuthService } from './auth/service.js'
import { employeeController } from './employees/controller.js'
import { createMemoryEmployeeRepository } from './employees/memory-repository.js'
import type { EmployeeRepository } from './employees/repository.js'
import { EmployeeService } from './employees/service.js'
import { onboardingController } from './onboarding/controller.js'

export interface AppOptions {
  auth?: AuthService
  /** Secure, __Host- prefixed cookie. Defaults to true in production. */
  secureCookies?: boolean
  /** Show the public demo credentials on the login page. */
  demoAccount?: boolean
  /** Read the client IP from X-Forwarded-For (only behind a trusted proxy). */
  trustProxy?: boolean
}

export function createApp(
  repository: EmployeeRepository = createMemoryEmployeeRepository(),
  options: AppOptions = {},
) {
  const app = new Hono<{ Variables: AuthVariables }>()
  const auth = {
    service: options.auth ?? createAuthService({ repository: createMemoryAuthRepository() }),
    secureCookies: options.secureCookies ?? process.env.NODE_ENV === 'production',
    demoAccount: options.demoAccount ?? false,
    trustProxy: options.trustProxy ?? false,
  }

  app.use('/api/*', sameOriginWrites)
  app.use('/api/*', requireSession(auth))
  app.route('/api/auth', authRoutes(auth))
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
