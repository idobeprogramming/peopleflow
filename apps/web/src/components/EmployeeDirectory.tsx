import { searchEmployees } from '../api.js'
import { Search, SlidersHorizontal, UserRoundPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Department, Employee, EmployeePage, EmployeeStatus } from '../../../../packages/domain/src/types.js'

const statusLabels: Record<EmployeeStatus, string> = {
  active: 'Actif',
  onboarding: 'En accueil',
  leave: 'En congé',
  inactive: 'Inactif',
}

function initials(employee: Employee): string {
  return `${employee.firstName[0] ?? ''}${employee.lastName[0] ?? ''}`.toUpperCase()
}

function avatarClass(employee: Employee): string {
  const colors = ['avatar-coral', 'avatar-lilac', 'avatar-blue', 'avatar-green', 'avatar-gold']
  return colors[(employee.firstName.codePointAt(0) ?? 0) % colors.length] ?? colors[0]!
}

function formatHireDate(date: string): string {
  return new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${date}T12:00:00`))
}

interface EmployeeDirectoryProps {
  departments: Department[]
  onSelectEmployee: (employee: Employee) => void
  onAddEmployee: () => void
}

export function EmployeeDirectory({
  departments,
  onSelectEmployee,
  onAddEmployee,
}: EmployeeDirectoryProps) {
  const [query, setQuery] = useState('')
  const [departmentId, setDepartmentId] = useState('all')
  const [status, setStatus] = useState('all')

  const limit = 50
  const [offset, setOffset] = useState(0)
  const [page, setPage] = useState<EmployeePage | null>(null)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let current = true
    setPage(null)
    setFailed(false)
    searchEmployees({ query, departmentId: departmentId === 'all' ? undefined : departmentId,
      status: status === 'all' ? undefined : status }, offset, limit).then((result) => {
      if (current) setPage(result)
    }).catch(() => { if (current) setFailed(true) })
    return () => { current = false }
  }, [query, departmentId, status, offset, retry])
  const filteredEmployees = page?.items ?? []

  return (
    <div className="page-stack">
      <section className="page-heading directory-heading">
        <div>
          <div className="eyebrow">VOTRE ORGANISATION <span className="eyebrow-dot" /> {page?.total ?? '…'} PERSONNES</div>
          <h1>Annuaire des employés</h1>
          <p>Retrouvez les profils et les équipes au même endroit.</p>
        </div>
        <button className="primary-button" type="button" onClick={onAddEmployee}>
          <UserRoundPlus size={17} /> Nouvel employé
        </button>
      </section>

      <section className="panel directory-panel">
        <div className="directory-toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              type="search"
              aria-label="Rechercher un employé"
              placeholder="Rechercher par nom, poste ou courriel…"
              value={query}
              onChange={(event) => { setOffset(0); setQuery(event.target.value) }}
            />
            <kbd>⌘ K</kbd>
          </label>
          <div className="filter-controls">
            <span className="filter-label"><SlidersHorizontal size={15} /> Filtres</span>
            <select
              aria-label="Filtrer par département"
              value={departmentId}
              onChange={(event) => { setOffset(0); setDepartmentId(event.target.value) }}
            >
              <option value="all">Tous les départements</option>
              {departments.map((department) => (
                <option value={department.id} key={department.id}>{department.name}</option>
              ))}
            </select>
            <select
              aria-label="Filtrer par statut"
              value={status}
              onChange={(event) => { setOffset(0); setStatus(event.target.value) }}
            >
              <option value="all">Tous les statuts</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-scroll">
          <table className="employee-table">
            <thead>
              <tr>
                <th>Employé</th>
                <th>Département</th>
                <th>Gestionnaire</th>
                <th>Date d’embauche</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <button className="employee-cell" type="button" onClick={() => onSelectEmployee(employee)}>
                      <span className={`avatar ${avatarClass(employee)}`}>{initials(employee)}</span>
                      <span className="person-copy">
                        <strong>{employee.firstName} {employee.lastName}</strong>
                        <small>{employee.jobTitle}</small>
                      </span>
                    </button>
                  </td>
                  <td><span className="department-cell">{employee.departmentName}</span></td>
                  <td>
                    {employee.managerName ? (
                      <span className="manager-cell"><span className="manager-initial">{employee.managerName.slice(0, 1)}</span>{employee.managerName}</span>
                    ) : <span className="muted-cell">—</span>}
                  </td>
                  <td><span className="date-cell">{formatHireDate(employee.hireDate)}</span></td>
                  <td><span className={`status-pill status-${employee.status}`}><span />{statusLabels[employee.status]}</span></td>
                </tr>
              ))}
              {page && filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="table-empty">
                      <div className="empty-icon"><Search size={21} /></div>
                      <strong>Aucun employé trouvé</strong>
                      <span>Essayez une autre recherche ou modifiez les filtres.</span>
                      <button type="button" onClick={() => { setOffset(0); setQuery(''); setDepartmentId('all'); setStatus('all') }}>
                        Effacer les filtres
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          {failed ? <span role="alert">Annuaire indisponible. <button onClick={() => setRetry(retry + 1)}>Réessayer</button></span>
            : !page ? <span role="status">Chargement…</span>
            : <span>{page.items.length ? offset + 1 : 0}–{offset + page.items.length} sur {page.total} employés</span>}
          <button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - limit))}>Précédent</button>
          <button disabled={!page || offset + limit >= page.total} onClick={() => setOffset(offset + limit)}>Suivant</button>
        </div>
      </section>
    </div>
  )
}
