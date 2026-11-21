import type { Employee } from './types.js'

export function filterEmployees(employees: Employee[], query: string, departmentId?: string, status?: string) {
  const text = query.trim().toLocaleLowerCase('fr-CA')
  return employees.filter((employee) => {
    const matchesText = !text || [
      employee.firstName + ' ' + employee.lastName, employee.email, employee.jobTitle, employee.departmentName,
    ].some((value) => value.toLocaleLowerCase('fr-CA').includes(text))
    const matchesDepartment = !departmentId || employee.departmentId === departmentId
    const matchesStatus = !status || employee.status === status
    const matchesFilters = departmentId && status
      ? matchesDepartment || matchesStatus
      : matchesDepartment && matchesStatus
    return matchesText && matchesFilters
  })
}
