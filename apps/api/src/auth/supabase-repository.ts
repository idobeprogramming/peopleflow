import { createClient } from '@supabase/supabase-js'
import type { UserRole } from '../../../../packages/domain/src/types.js'
import { createMemoryAuthRepository } from './memory-repository.js'
import type { AuthRepository, StoredUser } from './repository.js'

interface UserRow {
  id: string
  email: string
  password_hash: string
  display_name: string
  role: UserRole
}

function toUser(row: UserRow): StoredUser {
  return { id: row.id, email: row.email, displayName: row.display_name, role: row.role, passwordHash: row.password_hash }
}

export function createSupabaseAuthRepository(url: string, serviceRoleKey: string): AuthRepository {
  const client = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const userColumns = 'id, email, password_hash, display_name, role'

  return {
    async findUserByEmail(email) {
      const { data, error } = await client.from('app_users').select(userColumns).eq('email', email).maybeSingle()
      if (error) throw new Error(`Could not load user: ${error.message}`)
      return data ? toUser(data as UserRow) : null
    },
    async updatePasswordHash(userId, passwordHash) {
      const { error } = await client.from('app_users')
        .update({ password_hash: passwordHash, updated_at: new Date().toISOString() }).eq('id', userId)
      if (error) throw new Error(`Could not update password hash: ${error.message}`)
    },
    async createSession({ tokenHash, userId, expiresAt }) {
      const { error } = await client.from('user_sessions')
        .insert({ token_hash: tokenHash, user_id: userId, expires_at: expiresAt.toISOString() })
      if (error) throw new Error(`Could not create session: ${error.message}`)
    },
    async findSession(tokenHash) {
      const { data, error } = await client.from('user_sessions')
        .select(`token_hash, user_id, expires_at, app_users (${userColumns})`).eq('token_hash', tokenHash).maybeSingle()
      if (error) throw new Error(`Could not load session: ${error.message}`)
      const row = data as { token_hash: string; user_id: string; expires_at: string; app_users: UserRow | null } | null
      if (!row?.app_users) return null
      const { passwordHash: _hash, ...user } = toUser(row.app_users)
      return { tokenHash: row.token_hash, userId: row.user_id, expiresAt: new Date(row.expires_at), user }
    },
    async deleteSession(tokenHash) {
      const { error } = await client.from('user_sessions').delete().eq('token_hash', tokenHash)
      if (error) throw new Error(`Could not delete session: ${error.message}`)
    },
  }
}

export function createConfiguredAuthRepository(): AuthRepository {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createSupabaseAuthRepository(url, key) : createMemoryAuthRepository()
}
