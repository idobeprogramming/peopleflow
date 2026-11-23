// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App.js'
import * as api from './api.js'

const camille = { id: 'user-1', email: 'camille.fortin@example.test', displayName: 'Camille Fortin', role: 'admin' as const }

vi.mock('./api.js', () => ({
  UNAUTHORIZED_EVENT: 'peopleflow:unauthorized',
  getCurrentUser: vi.fn(),
  getAuthOptions: vi.fn().mockResolvedValue({ demoAccount: null }),
  login: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
  searchEmployees: vi.fn(),
  getDepartmentReport: vi.fn(),
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

  it('asks for a sign-in when there is no session, then opens the app', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(null)
    vi.mocked(api.login).mockResolvedValue(camille)
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText('Courriel'), camille.email)
    await user.type(screen.getByLabelText('Mot de passe'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByRole('heading', { name: /Vue d.ensemble/ })).toBeInTheDocument()
    expect(api.listEmployees).toHaveBeenCalled()
  })

  it('does not load any data before the user is signed in', async () => {
    vi.mocked(api.listEmployees).mockClear()
    vi.mocked(api.getCurrentUser).mockResolvedValue(null)
    render(<App />)
    await screen.findByRole('button', { name: 'Se connecter' })
    expect(api.listEmployees).not.toHaveBeenCalled()
  })

  it('shows the signed-in user and signs out', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(camille)
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText('Camille Fortin', { selector: '.topbar-user-copy strong' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Se déconnecter' }))

    expect(api.logout).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
  })

  it('keeps the workspace open after a failed logout and lets the user retry', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(camille)
    vi.mocked(api.logout).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<App />)
    const button = await screen.findByRole('button', { name: 'Se déconnecter' })
    await user.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent('déconnexion')
    await user.click(button)
    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
  })

  it('returns to the sign-in page when the session expires', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(camille)
    render(<App />)
    await screen.findByRole('heading', { name: /Vue d.ensemble/ })

    act(() => { window.dispatchEvent(new Event('peopleflow:unauthorized')) })

    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
  })

  it('renders report totals supplied by the database independently of directory size', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(camille)
    vi.mocked(api.getDepartmentReport).mockResolvedValue([{ id: 'sales', name: 'Ventes', total: 1200, active: 1150 }])
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Rapports' }))
    expect(await screen.findByText('1150 actifs')).toBeInTheDocument()
    expect(screen.getByText('Effectif total').parentElement).toHaveTextContent('1200')
  })

  it('loads the dashboard and filters the employee directory by name', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(camille)
    vi.mocked(api.searchEmployees).mockImplementation(async ({ query }) => {
      const rows = await api.listEmployees()
      const items = rows.filter((row) => row.firstName.toLowerCase().includes(query ?? ''))
      return { items, total: items.length }
    })
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
