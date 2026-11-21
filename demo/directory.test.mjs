import assert from 'node:assert/strict'
import test from 'node:test'
import { filterEmployees } from '../packages/domain/src/directory.ts'

const employees = [
  { firstName: 'Nicolas', departmentId: 'ventes', status: 'onboarding' },
  { firstName: 'Jade', departmentId: 'ventes', status: 'active' },
  { firstName: 'Sarah', departmentId: 'operations', status: 'onboarding' },
].map((fields) => ({ lastName: 'Test', jobTitle: 'Conseil', email: '', departmentName: '', ...fields }))

test('Ventes et En accueil affichent uniquement Nicolas', () => {
  const result = filterEmployees(employees, '', 'ventes', 'onboarding')
  assert.deepEqual(result.map((employee) => employee.firstName), ['Nicolas'])
})

test('la recherche seule accepte le nom complet', () => {
  assert.equal(filterEmployees(employees, 'nicolas test').length, 1)
})
