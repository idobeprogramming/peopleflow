import { createApp, type AppOptions } from './app.js'
import { DEMO_USER } from './auth/demo-account.js'
import { createMemoryAuthRepository } from './auth/memory-repository.js'
import { createAuthService, hashToken } from './auth/service.js'
import type { EmployeeRepository } from './employees/repository.js'

/** An app with an already signed-in demo user, so tests skip the deliberately slow password hash. */
export async function createSignedInApp(employees?: EmployeeRepository, options: AppOptions = {}) {
  const authRepository = createMemoryAuthRepository()
  const token = 'test-session-token'
  await authRepository.createSession({
    tokenHash: hashToken(token), userId: DEMO_USER.id, expiresAt: new Date(Date.now() + 60_000),
  })
  const app = createApp(employees, { ...options, auth: createAuthService({ repository: authRepository }) })
  const request = (path: string, init: RequestInit = {}) => app.request(path, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), Cookie: `peopleflow_session=${token}` },
  })
  return { app, request }
}
