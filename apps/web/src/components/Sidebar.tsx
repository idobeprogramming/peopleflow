import {
  BarChart3,
  ClipboardCheck,
  LayoutDashboard,
  UsersRound,
} from 'lucide-react'

export type Page = 'overview' | 'employees' | 'onboarding' | 'reports'

interface SidebarProps {
  activePage: Page
  onNavigate: (page: Page) => void
}

const navigation: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'employees', label: 'Employés', icon: UsersRound },
  { id: 'onboarding', label: 'Accueil', icon: ClipboardCheck },
  { id: 'reports', label: 'Rapports', icon: BarChart3 },
]

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <button type="button" className="brand" onClick={() => onNavigate('overview')} aria-label="PeopleFlow, accueil">
        <span className="brand-mark">p</span>
        <span className="brand-copy">
          <strong>peopleflow</strong>
          <small>GESTION RH</small>
        </span>
      </button>

      <div className="workspace-label">ESPACE DE TRAVAIL</div>
      <nav className="side-nav" aria-label="Navigation principale">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            className={`nav-item${activePage === id ? ' active' : ''}`}
            key={id}
            type="button"
            aria-current={activePage === id ? 'page' : undefined}
            onClick={() => onNavigate(id)}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-spacer" />
      <div className="sidebar-footer">
        <div className="avatar avatar-small avatar-coral">CF</div>
        <div className="profile-copy">
          <strong>Camille Fortin</strong>
          <small>Administratrice</small>
        </div>
        <span className="profile-menu" aria-hidden="true">•••</span>
      </div>
    </aside>
  )
}
