import { createMemoryEmployeeRepository } from './employees/memory-repository.js'
import { createSupabaseEmployeeRepository } from './employees/supabase-repository.js'
import type { EmployeeRepository } from './employees/repository.js'

export function createConfiguredEmployeeRepository(): EmployeeRepository {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (url && serviceRoleKey) {
    return createSupabaseEmployeeRepository(url, serviceRoleKey)
  }

  return createMemoryEmployeeRepository()
}
