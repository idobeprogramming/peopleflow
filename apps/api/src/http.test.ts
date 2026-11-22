import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createServerApp, serverOptionsFromEnv } from './http.js'

function webBuild() {
  const dir = mkdtempSync(join(tmpdir(), 'peopleflow-web-'))
  writeFileSync(join(dir, 'index.html'), '<div id="root">PeopleFlow</div>')
  writeFileSync(join(dir, 'app.js'), 'console.log(1)')
  return dir
}

describe('server app for deployed environments', () => {
  it('serves the built web app and falls back to index.html for client routes', async () => {
    const app = createServerApp(undefined, { staticDir: webBuild() })
    expect(await (await app.request('/')).text()).toContain('PeopleFlow')
    expect(await (await app.request('/app.js')).text()).toContain('console.log')
    expect(await (await app.request('/employes')).text()).toContain('PeopleFlow')
  })

  it('never serves the web fallback for API routes', async () => {
    const response = await createServerApp(undefined, { staticDir: webBuild() }).request('/api/nope')
    expect(response.status).toBe(401)
    expect(response.headers.get('content-type')).toMatch(/json/)
  })

  it('never serves a file outside the web build directory', async () => {
    const response = await createServerApp(undefined, { staticDir: webBuild() }).request('/..%2f..%2f..%2fetc%2fpasswd.json')
    expect(await response.text()).toContain('PeopleFlow')
  })

  it('sends security headers, including a strict content security policy', async () => {
    const response = await createServerApp(undefined, { staticDir: webBuild() }).request('/')
    const csp = response.headers.get('content-security-policy') ?? ''
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('strict-transport-security')).toMatch(/max-age=/)
  })

  it('reads production settings from the environment', () => {
    expect(serverOptionsFromEnv({ NODE_ENV: 'production', DEMO_ACCOUNT: 'true', TRUST_PROXY: 'true' })).toMatchObject({
      secureCookies: true, demoAccount: true, trustProxy: true,
    })
    expect(serverOptionsFromEnv({})).toMatchObject({ secureCookies: false, demoAccount: false, trustProxy: false })
  })
})
