// Smoke tests for a deployed environment.
// Usage: node scripts/smoke-test.mjs <base-url> [expected-version]
// SMOKE_LOGIN="email:password" also signs in and reads the directory with a real session.
const [baseUrl, expectedVersion] = process.argv.slice(2)
if (!baseUrl) throw new Error('Usage : node scripts/smoke-test.mjs <url> [version]')
const headers = {}
const url = (path) => new URL(path, baseUrl).toString()
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForVersion() {
  const deadline = Date.now() + Number(process.env.SMOKE_TIMEOUT_MS ?? 6 * 60_000)
  let last = 'aucune réponse'
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url('/api/health'))
      const body = await response.json()
      last = `${response.status} ${JSON.stringify(body)}`
      if (response.ok && (!expectedVersion || body.version === expectedVersion)) return body
    } catch (error) {
      last = String(error)
    }
    await sleep(10_000)
  }
  throw new Error(`La version ${expectedVersion ?? ''} n’est pas en ligne. Dernière réponse : ${last}`)
}

const checks = [
  ['santé et version', async () => `version ${(await waitForVersion()).version ?? 'inconnue'}`],
  ['API fermée sans session', async () => {
    const response = await fetch(url('/api/employees'))
    if (response.status !== 401) throw new Error(`HTTP ${response.status} au lieu de 401`)
    return '401'
  }],
  ['connexion et annuaire', async () => {
    if (!process.env.SMOKE_LOGIN) return 'ignoré (SMOKE_LOGIN absent)'
    const separator = process.env.SMOKE_LOGIN.indexOf(':')
    const email = process.env.SMOKE_LOGIN.slice(0, separator)
    const password = process.env.SMOKE_LOGIN.slice(separator + 1)
    const login = await fetch(url('/api/auth/login'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    })
    if (!login.ok) throw new Error(`connexion HTTP ${login.status}`)
    headers.Cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]
    const response = await fetch(url('/api/employees'), { headers })
    if (!response.ok) throw new Error(`annuaire HTTP ${response.status}`)
    const employees = await response.json()
    if (!Array.isArray(employees) || employees.length === 0) throw new Error('aucun employé retourné')
    await fetch(url('/api/auth/logout'), { method: 'POST', headers })
    return `${employees.length} employés, session fermée`
  }],
  ['page web', async () => {
    const response = await fetch(url('/'))
    const html = await response.text()
    if (!response.ok || !html.includes('id="root"')) throw new Error(`HTTP ${response.status}, pas de #root`)
    return 'index.html servi'
  }],
]

let failed = 0
for (const [name, check] of checks) {
  try {
    console.log(`✅ ${name} — ${await check()}`)
  } catch (error) {
    failed += 1
    console.log(`❌ ${name} — ${error instanceof Error ? error.message : error}`)
  }
}
process.exitCode = failed ? 1 : 0
