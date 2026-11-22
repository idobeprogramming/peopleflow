// Smoke tests for a deployed environment.
// Usage: node scripts/smoke-test.mjs <base-url> [expected-version]   (AUTH="user:password" for basic auth)
const [baseUrl, expectedVersion] = process.argv.slice(2)
if (!baseUrl) throw new Error('Usage : node scripts/smoke-test.mjs <url> [version]')
const headers = process.env.AUTH ? { Authorization: 'Basic ' + Buffer.from(process.env.AUTH).toString('base64') } : {}
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
  ['annuaire depuis l’API', async () => {
    const response = await fetch(url('/api/employees'), { headers })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const employees = await response.json()
    if (!Array.isArray(employees) || employees.length === 0) throw new Error('aucun employé retourné')
    return `${employees.length} employés`
  }],
  ['départements', async () => {
    const response = await fetch(url('/api/departments'), { headers })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return `${(await response.json()).length} départements`
  }],
  ['page web', async () => {
    const response = await fetch(url('/'), { headers })
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
