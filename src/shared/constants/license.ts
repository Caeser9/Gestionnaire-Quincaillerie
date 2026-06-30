/** Serveur central de licences Kay Apps */
export const LICENSE_SERVER_URL = 'https://licenceskayapps.duckdns.org/api/v1/client'

export const PRODUCT_SLUG = 'hardware-store'

export const LICENSE_CHECK_INTERVAL_DAYS = 30

/** null = toujours accessible si licence active */
export const ROUTE_MODULE_MAP: Record<string, string | null> = {
  '/': null,
  '/pos': 'pos',
  '/products': 'products',
  '/inventory': 'stock',
  '/purchases': 'stock',
  '/suppliers': 'stock',
  '/customers': 'pos',
  '/invoices': 'billing',
  '/client-debts': 'billing',
  '/finance': 'accounting',
  '/reports': 'reports',
  '/settings': null
}
