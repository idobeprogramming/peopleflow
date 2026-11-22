import type { Context, MiddlewareHandler } from 'hono'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import type { AuthUser } from '../../../../packages/domain/src/types.js'
import { DEMO_ACCOUNT } from './demo-account.js'
import { SESSION_TTL_MS, type AuthService } from './service.js'

export type AuthVariables = { user: AuthUser }

export interface AuthRouteOptions {
  service: AuthService
  secureCookies: boolean
  demoAccount: boolean
  trustProxy: boolean
}

const PUBLIC_PATHS = new Set(['/api/health', '/api/auth/login', '/api/auth/options'])
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const loginSchema = z.object({
  email: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(1024),
})

export function cookieName(secure: boolean) {
  // __Host- forbids Domain and requires Secure and Path=/: the cookie cannot leak to subdomains.
  return secure ? '__Host-peopleflow_session' : 'peopleflow_session'
}

function clientKey(context: Context, trustProxy: boolean) {
  if (trustProxy) {
    const forwarded = context.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    if (forwarded) return forwarded
  }
  const incoming = (context.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming
  return incoming?.socket?.remoteAddress ?? 'unknown'
}

/** Rejects cross-site writes: the Origin of a browser request must match the API's host. */
export const sameOriginWrites: MiddlewareHandler = async (context, next) => {
  const origin = context.req.header('origin')
  if (origin && !SAFE_METHODS.has(context.req.method)) {
    const host = context.req.header('host') ?? new URL(context.req.url).host
    let originHost = ''
    try {
      originHost = new URL(origin).host
    } catch {
      // A malformed Origin is treated as foreign.
    }
    if (originHost !== host) return context.json({ error: 'Origine non autorisée.' }, 403)
  }
  await next()
}

export function requireSession(options: AuthRouteOptions): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (context, next) => {
    if (PUBLIC_PATHS.has(context.req.path)) return next()
    const user = await options.service.authenticate(getCookie(context, cookieName(options.secureCookies)))
    if (!user) return context.json({ error: 'Authentification requise.' }, 401)
    context.set('user', user)
    await next()
  }
}

export function authRoutes(options: AuthRouteOptions) {
  const { service, secureCookies } = options
  const name = cookieName(secureCookies)
  const routes = new Hono<{ Variables: AuthVariables }>()

  routes.use('*', bodyLimit({
    maxSize: 10 * 1024,
    onError: (context) => context.json({ error: 'Requête trop volumineuse.' }, 413),
  }))
  routes.use('*', async (context, next) => {
    await next()
    context.header('Cache-Control', 'no-store')
  })

  routes.get('/options', (context) => context.json({ demoAccount: options.demoAccount ? DEMO_ACCOUNT : null }))

  routes.post('/login', async (context) => {
    const parsed = loginSchema.safeParse(await context.req.json().catch(() => null))
    if (!parsed.success) return context.json({ error: 'Courriel et mot de passe requis.' }, 400)

    const result = await service.login(parsed.data.email, parsed.data.password, clientKey(context, options.trustProxy))
    if (!result.ok && result.reason === 'rate_limited') {
      context.header('Retry-After', String(result.retryAfterSeconds))
      return context.json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' }, 429)
    }
    if (!result.ok) return context.json({ error: 'Courriel ou mot de passe invalide.' }, 401)

    setCookie(context, name, result.token, {
      httpOnly: true, secure: secureCookies, sameSite: 'Strict', path: '/', maxAge: SESSION_TTL_MS / 1000,
    })
    return context.json({ user: result.user })
  })

  routes.post('/logout', async (context) => {
    await service.logout(getCookie(context, name))
    deleteCookie(context, name, { path: '/', secure: secureCookies, httpOnly: true, sameSite: 'Strict' })
    return context.body(null, 204)
  })

  routes.get('/me', (context) => context.json({ user: context.get('user') }))

  return routes
}
