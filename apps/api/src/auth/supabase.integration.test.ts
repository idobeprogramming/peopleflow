import { beforeAll, describe, expect, it } from 'vitest'
import { DEMO_ACCOUNT } from './demo-account.js'
import { createSupabaseAuthRepository } from './supabase-repository.js'
import { createAuthService, hashToken } from './service.js'

// Runs only against a local Supabase (CI database job or `npm run test:integration`).
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const isLocal = !!url && ['localhost', '127.0.0.1'].includes(new URL(url).hostname)

describe.skipIf(!isLocal || !key)('auth against the seeded local database', () => {
  let repository: ReturnType<typeof createSupabaseAuthRepository>
  beforeAll(() => {
    repository = createSupabaseAuthRepository(url!, key!)
  })

  it('signs in the seeded demo account, persists a hashed session and revokes it', async () => {
    const service = createAuthService({ repository })
    const result = await service.login(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password, 'integration')
    if (!result.ok) throw new Error('demo login failed')

    expect(await repository.findSession(hashToken(result.token))).toMatchObject({ user: { email: DEMO_ACCOUNT.email } })
    expect(await service.authenticate(result.token)).toMatchObject({ displayName: 'Camille Fortin', role: 'admin' })

    await service.logout(result.token)
    expect(await service.authenticate(result.token)).toBeNull()
  })

  it('rejects a wrong password against the stored hash', async () => {
    const service = createAuthService({ repository })
    expect(await service.login(DEMO_ACCOUNT.email, 'mauvais', 'integration-2')).toEqual({ ok: false, reason: 'invalid' })
  })
})
