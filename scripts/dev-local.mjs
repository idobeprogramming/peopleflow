import { spawnSync } from 'node:child_process'
import { parseEnv } from 'node:util'

const npm = process.env.npm_execpath
const status = spawnSync(process.execPath, [npm, 'exec', '--offline', '--', 'supabase', 'status', '-o', 'env'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
})
if (status.status !== 0) throw new Error('Impossible de lire la configuration Supabase locale.')
const { API_URL, SERVICE_ROLE_KEY, SECRET_KEY } = parseEnv(status.stdout)
const key = SERVICE_ROLE_KEY || SECRET_KEY
if (!API_URL || !key || !['localhost', '127.0.0.1'].includes(new URL(API_URL).hostname)) {
  throw new Error('Configuration Supabase locale incomplète.')
}
for (const table of ['employees', 'departments', 'onboarding_tasks', 'audit_events', 'app_users', 'user_sessions']) {
  const response = await fetch(new URL('/rest/v1/' + table + '?select=id&limit=1', API_URL), {
    headers: { apikey: key, ...(SERVICE_ROLE_KEY ? { Authorization: 'Bearer ' + key } : {}) },
  })
  if (!response.ok) throw new Error('Table inaccessible : ' + table + ' (' + response.status + ')')
}
console.log('Les tables PeopleFlow sont accessibles.')
const dev = spawnSync(process.execPath, [npm, 'run', 'dev'], {
  stdio: 'inherit', env: { DEMO_ACCOUNT: 'true', ...process.env, SUPABASE_URL: API_URL, SUPABASE_SERVICE_ROLE_KEY: key },
})
process.exitCode = dev.status ?? 1
