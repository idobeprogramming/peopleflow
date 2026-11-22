import { describe, expect, it } from 'vitest'
import { createMemoryAuthRepository } from './memory-repository.js'
import { hashPassword } from './password.js'
import { createRateLimiter } from './rate-limit.js'
import { createAuthService, hashToken } from './service.js'

const fast = { cost: 2 ** 10 }

async function setup({ cost = fast.cost } = {}) {
  let now = new Date('2026-11-22T12:00:00Z')
  const clock = () => now
  const repository = createMemoryAuthRepository([{
    id: 'user-1', email: 'rh@example.test', displayName: 'Rose Hébert', role: 'hr',
    passwordHash: await hashPassword('Bon-Mot-De-Passe-1', { cost }),
  }])
  const service = createAuthService({
    repository,
    now: clock,
    hashOptions: fast,
    limiter: createRateLimiter({ limit: 3, windowMs: 15 * 60_000, now: () => now.getTime() }),
  })
  return { repository, service, advance: (ms: number) => { now = new Date(now.getTime() + ms) } }
}

describe('auth service', () => {
  it('logs in with the right password and returns the user without its hash', async () => {
    const { service } = await setup()
    const result = await service.login(' RH@example.test ', 'Bon-Mot-De-Passe-1', 'ip-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.user).toEqual({ id: 'user-1', email: 'rh@example.test', displayName: 'Rose Hébert', role: 'hr' })
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(JSON.stringify(result.user)).not.toContain('scrypt')
  })

  it('stores only a hash of the session token', async () => {
    const { repository, service } = await setup()
    const result = await service.login('rh@example.test', 'Bon-Mot-De-Passe-1', 'ip-1')
    if (!result.ok) throw new Error('login failed')
    expect(await repository.findSession(result.token)).toBeNull()
    expect(await repository.findSession(hashToken(result.token))).not.toBeNull()
  })

  it('gives the same answer for a wrong password and an unknown account', async () => {
    const { service } = await setup()
    expect(await service.login('rh@example.test', 'mauvais', 'ip-1')).toEqual({ ok: false, reason: 'invalid' })
    expect(await service.login('personne@example.test', 'mauvais', 'ip-1')).toEqual({ ok: false, reason: 'invalid' })
  })

  it('blocks an account after repeated failures, even with the right password, until the window ends', async () => {
    const { service, advance } = await setup()
    for (let attempt = 0; attempt < 3; attempt += 1) await service.login('rh@example.test', 'mauvais', `ip-${attempt}`)
    const blocked = await service.login('rh@example.test', 'Bon-Mot-De-Passe-1', 'ip-9')
    expect(blocked).toMatchObject({ ok: false, reason: 'rate_limited' })
    advance(15 * 60_000)
    expect((await service.login('rh@example.test', 'Bon-Mot-De-Passe-1', 'ip-9')).ok).toBe(true)
  })

  it('blocks a client that tries many accounts', async () => {
    const { service } = await setup()
    for (const email of ['a@x.test', 'b@x.test', 'c@x.test']) await service.login(email, 'mauvais', 'ip-1')
    expect(await service.login('rh@example.test', 'Bon-Mot-De-Passe-1', 'ip-1')).toMatchObject({ reason: 'rate_limited' })
  })

  it('authenticates a valid session and rejects an expired one', async () => {
    const { service, advance } = await setup()
    const result = await service.login('rh@example.test', 'Bon-Mot-De-Passe-1', 'ip-1')
    if (!result.ok) throw new Error('login failed')
    expect(await service.authenticate(result.token)).toMatchObject({ id: 'user-1' })
    advance(8 * 60 * 60_000)
    expect(await service.authenticate(result.token)).toBeNull()
  })

  it('revokes the session on logout', async () => {
    const { service } = await setup()
    const result = await service.login('rh@example.test', 'Bon-Mot-De-Passe-1', 'ip-1')
    if (!result.ok) throw new Error('login failed')
    await service.logout(result.token)
    expect(await service.authenticate(result.token)).toBeNull()
  })

  it('rejects missing or forged tokens', async () => {
    const { service } = await setup()
    expect(await service.authenticate(undefined)).toBeNull()
    expect(await service.authenticate('forged-token')).toBeNull()
  })

  it('re-hashes a password stored with weaker parameters after a successful login', async () => {
    const { repository, service } = await setup({ cost: 2 ** 9 })
    await service.login('rh@example.test', 'Bon-Mot-De-Passe-1', 'ip-1')
    expect((await repository.findUserByEmail('rh@example.test'))?.passwordHash).toMatch(/^scrypt\$1024\$/)
  })
})
