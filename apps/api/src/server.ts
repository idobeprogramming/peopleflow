import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { createConfiguredAuthRepository } from './auth/supabase-repository.js'
import { createAuthService } from './auth/service.js'
import { createConfiguredEmployeeRepository } from './configure-repository.js'
import { createServerApp, serverOptionsFromEnv } from './http.js'

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) })
const port = Number(process.env.PORT ?? 3000)
const options = serverOptionsFromEnv()
const auth = createAuthService({ repository: createConfiguredAuthRepository() })

serve({ fetch: createServerApp(createConfiguredEmployeeRepository(), { ...options, auth }).fetch, port }, (info) => {
  console.log(`PeopleFlow API listening on http://localhost:${info.port}`)
})
