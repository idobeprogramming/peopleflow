import { BriefcaseBusiness, CalendarDays, Mail, MapPin, X } from 'lucide-react'
import type { Employee, EmployeeStatus } from '../../../../packages/domain/src/types.js'

const statusLabels: Record<EmployeeStatus, string> = {
  active: 'Actif',
  onboarding: 'En accueil',
  leave: 'En congé',
  inactive: 'Inactif',
}

function initials(employee: Employee): string {
  return `${employee.firstName[0] ?? ''}${employee.lastName[0] ?? ''}`.toUpperCase()
}

interface EmployeeDrawerProps {
  employee: Employee
  onEdit: () => void
  onClose: () => void
}

export function EmployeeDrawer({ employee, onClose, onEdit }: EmployeeDrawerProps) {
  return (
    <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="employee-drawer" role="dialog" aria-modal="true" aria-labelledby="employee-name">
        <div className="drawer-topline">
          <span>PROFIL EMPLOYÉ</span>
          <button type="button" className="icon-action" aria-label="Fermer la fiche" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="drawer-identity">
          <span className="avatar avatar-large avatar-lilac">{initials(employee)}</span>
          <div>
            <h2 id="employee-name">{employee.firstName} {employee.lastName}</h2>
            <p>{employee.jobTitle}</p>
            <span className={`status-pill status-${employee.status}`}><span />{statusLabels[employee.status]}</span>
          </div>
        </div>

        <div className="drawer-section">
          <div className="panel-kicker">INFORMATIONS PROFESSIONNELLES</div>
          <div className="detail-row"><Mail size={16} /><div><small>Courriel professionnel</small><strong>{employee.email}</strong></div></div>
          <div className="detail-row"><BriefcaseBusiness size={16} /><div><small>Département</small><strong>{employee.departmentName}</strong></div></div>
          <div className="detail-row"><MapPin size={16} /><div><small>Lieu de travail</small><strong>{employee.location}</strong></div></div>
          <div className="detail-row"><CalendarDays size={16} /><div><small>Date d’embauche</small><strong>{new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${employee.hireDate}T12:00:00`))}</strong></div></div>
        </div>

        <div className="drawer-section manager-card">
          <div className="panel-kicker">GESTIONNAIRE</div>
          {employee.managerName ? (
            <div className="manager-profile">
              <span className="manager-avatar">{employee.managerName.slice(0, 1)}</span>
              <div><strong>{employee.managerName}</strong><small>Responsable direct</small></div>
            </div>
          ) : <p className="muted-cell">Aucun gestionnaire assigné</p>}
        </div>

        <div className="drawer-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Fermer</button>
          <button className="primary-button" type="button" onClick={onEdit}>Modifier le profil</button>
        </div>
      </section>
    </div>
  )
}
