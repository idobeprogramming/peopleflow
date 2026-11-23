import type { StoredUser } from './repository.js'

/**
 * Fictional demo account, also created by supabase/seed.sql. The password is public on
 * purpose: the login page shows it when DEMO_ACCOUNT=true. Disable that flag and remove
 * this account in a real deployment.
 */
export const DEMO_ACCOUNT = {
  email: 'camille.fortin@example.test',
  password: 'PeopleFlow-Demo-2026!',
} as const

export const DEMO_USER: StoredUser = {
  id: '30000000-0000-4000-8000-000000000001',
  email: DEMO_ACCOUNT.email,
  displayName: 'Camille Fortin',
  role: 'admin',
  // scrypt N=2^17, r=8, p=1 hash of DEMO_ACCOUNT.password.
  passwordHash: 'scrypt$131072$8$1$CDrUOg0-8RkPT9a4crqVCA$-Rz5tZka5q3SSN9C-VCCMOfk3P0CLVXahM4M6_FyMYs',
}
