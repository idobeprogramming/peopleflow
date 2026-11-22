import { createHash, randomBytes } from 'node:crypto'
import type { AuthUser } from '../../../../packages/domain/src/types.js'
import { hashPassword, needsRehash, verifyPassword, type HashOptions } from './password.js'
import { createRateLimiter, type RateLimiter } from './rate-limit.js'
import type { AuthRepository } from './repository.js'

export const SESSION_TTL_MS = 8 * 60 * 60_000

// Verified when the account does not exist, so both cases take the same time.
const DUMMY_HASH = 'scrypt$131072$8$1$fetqBMDbjWhNDCHnicb69g$xQ-3EZhrY5j0Ypjq9pO7hj6ryCAHN4a3ebPLnyZVTc8'

export type LoginResult =
  | { ok: true; user: AuthUser; token: string; expiresAt: Date }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }

export interface AuthServiceOptions {
  repository: AuthRepository
  now?: () => Date
  sessionTtlMs?: number
  hashOptions?: HashOptions
  limiter?: RateLimiter
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('base64url')
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function createAuthService({
  repository,
  now = () => new Date(),
  sessionTtlMs = SESSION_TTL_MS,
  hashOptions,
  limiter = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 }),
}: AuthServiceOptions) {
  return {
    async login(rawEmail: string, password: string, clientKey: string): Promise<LoginResult> {
      const email = normalizeEmail(rawEmail)
      const keys = [`email:${email}`, `client:${clientKey}`]
      const retryAfterSeconds = Math.max(...keys.map((key) => limiter.retryAfter(key)))
      if (retryAfterSeconds > 0) return { ok: false, reason: 'rate_limited', retryAfterSeconds }

      const user = await repository.findUserByEmail(email)
      const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)
      if (!user || !valid) {
        keys.forEach((key) => limiter.fail(key))
        return { ok: false, reason: 'invalid' }
      }
      limiter.reset(keys[0]!)

      if (needsRehash(user.passwordHash, hashOptions)) {
        await repository.updatePasswordHash(user.id, await hashPassword(password, hashOptions))
      }

      const token = randomBytes(32).toString('base64url')
      const expiresAt = new Date(now().getTime() + sessionTtlMs)
      await repository.createSession({ tokenHash: hashToken(token), userId: user.id, expiresAt })
      const { passwordHash: _hash, ...publicUser } = user
      return { ok: true, user: publicUser, token, expiresAt }
    },

    async authenticate(token: string | undefined): Promise<AuthUser | null> {
      if (!token) return null
      const tokenHash = hashToken(token)
      const session = await repository.findSession(tokenHash)
      if (!session) return null
      if (session.expiresAt <= now()) {
        await repository.deleteSession(tokenHash)
        return null
      }
      return session.user
    },

    async logout(token: string | undefined) {
      if (token) await repository.deleteSession(hashToken(token))
    },
  }
}

export type AuthService = ReturnType<typeof createAuthService>
