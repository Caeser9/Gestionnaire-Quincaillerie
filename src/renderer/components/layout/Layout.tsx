import { useTheme } from '@renderer/contexts/ThemeContext'
import { useLicense } from '@renderer/contexts/LicenseContext'
import { useSettings } from '@renderer/contexts/SettingsContext'
import { ROUTE_MODULE_MAP } from '@shared/constants/license'
import {
  Building2,
  ChartColumn,
  ChartPie,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Moon,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Store,
  Sun,
  Users,
  Wallet,
  Warehouse,
  Wrench,
  X
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const navGroups = [
  {
    label: 'Principal',
    items: [
      { path: '/', label: 'Tableau de bord', icon: LayoutDashboard },
      { path: '/pos', label: 'Facturation', icon: ShoppingCart, highlight: true as const }
    ]
  },
  {
    label: 'Catalogue',
    items: [
      { path: '/products', label: 'Produits', icon: Package },
      { path: '/inventory', label: 'Stock', icon: Warehouse }
    ]
  },
  {
    label: 'Achats',
    items: [
      { path: '/purchases', label: 'Bons de commande', icon: ClipboardList },
      { path: '/suppliers', label: 'Fournisseurs', icon: Building2 }
    ]
  },
  {
    label: 'Comptabilité',
    items: [
      { path: '/invoices', label: 'Gestion des transactions', icon: Receipt },
      { path: '/client-debts', label: 'Suivi Clients & Dettes', icon: Wallet },
      { path: '/finance', label: 'Recettes & Bénéfices', icon: ChartPie }
    ]
  },
  {
    label: 'Ventes',
    items: [{ path: '/customers', label: 'Clients', icon: Users }]
  },
  {
    label: 'Administration',
    items: [
      { path: '/reports', label: 'Rapports', icon: ChartColumn },
      { path: '/settings', label: 'Paramètres', icon: Settings }
    ]
  }
] as const

function isNavItemActive(path: string, pathname: string): boolean {
  if (path === '/invoices') {
    return (
      pathname === '/invoices' ||
      pathname.startsWith('/delivery-notes') ||
      pathname.startsWith('/quotes')
    )
  }
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(`${path}/`)
}

function isNavItemVisible(path: string, authorizedModules: string[]): boolean {
  const moduleKey = ROUTE_MODULE_MAP[path]
  if (moduleKey === null || moduleKey === undefined) return true
  return authorizedModules.includes(moduleKey)
}

export function Layout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme()
  const { authorizedModules } = useLicense()
  const { storeDisplayName, storeIcon } = useSettings()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const iconMap = {
    store: Store,
    wrench: Wrench,
    shopping: ShoppingCart,
    building: Building2,
    factory: Warehouse,
    briefcase: Package
  }

  const StoreIcon = iconMap[storeIcon as keyof typeof iconMap] || Store

  const filteredNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isNavItemVisible(item.path, authorizedModules))
    }))
    .filter((group) => group.items.length > 0)

  const currentPage = filteredNavGroups
    .flatMap((g) => g.items)
    .find((item) => isNavItemActive(item.path, location.pathname))

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-sidebar transform transition-all duration-200 lg:translate-x-0 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'lg:w-[84px]' : 'lg:w-[270px]'}`}
      >
        <div className={`flex items-center border-b border-slate-100 dark:border-slate-800 ${sidebarCollapsed ? 'px-2 py-4' : 'px-3 py-5'}`}>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-md shadow-primary-500/25 ${sidebarCollapsed ? 'hidden' : 'flex'}`}>
            <StoreIcon size={20} className="text-white" />
          </div>
          <div className={`ml-3 min-w-0 flex-1 ${sidebarCollapsed ? 'hidden' : 'block'}`}>
            <h1 className="text-base font-bold leading-tight text-slate-900 dark:text-white truncate">
              {storeDisplayName}
            </h1>
            <p className="truncate text-xs text-slate-400">Gestion magasin</p>
          </div>
          <div className={`flex items-center ${sidebarCollapsed ? 'ml-0 w-full justify-center' : 'ml-auto'}`}>
            <button
              className="hidden lg:flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-primary-500 dark:hover:text-primary-400"
              onClick={() => setSidebarCollapsed((value) => !value)}
              aria-label={sidebarCollapsed ? 'Afficher la barre latérale' : 'Masquer la barre latérale'}
            >
              <Menu size={18} />
            </button>
            <button
              className="lg:hidden btn-ghost p-1.5 rounded-lg"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <nav className={`flex-1 overflow-y-auto py-4 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {filteredNavGroups.map((group) => (
            <div key={group.label} className="mb-5 last:mb-0">
              <p className={`mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 ${sidebarCollapsed ? 'hidden' : 'block'}`}>
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={() => setSidebarOpen(false)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={({ isActive }) => {
                      const active = isActive || isNavItemActive(item.path, location.pathname)
                      return active
                        ? `nav-item-active nav-item ${sidebarCollapsed ? 'justify-center' : ''}`
                        : `nav-item ${item.highlight ? 'text-primary-600 dark:text-primary-400' : ''} ${sidebarCollapsed ? 'justify-center' : ''}`
                    }}
                  >
                    <item.icon size={18} className="shrink-0" />
                    <span className={`truncate ${sidebarCollapsed ? 'hidden' : ''}`}>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className={`border-t border-slate-100 dark:border-slate-800 ${sidebarCollapsed ? 'p-2' : 'p-3'}`}>
          <button
            onClick={toggleTheme}
            title={sidebarCollapsed ? (theme === 'dark' ? 'Mode clair' : 'Mode sombre') : undefined}
            className={`flex w-full items-center rounded-xl text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2 px-3 py-2.5'}`}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span className={sidebarCollapsed ? 'hidden' : ''}>{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button onClick={() => setSidebarOpen(true)} className="btn-ghost p-2 rounded-xl">
            <Menu size={20} />
          </button>
          <div>
            <h1 className="font-bold text-slate-900 dark:text-white text-sm truncate">
              {storeDisplayName}
            </h1>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="page-bg p-5 lg:p-8 max-w-[1600px] mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
