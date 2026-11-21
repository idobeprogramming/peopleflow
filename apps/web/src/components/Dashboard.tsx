import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  ListChecks,
  UsersRound,
} from 'lucide-react'
import type { Activity, Department, Employee, OnboardingTask } from '../../../../packages/domain/src/types.js'
import type { Page } from './Sidebar.js'

interface DashboardProps {
  activity: Activity[]
  employees: Employee[]
  departments: Department[]
  tasks: OnboardingTask[]
  onNavigate: (page: Page) => void
  onSelectEmployee: (employee: Employee) => void
}

function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function formatDate(date: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('fr-CA', options ?? { day: 'numeric', month: 'short' })
    .format(new Date(`${date}T12:00:00`))
}

function initials(employee: Employee): string {
  return `${employee.firstName[0] ?? ''}${employee.lastName[0] ?? ''}`.toUpperCase()
}

function avatarClass(employee: Employee): string {
  const colors = ['avatar-coral', 'avatar-lilac', 'avatar-blue', 'avatar-green', 'avatar-gold']
  const index = (employee.firstName.codePointAt(0) ?? 0) % colors.length
  return colors[index] ?? colors[0]!
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  helper: string
  icon: typeof UsersRound
  tone: string
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon size={18} strokeWidth={1.8} /></div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-helper">{helper}</div>
    </article>
  )
}

