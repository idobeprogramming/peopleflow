import { DEMO_USER } from './demo-account.js'
import type { AuthRepository, StoredSession, StoredUser } from './repository.js'

export function createMemoryAuthRepository(seedUsers: StoredUser[] = [DEMO_USER]): AuthRepository {
  const users = new Map(seedUsers.map((user) => [user.email, { ...user }]))
  const sessions = new Map<string, StoredSession>()

  return {
    async findUserByEmail(email) {
      const user = users.get(email)
      return user ? { ...user } : null
    },
    async updatePasswordHash(userId, passwordHash) {
      for (const user of users.values()) if (user.id === userId) user.passwordHash = passwordHash
    },
    async createSession(session) {
      sessions.set(session.tokenHash, { ...session })
    },
    async findSession(tokenHash) {
      const session = sessions.get(tokenHash)
      const user = session && [...users.values()].find((candidate) => candidate.id === session.userId)
      if (!session || !user) return null
      const { passwordHash: _hash, ...publicUser } = user
      return { ...session, user: publicUser }
    },
    async deleteSession(tokenHash) {
      sessions.delete(tokenHash)
    },
  }
}
