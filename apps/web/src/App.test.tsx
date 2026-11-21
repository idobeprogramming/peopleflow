// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App.js'

vi.mock('./api.js', () => ({
  listActivity: vi.fn().mockResolvedValue([]),
  listDepartments: vi.fn().mockResolvedValue([
    { id: 'department-sales', name: 'Ventes' },
  ]),
  listEmployees: vi.fn().mockResolvedValue([
    {
      id: 'employee-camille',
      firstName: 'Camille',
      lastName: 'Fortin',
      email: 'camille.fortin@example.test',
      jobTitle: 'Directrice générale',
      departmentId: 'department-sales',
      departmentName: 'Ventes',
      managerId: null,
      managerName: null,
      status: 'active',
      employmentType: 'full_time',
      hireDate: '2024-02-01',
      location: 'Montréal',
      createdAt: '2024-02-01T12:00:00.000Z',
    },
    {
      id: 'employee-nicolas',
      firstName: 'Nicolas',
      lastName: 'Gagnon',
      email: 'nicolas.gagnon@example.test',
      jobTitle: 'Conseiller aux ventes',
      departmentId: 'department-sales',
      departmentName: 'Ventes',
      managerId: 'employee-camille',
      managerName: 'Camille Fortin',
      status: 'onboarding',
      employmentType: 'full_time',
      hireDate: '2026-11-20',
      location: 'Montréal',
      createdAt: '2026-11-01T12:00:00.000Z',
    },
  ]),
  listOnboardingTasks: vi.fn().mockResolvedValue([]),
}))

describe('PeopleFlow app', () => {
  afterEach(() => cleanup())

  it('loads the dashboard and filters the employee directory by name', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('heading', { name: /Vue d.ensemble/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Employés' }))

    expect(await screen.findByRole('heading', { name: 'Annuaire des employés' }))
      .toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByRole('button', { name: /Camille Fortin/ })).toBeInTheDocument()
    expect(screen.getByText('Nicolas Gagnon')).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Rechercher un employé' }), 'nicolas')

    expect(screen.getByText('Nicolas Gagnon')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).queryByRole('button', { name: /Camille Fortin/ })).not.toBeInTheDocument()
  })
})
