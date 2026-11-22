import type { AuthUser } from '../../../../packages/domain/src/types.js'

export interface StoredUser extends AuthUser {
  passwordHash: string
}

export interface StoredSession {
  tokenHash: string
  userId: string
  expiresAt: Date
}

/** Persistence for accounts and sessions. Session tokens arrive here already hashed. */
export interface AuthRepository {
  findUserByEmail(email: string): Promise<StoredUser | null>
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>
  createSession(session: StoredSession): Promise<void>
  findSession(tokenHash: string): Promise<(StoredSession & { user: AuthUser }) | null>
  deleteSession(tokenHash: string): Promise<void>
}
