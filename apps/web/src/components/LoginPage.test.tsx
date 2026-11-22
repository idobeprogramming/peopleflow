// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginPage } from './LoginPage.js'
import * as api from '../api.js'

vi.mock('../api.js', () => ({
  getAuthOptions: vi.fn(),
  login: vi.fn(),
}))

const user = { id: 'u1', email: 'camille.fortin@example.test', displayName: 'Camille Fortin', role: 'admin' as const }

describe('LoginPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('signs in with the typed credentials', async () => {
    vi.mocked(api.getAuthOptions).mockResolvedValue({ demoAccount: null })
    vi.mocked(api.login).mockResolvedValue(user)
    const onSignedIn = vi.fn()
    const typist = userEvent.setup()
    render(<LoginPage onSignedIn={onSignedIn} />)

    await typist.type(screen.getByLabelText('Courriel'), 'camille.fortin@example.test')
    await typist.type(screen.getByLabelText('Mot de passe'), 'secret')
    await typist.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(api.login).toHaveBeenCalledWith('camille.fortin@example.test', 'secret')
    expect(onSignedIn).toHaveBeenCalledWith(user)
  })

  it('shows the greeting text', () => {
    vi.mocked(api.getAuthOptions).mockResolvedValue({ demoAccount: null })
    render(<LoginPage onSignedIn={vi.fn()} />)
    expect(screen.getByText('bonjour demo')).toBeInTheDocument()
  })

  it('uses the browser password manager fields', () => {
    vi.mocked(api.getAuthOptions).mockResolvedValue({ demoAccount: null })
    render(<LoginPage onSignedIn={vi.fn()} />)
    expect(screen.getByLabelText('Courriel')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('autocomplete', 'current-password')
  })

  it('shows the server error and clears the password', async () => {
    vi.mocked(api.getAuthOptions).mockResolvedValue({ demoAccount: null })
    vi.mocked(api.login).mockRejectedValue(new Error('Courriel ou mot de passe invalide.'))
    const typist = userEvent.setup()
    render(<LoginPage onSignedIn={vi.fn()} />)

    await typist.type(screen.getByLabelText('Courriel'), 'camille.fortin@example.test')
    await typist.type(screen.getByLabelText('Mot de passe'), 'mauvais')
    await typist.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Courriel ou mot de passe invalide.')
    expect(screen.getByLabelText('Mot de passe')).toHaveValue('')
  })

  it('shows the demo account only when the server provides one, and fills the form with it', async () => {
    vi.mocked(api.getAuthOptions).mockResolvedValue({
      demoAccount: { email: 'camille.fortin@example.test', password: 'PeopleFlow-Demo-2026!' },
    })
    const typist = userEvent.setup()
    render(<LoginPage onSignedIn={vi.fn()} />)

    const demo = await screen.findByRole('region', { name: 'Compte de démonstration' })
    expect(demo).toHaveTextContent('PeopleFlow-Demo-2026!')
    await typist.click(screen.getByRole('button', { name: 'Utiliser ce compte' }))
    expect(screen.getByLabelText('Courriel')).toHaveValue('camille.fortin@example.test')
    expect(screen.getByLabelText('Mot de passe')).toHaveValue('PeopleFlow-Demo-2026!')
  })

  it('hides the demo account when the server does not allow it', async () => {
    vi.mocked(api.getAuthOptions).mockResolvedValue({ demoAccount: null })
    render(<LoginPage onSignedIn={vi.fn()} />)
    await screen.findByRole('button', { name: 'Se connecter' })
    expect(screen.queryByRole('region', { name: 'Compte de démonstration' })).not.toBeInTheDocument()
  })
})
