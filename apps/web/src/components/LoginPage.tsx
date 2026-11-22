import { LockKeyhole } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import type { AuthUser } from '../../../../packages/domain/src/types.js'
import { getAuthOptions, login, type AuthOptions } from '../api.js'

interface LoginPageProps {
  onSignedIn: (user: AuthUser) => void
}

export function LoginPage({ onSignedIn }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [demoAccount, setDemoAccount] = useState<AuthOptions['demoAccount']>(null)

  useEffect(() => {
    getAuthOptions().then((options) => setDemoAccount(options.demoAccount)).catch(() => setDemoAccount(null))
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      onSignedIn(await login(email, password))
    } catch (loginError) {
      setPassword('')
      setError(loginError instanceof Error ? loginError.message : 'Connexion impossible.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true">p</span>
          <div>
            <h1 id="login-title">Connexion à PeopleFlow</h1>
            <p>Accédez à votre espace RH.</p>
          </div>
        </div>

        <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            Courriel
            <input type="email" name="email" autoComplete="username" required maxLength={254}
              value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Mot de passe
            <input type="password" name="password" autoComplete="current-password" required maxLength={1024}
              value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button login-submit" type="submit" disabled={submitting}>
            <LockKeyhole size={16} aria-hidden="true" /> {submitting ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        {demoAccount && (
          <section className="demo-account" aria-label="Compte de démonstration">
            <strong>Compte de démonstration</strong>
            <span>Données fictives. Ce compte n’existe pas en production.</span>
            <dl>
              <dt>Courriel</dt><dd><code>{demoAccount.email}</code></dd>
              <dt>Mot de passe</dt><dd><code>{demoAccount.password}</code></dd>
            </dl>
            <button type="button" className="secondary-button"
              onClick={() => { setEmail(demoAccount.email); setPassword(demoAccount.password) }}>
              Utiliser ce compte
            </button>
          </section>
        )}
      </section>
    </main>
  )
}
