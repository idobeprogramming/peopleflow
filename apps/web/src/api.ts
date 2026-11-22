import type {
  Activity,
  AuthUser,
  Department,
  CreateEmployeeInput,
  Employee,
  OnboardingTask,
} from '../../../packages/domain/src/types.js'

/** Fired when the API answers 401: the session expired or was revoked. */
export const UNAUTHORIZED_EVENT = 'peopleflow:unauthorized'

function checkSession(response: Response) {
  if (response.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  checkSession(response)

  if (!response.ok) {
    throw new Error(`La requête a échoué (${response.status}).`)
  }

  return response.json() as Promise<T>
}

export interface AuthOptions {
  demoAccount: { email: string; password: string } | null
}

export function getAuthOptions(): Promise<AuthOptions> {
  return getJson('/api/auth/options')
}

/** The signed-in user, or null when there is no valid session. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch('/api/auth/me')
  if (response.status === 401) return null
  if (!response.ok) throw new Error(`La requête a échoué (${response.status}).`)
  return ((await response.json()) as { user: AuthUser }).user
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? 'Connexion impossible.')
  return (body as { user: AuthUser }).user
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' })
}

export function listEmployees(): Promise<Employee[]> {
  return getJson('/api/employees')
}

export function listDepartments(): Promise<Department[]> {
  return getJson('/api/departments')
}

export function listOnboardingTasks(): Promise<OnboardingTask[]> {
  return getJson('/api/onboarding-tasks')
}

export function listActivity(): Promise<Activity[]> {
  return getJson('/api/activity')
}

async function save<T>(path: string, method: string, input: unknown): Promise<T> {
  const response = await fetch(path, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
  checkSession(response)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? 'Enregistrement impossible.')
  }
  return response.json() as Promise<T>
}

export function saveEmployee(input: CreateEmployeeInput, id?: string): Promise<Employee> {
  return id ? save('/api/employees/' + id, 'PUT', input) : save('/api/employees', 'POST', input)
}

export function setTaskStatus(id: string, status: 'done' | 'pending'): Promise<OnboardingTask> {
  return save('/api/onboarding-tasks/' + id, 'PATCH', { status })
}
