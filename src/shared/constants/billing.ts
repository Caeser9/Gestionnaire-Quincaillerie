export type BillingTab = 'invoices' | 'purchase-slips' | 'delivery-notes' | 'quotes'

export const BILLING_TABS: BillingTab[] = ['invoices', 'purchase-slips', 'delivery-notes', 'quotes']

export function billingPath(tab: BillingTab = 'invoices'): string {
  return `/invoices?tab=${tab}`
}

export function parseBillingTab(value: string | null): BillingTab {
  if (value && BILLING_TABS.includes(value as BillingTab)) {
    return value as BillingTab
  }
  return 'invoices'
}
