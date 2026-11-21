import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { createConfiguredEmployeeRepository } from './employees/supabase-repository.js'

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) })
const port = Number(process.env.PORT ?? 3000)

serve({ fetch: createApp(createConfiguredEmployeeRepository()).fetch, port }, (info) => {
  console.log(`PeopleFlow API listening on http://localhost:${info.port}`)
})
