import { useState } from 'react'
import { setTaskStatus } from '../api.js'
import { CalendarDays, CheckCircle2, Circle, Clock3, UserRoundCheck } from 'lucide-react'
import type { Employee, OnboardingTask, OnboardingTaskStatus } from '../../../../packages/domain/src/types.js'

interface OnboardingProps {
  employees: Employee[]
  tasks: OnboardingTask[]
  onTaskSaved: (task: OnboardingTask) => void
  onSelectEmployee: (employee: Employee) => void
}

const taskStatusLabels: Record<OnboardingTaskStatus, string> = {
  pending: 'À faire',
  in_progress: 'En cours',
  done: 'Terminée',
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short' })
    .format(new Date(`${date}T12:00:00`))
}

export function Onboarding({ employees, tasks, onSelectEmployee, onTaskSaved }: OnboardingProps) {
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')
  async function toggle(task: OnboardingTask) {
    setPending(task.id)
    setError('')
    try {
      onTaskSaved(await setTaskStatus(task.id, task.status === 'done' ? 'pending' : 'done'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Modification impossible.')
    } finally {
      setPending(null)
    }
  }
  const onboardingEmployees = employees.filter((employee) => employee.status === 'onboarding')
  const completedTasks = tasks.filter((task) => task.status === 'done').length
  const openTasks = tasks.length - completedTasks

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <div className="eyebrow">PARCOURS EMPLOYÉ <span className="eyebrow-dot" /> SUIVI DES ÉTAPES</div>
          <h1>Accueil des nouvelles recrues</h1>
          <p>Gardez chaque arrivée sur la bonne voie, de la préparation à la première journée.</p>
        </div>
        <div className="onboarding-summary"><span><UserRoundCheck size={16} />{onboardingEmployees.length} personnes</span><span><Clock3 size={16} />{openTasks} tâches ouvertes</span></div>
      </section>

      <div className="onboarding-page-grid">
        <section className="panel onboarding-roster">
          <div className="panel-heading">
            <div><div className="panel-kicker">NOUVELLES RECRUES</div><h2>Parcours actifs</h2></div>
            <span className="count-badge">{onboardingEmployees.length}</span>
          </div>
          {onboardingEmployees.length === 0 ? (
            <div className="table-empty"><strong>Aucun parcours actif</strong><span>Les nouvelles recrues apparaîtront ici.</span></div>
          ) : onboardingEmployees.map((employee) => {
            const employeeTasks = tasks.filter((task) => task.employeeId === employee.id)
            const completeCount = employeeTasks.filter((task) => task.status === 'done').length
            const progress = employeeTasks.length ? Math.round((completeCount / employeeTasks.length) * 100) : 0
            return (
              <button className="onboarding-roster-row" type="button" key={employee.id} onClick={() => onSelectEmployee(employee)}>
                <span className="avatar avatar-lilac">{employee.firstName[0]}{employee.lastName[0]}</span>
                <span className="person-copy"><strong>{employee.firstName} {employee.lastName}</strong><small>{employee.jobTitle} · {employee.departmentName}</small></span>
                <span className="roster-progress"><span>{completeCount}/{employeeTasks.length} complétées</span><span className="progress-track"><span style={{ width: `${progress}%` }} /></span></span>
              </button>
            )
          })}
        </section>

        <section className="panel onboarding-checklist">
          <div className="panel-heading">
            <div><div className="panel-kicker">CHECKLIST PARTAGÉE</div><h2>Étapes à compléter</h2></div>
            <span className="task-counter">{completedTasks}/{tasks.length} terminées</span>
          </div>
          {tasks.length === 0 ? <div className="empty-inline">Aucune tâche pour le moment.</div> : (
            <div className="checklist-list">
              {tasks.map((task) => {
                const employee = employees.find((item) => item.id === task.employeeId)
                const done = task.status === 'done'
                return (
                  <article className={`checklist-item${done ? ' checklist-done' : ''}`} key={task.id}>
                    <button type="button" disabled={pending !== null} aria-pressed={done}
                      aria-label={(done ? 'Rouvrir ' : 'Terminer ') + task.title}
                      onClick={() => void toggle(task)} className={`checklist-status ${done ? 'done' : ''}`}>
                      {done ? <CheckCircle2 size={19} /> : <Circle size={19} />}
                    </button>
                    <div className="checklist-copy">
                      <strong>{task.title}</strong>
                      <span>{employee?.firstName ?? 'Nouvelle recrue'} {employee?.lastName ?? ''} · Responsable : {task.ownerName}</span>
                    </div>
                    <span className={`checklist-state task-state-${task.status}`}>{taskStatusLabels[task.status]}</span>
                    <span className="checklist-date"><CalendarDays size={14} />{formatDate(task.dueDate)}</span>
                  </article>
                )
              })}
            </div>
          )}
          {error && <p role="alert">{error}</p>}
        </section>
      </div>
    </div>
  )
}
