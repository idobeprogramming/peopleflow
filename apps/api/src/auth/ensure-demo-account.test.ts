import { describe, expect, it, vi } from 'vitest'
import { DEMO_USER } from './demo-account.js'
import { ensureDemoAccount } from './ensure-demo-account.js'

const url = 'http://127.0.0.1:54321'
const headers = { apikey: 'local' }

describe('ensureDemoAccount', () => {
  it('ajoute le compte seulement s’il manque, sans écraser un compte existant', async () => {
    const request = vi.fn<typeof fetch>(async () => new Response(null, { status: 201 }))
    await ensureDemoAccount(url, headers, request)
    const [target, init] = request.mock.calls[0]!
    expect(String(target)).toBe(`${url}/rest/v1/app_users?on_conflict=email`)
    expect(init?.headers).toMatchObject({ apikey: 'local', prefer: 'resolution=ignore-duplicates,return=minimal' })
    expect(JSON.parse(String(init?.body))).toEqual({
      id: DEMO_USER.id, email: DEMO_USER.email, password_hash: DEMO_USER.passwordHash,
      display_name: DEMO_USER.displayName, role: DEMO_USER.role,
    })
  })

  it('refuse une base qui n’est pas locale', async () => {
    const request = vi.fn<typeof fetch>()
    await expect(ensureDemoAccount('https://projet.supabase.co', headers, request)).rejects.toThrow('base locale')
    expect(request).not.toHaveBeenCalled()
  })

  it('signale un refus de la base', async () => {
    const request = vi.fn<typeof fetch>(async () => new Response(null, { status: 403 }))
    await expect(ensureDemoAccount(url, headers, request)).rejects.toThrow('403')
  })
})
