import type {
  Activity,
  Department,
  CreateEmployeeInput,
  Employee,
  OnboardingTask,
} from '../../../packages/domain/src/types.js'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path)

  if (!response.ok) {
    throw new Error(`La requête a échoué (${response.status}).`)
  }

  return response.json() as Promise<T>
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
