import { readFile } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { Hono } from 'hono'
import { basicAuth } from 'hono/basic-auth'
import { createApp } from './app.js'
import type { EmployeeRepository } from './employees/repository.js'

export interface ServerOptions {
  /** Directory of the built web app (apps/web/dist). When set, the API also serves the SPA. */
  staticDir?: string
  /** Protects everything except /api/health. Required before exposing a deployed environment. */
  basicAuth?: { username: string; password: string }
}

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2',
}

export function createServerApp(repository?: EmployeeRepository, options: ServerOptions = {}) {
  const app = new Hono()

  if (options.basicAuth) {
    const guard = basicAuth(options.basicAuth)
    app.use('*', (context, next) => (context.req.path === '/api/health' ? next() : guard(context, next)))
  }

  app.route('/', createApp(repository))

  if (options.staticDir) {
    const root = resolve(options.staticDir)
    app.get('*', async (context) => {
      if (context.req.path.startsWith('/api/')) return context.json({ error: 'Route introuvable.' }, 404)
      const requested = resolve(root, '.' + decodeURIComponent(context.req.path))
      const insideRoot = requested === root || relative(root, requested).split(sep)[0] !== '..'
      const extension = requested.slice(requested.lastIndexOf('.'))
      const file = insideRoot && contentTypes[extension] ? requested : join(root, 'index.html')
      try {
        const body = await readFile(file)
        const type = contentTypes[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'
        const cache = file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache'
        return context.body(body, 200, { 'Content-Type': type, 'Cache-Control': cache })
      } catch {
        return context.body(await readFile(join(root, 'index.html')), 200, { 'Content-Type': contentTypes['.html']! })
      }
    })
  }

  return app
}

export function serverOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): ServerOptions {
  const { STATIC_DIR, BASIC_AUTH_USER, BASIC_AUTH_PASSWORD } = env
  return {
    staticDir: STATIC_DIR || undefined,
    basicAuth: BASIC_AUTH_USER && BASIC_AUTH_PASSWORD
      ? { username: BASIC_AUTH_USER, password: BASIC_AUTH_PASSWORD }
      : undefined,
  }
}
