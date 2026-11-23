import { DEMO_USER } from './demo-account.js'

/**
 * Development only: a local database migrated without replaying the seed has no account to log in
 * with. Adds the fictional demo account when missing; an existing account is left untouched.
 */
export async function ensureDemoAccount(apiUrl: string, headers: Record<string, string>, request: typeof fetch = fetch) {
  if (!['localhost', '127.0.0.1'].includes(new URL(apiUrl).hostname)) {
    throw new Error('Le compte de démonstration se crée seulement dans une base locale.')
  }
  const response = await request(new URL('/rest/v1/app_users?on_conflict=email', apiUrl), {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json', prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({
      id: DEMO_USER.id, email: DEMO_USER.email, password_hash: DEMO_USER.passwordHash,
      display_name: DEMO_USER.displayName, role: DEMO_USER.role,
    }),
  })
  if (!response.ok) throw new Error(`Compte de démonstration non créé (${response.status}).`)
}
