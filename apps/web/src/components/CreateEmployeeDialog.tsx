import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type {
  CreateEmployeeInput,
  Department,
  Employee,
  EmploymentType,
  EmployeeStatus,
} from '../../../../packages/domain/src/types.js'
import { saveEmployee } from '../api.js'

interface CreateEmployeeDialogProps {
  departments: Department[]
  profile?: Employee
  employees: Employee[]
  onClose: () => void
  onCreated: (employee: Employee) => void
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function CreateEmployeeDialog({
  profile,
  departments,
  employees,
  onClose,
  onCreated,
}: CreateEmployeeDialogProps) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [departmentId, setDepartmentId] = useState(profile?.departmentId ?? departments[0]?.id ?? '')
  const [employmentType, setEmploymentType] = useState<EmploymentType>(profile?.employmentType ?? 'full_time')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaving(true)
    const formData = new FormData(event.currentTarget)
    const input: CreateEmployeeInput = {
      firstName: String(formData.get('firstName') ?? '').trim(),
      lastName: String(formData.get('lastName') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      jobTitle: String(formData.get('jobTitle') ?? '').trim(),
      departmentId,
      managerId: String(formData.get('managerId') ?? '') || null,
      status: String(formData.get('status')) as EmployeeStatus,
      employmentType,
      hireDate: String(formData.get('hireDate') ?? ''),
      location: String(formData.get('location') ?? '').trim(),
    }

    try {
      const employee = await saveEmployee(input, profile?.id)
      onCreated(employee)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'La création a échoué.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-employee-title">
        <div className="dialog-heading">
          <div>
            <h2 id="create-employee-title">{profile ? 'Modifier le profil' : 'Ajouter un employé'}</h2>
            <p>Ajoutez les informations professionnelles de base.</p>
          </div>
          <button type="button" className="icon-action" aria-label="Fermer le formulaire" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="employee-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>Prénom<input defaultValue={profile?.firstName} name="firstName" autoComplete="given-name" required maxLength={60} /></label>
            <label>Nom<input defaultValue={profile?.lastName} name="lastName" autoComplete="family-name" required maxLength={60} /></label>
            <label className="form-span">Courriel professionnel<input defaultValue={profile?.email} name="email" type="email" autoComplete="email" placeholder="prenom.nom@entreprise.ca" required maxLength={180} /></label>
            <label className="form-span">Poste<input defaultValue={profile?.jobTitle} name="jobTitle" required maxLength={100} /></label>
            <label>Département
              <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} required>
                {departments.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}
              </select>
            </label>
            <label>Gestionnaire
              <select name="managerId" defaultValue={profile?.managerId ?? ''}>
                <option value="">Aucun gestionnaire</option>
                {employees.filter((employee) => employee.id !== profile?.id).map((employee) => (
                  <option value={employee.id} key={employee.id}>{employee.firstName} {employee.lastName}</option>
                ))}
              </select>
            </label>
            <label>Statut
              <select name="status" defaultValue={profile?.status ?? 'active'}>
                <option value="active">Actif</option><option value="onboarding">En accueil</option>
                <option value="leave">En congé</option><option value="inactive">Inactif</option>
              </select>
            </label>
            <label>Type d’emploi
              <select value={employmentType} onChange={(event) => setEmploymentType(event.target.value as EmploymentType)}>
                <option value="full_time">Temps plein</option>
                <option value="part_time">Temps partiel</option>
                <option value="contract">Contrat</option>
              </select>
            </label>
            <label>Date d’embauche<input name="hireDate" type="date" defaultValue={profile?.hireDate ?? todayDate()} required /></label>
            <label className="form-span">Lieu de travail<input defaultValue={profile?.location} name="location" placeholder="Montréal, Québec ou à distance" required maxLength={100} /></label>
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="dialog-actions">
            <button className="secondary-button" type="button" onClick={onClose}>Annuler</button>
            <button className="primary-button" type="submit" disabled={saving || departments.length === 0}>
              {saving ? 'Enregistrement…' : profile ? 'Enregistrer' : 'Créer le profil'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