export function Dashboard({
  activity,
  employees,
  departments,
  tasks,
  onNavigate,
  onSelectEmployee,
}: DashboardProps) {
  const now = new Date()
  const today = localDateKey(now)
  const end = new Date(now)
  end.setDate(end.getDate() + 30)
  const endExclusive = localDateKey(end)
  const activeEmployees = employees.filter((employee) => employee.status === 'active')
  const onboardingEmployees = employees.filter((employee) => employee.status === 'onboarding')
  const upcomingEmployees = employees
    .filter((employee) => employee.hireDate >= today && employee.hireDate < endExclusive)
    .sort((left, right) => left.hireDate.localeCompare(right.hireDate))
  const pendingTasks = tasks.filter((task) => task.status !== 'done')
  const doneTasks = tasks.length - pendingTasks.length
  const completion = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0
  const maxDepartmentSize = Math.max(
    1,
    ...departments.map(
      (department) => employees.filter((employee) => employee.departmentId === department.id).length,
    ),
  )

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <div className="eyebrow">VOTRE ESPACE RH</div>
          <h1>Vue d’ensemble</h1>
          <p>Bonjour Camille, voici ce qui se passe dans votre équipe aujourd’hui.</p>
        </div>
        <time className="date-button" dateTime={today}>
          <CalendarDays size={17} />
          <span>{formatDate(today, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </time>
      </section>

      <section className="metric-grid" aria-label="Indicateurs de l’équipe">
        <MetricCard
          label="Employés au total"
          value={employees.length}
          helper="dans votre équipe"
          icon={UsersRound}
          tone="tone-violet"
        />
        <MetricCard
          label="Employés actifs"
          value={activeEmployees.length}
          helper="présents aujourd’hui"
          icon={Check}
          tone="tone-green"
        />
        <MetricCard
          label="Tâches en retard"
          value={pendingTasks.filter((task) => task.dueDate < today).length}
          helper="échéance dépassée"
          icon={ListChecks}
          tone="tone-blue"
        />
        <MetricCard
          label="Arrivées à venir"
          value={upcomingEmployees.length}
          helper="dans les 30 prochains jours"
          icon={CalendarDays}
          tone="tone-orange"
        />
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-main-column">
          <article className="panel onboarding-panel">
            <div className="panel-heading">
              <div>
                <div className="panel-kicker">PARCOURS DES NOUVELLES RECRUES</div>
                <h2>Accueil en cours <span className="count-badge">{onboardingEmployees.length}</span></h2>
              </div>
              <button className="text-link" type="button" onClick={() => onNavigate('onboarding')}>
                Voir le suivi <ArrowRight size={15} />
              </button>
            </div>
            {onboardingEmployees.length === 0 ? (
              <div className="empty-inline">Aucun parcours d’accueil en cours.</div>
            ) : (
              <div className="onboarding-list">
                {onboardingEmployees.map((employee) => {
                  const employeeTasks = tasks.filter((task) => task.employeeId === employee.id)
                  const completed = employeeTasks.filter((task) => task.status === 'done').length
                  const progress = employeeTasks.length
                    ? Math.round((completed / employeeTasks.length) * 100)
                    : 0

                  return (
                    <button
                      className="onboarding-person"
                      type="button"
                      key={employee.id}
                      onClick={() => onSelectEmployee(employee)}
                    >
                      <span className={`avatar ${avatarClass(employee)}`}>{initials(employee)}</span>
                      <span className="person-copy">
                        <strong>{employee.firstName} {employee.lastName}</strong>
                        <small>{employee.jobTitle} · {employee.departmentName}</small>
                      </span>
                      <span className="progress-copy">
                        <span>{completed}/{employeeTasks.length} tâches</span>
                        <span className="progress-track"><span style={{ width: `${progress}%` }} /></span>
                      </span>
                      <ChevronRight size={17} className="row-chevron" />
                    </button>
                  )
                })}
              </div>
            )}
            <div className="onboarding-footer">
              <div className="footer-progress">
                <div className="footer-progress-copy">
                  <span>Progression globale</span>
                  <strong>{completion}%</strong>
                </div>
                <span className="progress-track wide"><span style={{ width: `${completion}%` }} /></span>
              </div>
              <div className="task-summary"><Clock3 size={15} /> {pendingTasks.length} tâches à terminer</div>
            </div>
          </article>

          <article className="panel department-panel">
            <div className="panel-heading">
              <div>
                <div className="panel-kicker">VOTRE ORGANISATION</div>
                <h2>Répartition par équipe</h2>
              </div>
            </div>
            <div className="department-list">
              {departments.map((department, index) => {
                const count = employees.filter((employee) => employee.departmentId === department.id).length
                const width = Math.max(count ? 9 : 0, Math.round((count / maxDepartmentSize) * 100))

                return (
                  <div className="department-row" key={department.id}>
                    <div className="department-name"><span className={`department-dot dot-${index % 4}`} />{department.name}</div>
                    <div className="department-bar"><span className={`bar-${index % 4}`} style={{ width: `${width}%` }} /></div>
                    <strong>{count}</strong>
                  </div>
                )
              })}
            </div>
            <button className="panel-bottom-link" type="button" onClick={() => onNavigate('employees')}>
              Parcourir l’annuaire <ArrowRight size={15} />
            </button>
          </article>
        </div>

        <div className="dashboard-side-column">
          <article className="panel arrivals-panel">
            <div className="panel-heading">
              <div>
                <div className="panel-kicker">BIENTÔT DANS L’ÉQUIPE</div>
                <h2>Prochaines arrivées</h2>
              </div>
              <button className="icon-action" type="button" aria-label="Voir toutes les arrivées" onClick={() => onNavigate('employees')}>
                <ChevronRight size={17} />
              </button>
            </div>
            {upcomingEmployees.length === 0 ? (
              <div className="empty-inline">Aucune arrivée prévue pour le moment.</div>
            ) : (
              upcomingEmployees.slice(0, 3).map((employee) => (
                <button
                  className="arrival-row"
                  type="button"
                  key={employee.id}
                  onClick={() => onSelectEmployee(employee)}
                >
                  <span className={`avatar avatar-medium ${avatarClass(employee)}`}>{initials(employee)}</span>
                  <span className="person-copy">
                    <strong>{employee.firstName} {employee.lastName}</strong>
                    <small>{employee.jobTitle}</small>
                  </span>
                  <span className="arrival-date">{formatDate(employee.hireDate)}</span>
                </button>
              ))
            )}
            <div className="arrival-callout">
              <div className="callout-icon"><CalendarDays size={17} /></div>
              <div>
                <strong>Préparez leur première journée</strong>
                <span>Un accueil bien organisé fait toute la différence.</span>
              </div>
            </div>
          </article>

          <article className="panel">
            <h2>Activité récente</h2>
            {activity.length ? <ul>{activity.map((event) => <li key={event.id}>
              {event.description} <small>{new Date(event.createdAt).toLocaleString('fr-CA')}</small>
            </li>)}</ul> : <p>Aucune activité enregistrée.</p>}
          </article>
          <article className="panel tasks-panel">
            <div className="panel-heading">
              <div>
                <div className="panel-kicker">À SUIVRE</div>
                <h2>Tâches d’accueil</h2>
              </div>
              <span className="task-counter">{pendingTasks.length} ouvertes</span>
            </div>
            {pendingTasks.length === 0 ? (
              <div className="empty-inline">Tout est à jour.</div>
            ) : (
              <div className="task-list">
                {pendingTasks.slice(0, 3).map((task) => {
                  const employee = employees.find((item) => item.id === task.employeeId)
                  return (
                    <div className="task-row" key={task.id}>
                      <span className={`task-status task-${task.status}`} aria-hidden="true" />
                      <span className="task-copy">
                        <strong>{task.title}</strong>
                        <small>{employee?.firstName ?? 'Nouvelle recrue'} · {task.ownerName}</small>
                      </span>
                      <span className="task-due">{formatDate(task.dueDate)}</span>
                    </div>
                  )
                })}
              </div>
            )}
            <button className="panel-bottom-link" type="button" onClick={() => onNavigate('onboarding')}>
              Ouvrir la checklist <ArrowRight size={15} />
            </button>
          </article>
        </div>
      </section>
    </div>
  )
}
