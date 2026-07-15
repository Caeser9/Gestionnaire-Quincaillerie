import { Layout } from '@renderer/components/layout/Layout'
import { useLicense } from '@renderer/contexts/LicenseContext'
import { SettingsProvider } from '@renderer/contexts/SettingsContext'
import ClientDebtsPage from '@modules/ClientDebts/ClientDebtsPage'
import CustomersPage from '@modules/Customers/CustomersPage'
import DashboardPage from '@modules/Dashboard/DashboardPage'
import AddDeliveryNotePage from '@modules/DeliveryNotes/AddDeliveryNotePage'
import FinancePage from '@modules/Finance/FinancePage'
import InventoryPage from '@modules/Inventory/InventoryPage'
import InvoicesPage from '@modules/Invoices/InvoicesPage'
import { LicenseActivationPage } from '@modules/License/LicenseActivationPage'
import { LicenseBlockedPage } from '@modules/License/LicenseBlockedPage'
import POSPage from '@modules/POS/POSPage'
import ProductsPage from '@modules/Products/ProductsPage'
import PurchasesPage from '@modules/Purchases/PurchasesPage'
import AddQuotePage from '@modules/Quotes/AddQuotePage'
import ReportsPage from '@modules/Reports/ReportsPage'
import SettingsPage from '@modules/Settings/SettingsPage'
import SuppliersPage from '@modules/Suppliers/SuppliersPage'
import { LoaderCircle } from 'lucide-react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { billingPath } from '@shared/constants/billing'
import { LicensedRoute } from './components/LicensedRoute'

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LicensedRoute><DashboardPage /></LicensedRoute>} />
        <Route path="/pos" element={<LicensedRoute><POSPage /></LicensedRoute>} />
        <Route path="/products" element={<LicensedRoute><ProductsPage /></LicensedRoute>} />
        <Route path="/inventory" element={<LicensedRoute><InventoryPage /></LicensedRoute>} />
        <Route path="/delivery-notes/new" element={<LicensedRoute><AddDeliveryNotePage /></LicensedRoute>} />
        <Route path="/delivery-notes" element={<Navigate to={billingPath('delivery-notes')} replace />} />
        <Route path="/quotes/new" element={<LicensedRoute><AddQuotePage /></LicensedRoute>} />
        <Route path="/quotes" element={<Navigate to={billingPath('quotes')} replace />} />
        <Route path="/purchases" element={<LicensedRoute><PurchasesPage /></LicensedRoute>} />
        <Route path="/suppliers" element={<LicensedRoute><SuppliersPage /></LicensedRoute>} />
        <Route path="/customers" element={<LicensedRoute><CustomersPage /></LicensedRoute>} />
        <Route path="/invoices" element={<LicensedRoute><InvoicesPage /></LicensedRoute>} />
        <Route path="/client-debts" element={<LicensedRoute><ClientDebtsPage /></LicensedRoute>} />
        <Route path="/finance" element={<LicensedRoute><FinancePage /></LicensedRoute>} />
        <Route path="/reports" element={<LicensedRoute><ReportsPage /></LicensedRoute>} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

function AppGate() {
  const { status, loading, refresh, isActive } = useLicense()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center page-bg">
        <LoaderCircle size={40} className="animate-spin text-primary-500" />
      </div>
    )
  }

  if (status?.status === 'suspended' || status?.status === 'expired' || status?.status === 'invalid') {
    return <LicenseBlockedPage status={status} onRetry={refresh} />
  }

  if (!isActive) {
    return (
      <LicenseActivationPage
        onActivated={refresh}
        initialPending={status?.status === 'pending'}
      />
    )
  }

  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <AppGate />
    </SettingsProvider>
  )
}
