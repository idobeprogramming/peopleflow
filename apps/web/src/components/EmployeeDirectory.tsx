import { filterEmployees } from '../../../../packages/domain/src/directory.js'
import { Search, SlidersHorizontal, UserRoundPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Department, Employee, EmployeeStatus } from '../../../../packages/domain/src/types.js'

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
  employees: Employee[]
  departments: Department[]
  onSelectEmployee: (employee: Employee) => void
  onAddEmployee: () => void
}

export function EmployeeDirectory({
  employees,
  departments,
  onSelectEmployee,
  onAddEmployee,
}: EmployeeDirectoryProps) {
  const [query, setQuery] = useState('')
  const [departmentId, setDepartmentId] = useState('all')
  const [status, setStatus] = useState('all')

  const filteredEmployees = useMemo(() => filterEmployees(
    employees, query, departmentId === 'all' ? undefined : departmentId,
    status === 'all' ? undefined : status,
  ), [employees, query, departmentId, status])

  return (
    <div className="page-stack">
      <section className="page-heading directory-heading">
        <div>
          <div className="eyebrow">VOTRE ORGANISATION <span className="eyebrow-dot" /> {employees.length} PERSONNES</div>
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
              onChange={(event) => setQuery(event.target.value)}
            />
            <kbd>⌘ K</kbd>
          </label>
          <div className="filter-controls">
            <span className="filter-label"><SlidersHorizontal size={15} /> Filtres</span>
            <select
              aria-label="Filtrer par département"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
            >
              <option value="all">Tous les départements</option>
              {departments.map((department) => (
                <option value={department.id} key={department.id}>{department.name}</option>
              ))}
            </select>
            <select
              aria-label="Filtrer par statut"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
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
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="table-empty">
                      <div className="empty-icon"><Search size={21} /></div>
                      <strong>Aucun employé trouvé</strong>
                      <span>Essayez une autre recherche ou modifiez les filtres.</span>
                      <button type="button" onClick={() => { setQuery(''); setDepartmentId('all'); setStatus('all') }}>
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
          <span>Affichage de <strong>{filteredEmployees.length}</strong> sur <strong>{employees.length}</strong> employés</span>
        </div>
      </section>
    </div>
  )
}
