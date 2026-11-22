import { describe, expect, it } from 'vitest'
import { hashPassword, needsRehash, verifyPassword } from './password.js'

// Low cost keeps these tests fast; production uses the defaults (OWASP scrypt minimum).
const fast = { cost: 2 ** 10 }

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple', fast)
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true)
    expect(await verifyPassword('correct horse battery stapler', hash)).toBe(false)
  })

  it('never stores the password and salts every hash', async () => {
    const first = await hashPassword('same password', fast)
    const second = await hashPassword('same password', fast)
    expect(first).not.toContain('same password')
    expect(first).not.toBe(second)
    expect(first).toMatch(/^scrypt\$1024\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/)
  })

  it('rejects malformed or foreign hashes instead of throwing', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false)
    expect(await verifyPassword('x', 'bcrypt$10$abc')).toBe(false)
    expect(await verifyPassword('x', 'scrypt$999999999$8$1$a$b')).toBe(false)
  })

  it('asks for a rehash when stored parameters are weaker than the current ones', async () => {
    const weak = await hashPassword('pw', fast)
    expect(needsRehash(weak)).toBe(true)
    expect(needsRehash(weak, fast)).toBe(false)
  })
})
