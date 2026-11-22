import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createServerApp } from './http.js'

const credentials = { username: 'demo', password: 'secret-demo' }
const authHeader = { Authorization: 'Basic ' + Buffer.from('demo:secret-demo').toString('base64') }

describe('server app for deployed environments', () => {
  it('requires basic auth on the API when credentials are configured', async () => {
    const app = createServerApp(undefined, { basicAuth: credentials })
    expect((await app.request('/api/employees')).status).toBe(401)
    expect((await app.request('/api/employees', { headers: authHeader })).status).toBe(200)
  })

  it('keeps the health check open for platform probes and smoke tests', async () => {
    const app = createServerApp(undefined, { basicAuth: credentials })
    expect((await app.request('/api/health')).status).toBe(200)
  })

  it('serves the built web app and falls back to index.html for client routes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'peopleflow-web-'))
    writeFileSync(join(dir, 'index.html'), '<div id="root">PeopleFlow</div>')
    writeFileSync(join(dir, 'app.js'), 'console.log(1)')
    const app = createServerApp(undefined, { staticDir: dir })

    expect(await (await app.request('/')).text()).toContain('PeopleFlow')
    expect(await (await app.request('/app.js')).text()).toContain('console.log')
    expect(await (await app.request('/employes')).text()).toContain('PeopleFlow')
  })

  it('does not hide unknown API routes behind the web fallback', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'peopleflow-web-'))
    writeFileSync(join(dir, 'index.html'), 'index')
    const response = await createServerApp(undefined, { staticDir: dir }).request('/api/nope')
    expect(response.status).toBe(404)
  })

  it('protects the web app with the same credentials', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'peopleflow-web-'))
    writeFileSync(join(dir, 'index.html'), 'index')
    const app = createServerApp(undefined, { staticDir: dir, basicAuth: credentials })
    expect((await app.request('/')).status).toBe(401)
  })
})

describe('static file safety', () => {
  it('never serves a file outside the web build directory', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'peopleflow-web-'))
    writeFileSync(join(dir, 'index.html'), 'index')
    const response = await createServerApp(undefined, { staticDir: dir }).request('/..%2f..%2f..%2fetc%2fpasswd.json')
    expect(await response.text()).toBe('index')
  })
})
