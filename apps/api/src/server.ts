import 'dotenv/config'
import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { createConfiguredEmployeeRepository } from './employees/supabase-repository.js'

const port = Number(process.env.PORT ?? 3000)

serve({ fetch: createApp(createConfiguredEmployeeRepository()).fetch, port }, (info) => {
  console.log(`PeopleFlow API listening on http://localhost:${info.port}`)
})
