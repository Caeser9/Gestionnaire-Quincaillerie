import { useTheme } from '@renderer/contexts/ThemeContext'
import { useLicense } from '@renderer/contexts/LicenseContext'
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
      { path: '/pos', label: 'Point de vente', icon: ShoppingCart, highlight: true }
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
      { path: '/invoices', label: 'Factures & Bons', icon: Receipt },
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

function isNavItemVisible(path: string, authorizedModules: string[]): boolean {
  const moduleKey = ROUTE_MODULE_MAP[path]
  if (moduleKey === null || moduleKey === undefined) return true
  return authorizedModules.includes(moduleKey)
}

export function Layout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme()
  const { authorizedModules } = useLicense()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const filteredNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isNavItemVisible(item.path, authorizedModules))
    }))
    .filter((group) => group.items.length > 0)

  const currentPage = filteredNavGroups
    .flatMap((g) => g.items)
    .find(
      (item) =>
        item.path === location.pathname ||
        (item.path !== '/' && location.pathname.startsWith(item.path))
    )

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[270px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-sidebar transform transition-transform duration-200 lg:translate-x-0 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md shadow-primary-500/25">
            <Wrench size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              Quincaillerie
            </h1>
            <p className="text-xs text-slate-400 truncate">Gestion magasin</p>
          </div>
          <button
            className="lg:hidden btn-ghost p-1.5 rounded-lg"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {filteredNavGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      isActive
                        ? 'nav-item-active nav-item'
                        : `nav-item ${item.highlight ? 'text-primary-600 dark:text-primary-400' : ''}`
                    }
                  >
                    <item.icon size={18} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button onClick={() => setSidebarOpen(true)} className="btn-ghost p-2 rounded-xl">
            <Menu size={20} />
          </button>
          <div>
            <h1 className="font-bold text-slate-900 dark:text-white text-sm">
              {currentPage?.label || 'Quincaillerie'}
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
