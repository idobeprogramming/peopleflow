import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { Activity, Department, Employee, OnboardingTask } from '../../../packages/domain/src/types.js'
import { listActivity, listDepartments, listEmployees, listOnboardingTasks } from './api.js'
import { CreateEmployeeDialog } from './components/CreateEmployeeDialog.js'
import { Dashboard } from './components/Dashboard.js'
import { EmployeeDirectory } from './components/EmployeeDirectory.js'
import { EmployeeDrawer } from './components/EmployeeDrawer.js'
import { Onboarding } from './components/Onboarding.js'
import { Sidebar, type Page } from './components/Sidebar.js'

function Reports({ employees, departments }: { employees: Employee[]; departments: Department[] }) {
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div><div className="eyebrow">VOTRE ORGANISATION <span className="eyebrow-dot" /> APERÇU</div><h1>Rapports d’équipe</h1><p>Une lecture rapide de la structure de votre équipe.</p></div>
      </section>
      <section className="panel reports-panel">
        <div className="panel-heading"><div><div className="panel-kicker">EFFECTIF PAR DÉPARTEMENT</div><h2>Composition de l’équipe</h2></div></div>
        {departments.map((department) => {
          const members = employees.filter((employee) => employee.departmentId === department.id)
          const active = members.filter((employee) => employee.status === 'active').length
          return (
            <div className="report-row" key={department.id}>
              <span className="report-department">{department.name}</span>
              <span className="report-bar"><span style={{ width: `${employees.length ? (members.length / employees.length) * 100 : 0}%` }} /></span>
              <strong>{members.length}</strong>
              <small>{active} actifs</small>
            </div>
          )
        })}
        <div className="report-total"><span>Effectif total</span><strong>{employees.length}</strong></div>
      </section>
    </div>
  )
}

export function App() {
  const [page, setPage] = useState<Page>('overview')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [tasks, setTasks] = useState<OnboardingTask[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [employeeRows, departmentRows, taskRows, events] = await Promise.all([
        listEmployees(),
        listDepartments(),
        listOnboardingTasks(),
        listActivity(),
      ])
      setEmployees(employeeRows)
      setDepartments(departmentRows)
      setTasks(taskRows)
      setActivity(events)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les données.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  function handleCreated(employee: Employee) {
    void loadData()
    setShowCreateDialog(false)
    setPage('employees')
    setSelectedEmployee(employee)
    setToast(`${employee.firstName} ${employee.lastName} — profil enregistré.`)
    window.setTimeout(() => setToast(''), 4200)
  }

  return (
    <div className="app-shell">
      <Sidebar activePage={page} onNavigate={setPage} />
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-context"><span className="topbar-workspace">Équipe principale</span></div>
          <div className="topbar-actions">
            <span className="topbar-divider" />
            <div className="topbar-user" aria-label="Profil de Camille Fortin">
              <span className="avatar avatar-small avatar-coral">CF</span>
              <span className="topbar-user-copy"><strong>Camille Fortin</strong><small>Administratrice</small></span>
              
            </div>
          </div>
        </header>

        <div className="page-content">
          {loading ? (
            <div className="loading-state" role="status"><span className="loading-spinner" />Chargement de votre espace RH…</div>
          ) : error ? (
            <div className="error-state" role="alert">
              <div><strong>Les données n’ont pas pu être chargées.</strong><span>{error}</span></div>
              <button className="secondary-button" type="button" onClick={() => void loadData()}><RefreshCw size={15} /> Réessayer</button>
            </div>
          ) : page === 'overview' ? (
            <Dashboard
              employees={employees}
              departments={departments}
              activity={activity}
              tasks={tasks}
              onNavigate={setPage}
              onSelectEmployee={setSelectedEmployee}
            />
          ) : page === 'employees' ? (
            <EmployeeDirectory
              employees={employees}
              departments={departments}
              onSelectEmployee={setSelectedEmployee}
              onAddEmployee={() => setShowCreateDialog(true)}
            />
          ) : page === 'onboarding' ? (
            <Onboarding onTaskSaved={(saved) => {
              setTasks((current) => current.map((task) => task.id === saved.id ? saved : task))
              void listActivity().then(setActivity).catch(() => setToast("Actualisation du journal impossible."))
            }} employees={employees} tasks={tasks} onSelectEmployee={setSelectedEmployee} />
          ) : (
            <Reports employees={employees} departments={departments} />
          )}
        </div>
      </main>

      {selectedEmployee && !showCreateDialog && <EmployeeDrawer onEdit={() => setShowCreateDialog(true)} employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} />}
      {showCreateDialog && (
        <CreateEmployeeDialog
          profile={selectedEmployee ?? undefined}
          departments={departments}
          employees={employees}
          onClose={() => setShowCreateDialog(false)}
          onCreated={handleCreated}
        />
      )}
      {toast && <div className="toast-message" role="status">{toast}</div>}
    </div>
  )
}
