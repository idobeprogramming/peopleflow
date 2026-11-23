import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { createConfiguredEmployeeRepository } from './configure-repository.js'
import { createServerApp, serverOptionsFromEnv } from './http.js'

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) })
const port = Number(process.env.PORT ?? 3000)
const options = serverOptionsFromEnv()

if (process.env.NODE_ENV === 'production' && !options.basicAuth) {
  throw new Error('BASIC_AUTH_USER et BASIC_AUTH_PASSWORD sont requis en production : l’application n’a pas encore de connexion.')
}

serve({ fetch: createServerApp(createConfiguredEmployeeRepository(), options).fetch, port }, (info) => {
  console.log(`PeopleFlow API listening on http://localhost:${info.port}`)
})
