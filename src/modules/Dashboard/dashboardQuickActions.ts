export type DashboardMode = 'pro' | 'simple'

export interface DashboardShortcut {
  id: string
  label: string
  path: string
  description: string
}

export function getDashboardShortcutItems(): DashboardShortcut[] {
  return [
    {
      id: 'pos',
      label: 'Facturation',
      path: '/pos',
      description: 'Point de vente — encaisser une vente',
    },
    {
      id: 'billing',
      label: 'Gestion des transactions',
      path: '/invoices?tab=invoices',
      description: 'Historique, devis et bons de livraison',
    },
    {
      id: 'delivery',
      label: 'Bon de livraison',
      path: '/delivery-notes/new',
      description: 'Nouvelle livraison',
    },
    {
      id: 'quotes',
      label: 'Devis',
      path: '/quotes/new',
      description: 'Nouvelle proposition',
    },
    {
      id: 'products',
      label: 'Produits',
      path: '/products',
      description: 'Catalogue',
    },
    {
      id: 'customers',
      label: 'Clients',
      path: '/customers',
      description: 'Comptes clients',
    },
    {
      id: 'debts',
      label: 'Dettes clients',
      path: '/client-debts',
      description: 'Règlements',
    },
    {
      id: 'inventory',
      label: 'Stock',
      path: '/inventory',
      description: 'Inventaire',
    },
  ]
}
