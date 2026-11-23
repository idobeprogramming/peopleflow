import { describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { DEMO_ACCOUNT } from './demo-account.js'
import { createMemoryAuthRepository } from './memory-repository.js'
import { createRateLimiter } from './rate-limit.js'
import { createAuthService } from './service.js'

const json = { 'Content-Type': 'application/json' }
const credentials = JSON.stringify({ email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password })

function login(app: ReturnType<typeof createApp>, body = credentials, headers: Record<string, string> = {}) {
  return app.request('/api/auth/login', { method: 'POST', headers: { ...json, ...headers }, body })
}

function sessionCookie(response: Response) {
  return response.headers.get('set-cookie')?.split(';')[0] ?? ''
}

describe('auth routes', () => {
  it('protects the API but keeps the health check public', async () => {
    const app = createApp()
    expect((await app.request('/api/health')).status).toBe(200)
    const response = await app.request('/api/employees')
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentification requise.' })
  })

  it('signs in and sets a hardened session cookie', async () => {
    const response = await login(createApp())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      user: { id: expect.any(String), email: DEMO_ACCOUNT.email, displayName: 'Camille Fortin', role: 'admin' },
    })
    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/^peopleflow_session=[A-Za-z0-9_-]{43};/)
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Strict/)
    expect(cookie).toMatch(/Path=\//)
    expect(cookie).toMatch(/Max-Age=28800/)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('uses a __Host- Secure cookie in production', async () => {
    const response = await login(createApp(undefined, { secureCookies: true }))
    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/^__Host-peopleflow_session=/)
    expect(cookie).toMatch(/Secure/)
  })

  it('opens the API with the session and returns the current user', async () => {
    const app = createApp()
    const cookie = sessionCookie(await login(app))
    expect((await app.request('/api/employees', { headers: { Cookie: cookie } })).status).toBe(200)
    const me = await app.request('/api/auth/me', { headers: { Cookie: cookie } })
    expect(await me.json()).toMatchObject({ user: { email: DEMO_ACCOUNT.email } })
  })

  it('answers a wrong password with a generic message', async () => {
    const response = await login(createApp(), JSON.stringify({ email: DEMO_ACCOUNT.email, password: 'mauvais' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Courriel ou mot de passe invalide.' })
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('rejects malformed bodies', async () => {
    expect((await login(createApp(), '{"email":"x"}')).status).toBe(400)
    expect((await login(createApp(), JSON.stringify({ email: 'a@b.c', password: 'x'.repeat(2000) }))).status).toBe(400)
  })

  it('refuses oversized request bodies before reading them', async () => {
    const response = await login(createApp(), JSON.stringify({ email: 'a@b.c', password: 'x', padding: 'y'.repeat(20_000) }))
    expect(response.status).toBe(413)
  })

  it('slows down repeated failures with 429 and Retry-After', async () => {
    const auth = createAuthService({
      repository: createMemoryAuthRepository(),
      limiter: createRateLimiter({ limit: 1, windowMs: 60_000 }),
    })
    const app = createApp(undefined, { auth })
    await login(app, JSON.stringify({ email: DEMO_ACCOUNT.email, password: 'mauvais' }))
    const response = await login(app)
    expect(response.status).toBe(429)
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0)
  })

  it('logs out by revoking the session and clearing the cookie', async () => {
    const app = createApp()
    const cookie = sessionCookie(await login(app))
    const response = await app.request('/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } })
    expect(response.status).toBe(204)
    expect(response.headers.get('set-cookie')).toMatch(/Max-Age=0/)
    expect((await app.request('/api/auth/me', { headers: { Cookie: cookie } })).status).toBe(401)
  })

  it('refuses state-changing requests from another site', async () => {
    const app = createApp()
    const response = await login(app, credentials, { Origin: 'https://evil.example', Host: 'peopleflow.example' })
    expect(response.status).toBe(403)
    const sameSite = await login(app, credentials, { Origin: 'https://peopleflow.example', Host: 'peopleflow.example' })
    expect(sameSite.status).toBe(200)
  })

  it('shows the demo account only when the server allows it', async () => {
    const shown = await createApp(undefined, { demoAccount: true }).request('/api/auth/options')
    expect(await shown.json()).toEqual({ demoAccount: DEMO_ACCOUNT })
    const hidden = await createApp(undefined, { demoAccount: false }).request('/api/auth/options')
    expect(await hidden.json()).toEqual({ demoAccount: null })
  })
})
