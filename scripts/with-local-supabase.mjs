// Runs a command with SUPABASE_URL and the service key of the *local* Supabase stack.
// Usage: node scripts/with-local-supabase.mjs <command> [...args]
import { spawnSync } from 'node:child_process'
import { parseEnv } from 'node:util'

const [command, ...args] = process.argv.slice(2)
if (!command) throw new Error('Usage : node scripts/with-local-supabase.mjs <commande> [...args]')

const status = spawnSync('npx', ['--no-install', 'supabase', 'status', '-o', 'env'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32',
})
if (status.status !== 0) throw new Error('Supabase local introuvable. Lancer `npm run db:start` d’abord.')
const { API_URL, SERVICE_ROLE_KEY, SECRET_KEY } = parseEnv(status.stdout)
const key = SERVICE_ROLE_KEY || SECRET_KEY
if (!API_URL || !key || !['localhost', '127.0.0.1'].includes(new URL(API_URL).hostname)) {
  throw new Error('Configuration Supabase locale incomplète; ce script refuse une base distante.')
}
const run = spawnSync('npx', ['--no-install', command, ...args], {
  stdio: 'inherit', shell: process.platform === 'win32',
  env: { ...process.env, SUPABASE_URL: API_URL, SUPABASE_SERVICE_ROLE_KEY: key },
})
process.exitCode = run.status ?? 1
