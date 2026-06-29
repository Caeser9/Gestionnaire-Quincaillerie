import { Layout } from '@renderer/components/layout/Layout'
import ClientDebtsPage from '@modules/ClientDebts/ClientDebtsPage'
import CustomersPage from '@modules/Customers/CustomersPage'
import DashboardPage from '@modules/Dashboard/DashboardPage'
import FinancePage from '@modules/Finance/FinancePage'
import InventoryPage from '@modules/Inventory/InventoryPage'
import InvoicesPage from '@modules/Invoices/InvoicesPage'
import POSPage from '@modules/POS/POSPage'
import ProductsPage from '@modules/Products/ProductsPage'
import PurchasesPage from '@modules/Purchases/PurchasesPage'
import ReportsPage from '@modules/Reports/ReportsPage'
import SettingsPage from '@modules/Settings/SettingsPage'
import SuppliersPage from '@modules/Suppliers/SuppliersPage'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/pos" element={<POSPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/purchases" element={<PurchasesPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/client-debts" element={<ClientDebtsPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
