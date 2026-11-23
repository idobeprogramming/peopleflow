import { Hono, type Handler } from 'hono'
import { z } from 'zod'
import { EmployeeError } from './error.js'
import type { EmployeeService } from './service.js'

const employeeInputSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(180).transform((value) => value.toLowerCase()),
  jobTitle: z.string().trim().min(1).max(100),
  departmentId: z.string().uuid(),
  managerId: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'onboarding', 'leave', 'inactive']),
  employmentType: z.enum(['full_time', 'part_time', 'contract']),
  hireDate: z.iso.date(),
  location: z.string().trim().min(1).max(100),
})

export function employeeController(service: EmployeeService) {
  const routes = new Hono()
  routes.onError((error, context) => {
    if (!(error instanceof EmployeeError)) throw error
    const statuses = { invalid: 400, notFound: 404, conflict: 409 } as const
    return context.json({ error: error.message }, statuses[error.kind])
  })
  routes.get('/', async (context) => {
    const { q = '', departmentId, status } = context.req.query()
    const filters = { query: q.trim(), departmentId, status }
    const { offset, limit } = context.req.query()
    if (offset === undefined && limit === undefined) return context.json(await service.list(filters))
    const paging = z.object({
      offset: z.coerce.number().int().min(0).max(2147483647),
      limit: z.coerce.number().int().min(1).max(500),
    }).safeParse({ offset: offset ?? 0, limit: limit ?? 50 })
    if (!paging.success) return context.json({ error: 'Pagination invalide.' }, 400)
    return context.json(await service.page(filters, paging.data.offset, paging.data.limit))
  })
  routes.get('/:id', async (context) => context.json(await service.get(context.req.param('id'))))

  const save: Handler = async (context) => {
    const id = context.req.param('id')
    const parsed = employeeInputSchema.safeParse(await context.req.json().catch(() => null))

    if (!parsed.success) {
      return context.json({ error: 'Données invalides.', details: parsed.error.issues }, 400)
    }

    return context.json(await service.save(parsed.data, id), id ? 200 : 201)
  }
  routes.post('/', save)
  routes.put('/:id', save)
  return routes
}
