import { useState, useCallback, useMemo } from 'react'
import { apiRequest } from '@renderer/lib/api'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { TIMBRE_FISCAL_AMOUNT } from '@shared/constants'
import { calculateAllLines, calculateSummary, canAddLineToCart, getDefaultItemTvaRate, mapCartToSaleLines, type CartLine, type CalculatedLine } from '../utils/posCalculations'

export interface Customer {
  _id: string
  name: string
  phone?: string
  address?: string
  matricule?: string
}

export interface PendingItem {
  productId: string
  reference: string
  designation: string
  unitPrice: number
  discount: number
  tva: number
  quantity: number
  stock: number
  purchasePrice: number
  isCustom?: boolean
}

const createLineId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

export function usePOSState() {
  const queryClient = useQueryClient()

  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerMatricule, setCustomerMatricule] = useState('')
  const [isWalkIn, setIsWalkIn] = useState(false)
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [documentNumber, setDocumentNumber] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [deliveryNumber, setDeliveryNumber] = useState('')
  const [deliveryDriverName, setDeliveryDriverName] = useState('')
  const [deliveryDriverCin, setDeliveryDriverCin] = useState('')
  const [deliveryVehiclePlate, setDeliveryVehiclePlate] = useState('')
  const [remark, setRemark] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)
  const [searchCode, setSearchCode] = useState('')
  const [searchDesignation, setSearchDesignation] = useState('')
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null)
  const [cashReceived, setCashReceived] = useState('')

  const { data: customers } = useQuery({
    queryKey: ['customers-list'],
    queryFn: () => apiRequest<{ data: Customer[] }>('/customers?limit=200'),
  })

  const customersList = customers?.data ?? []

  const addItemToCart = useCallback((item: PendingItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === item.productId && c.reference === item.reference)
      if (existing) {
      const canAdd = item.isCustom || canAddLineToCart(existing.quantity, item.quantity, item.stock)
        if (!canAdd) {
          toast.error('Stock insuffisant')
          return prev
        }
        return prev.map((c) =>
          c.productId === item.productId && c.reference === item.reference
            ? { ...c, quantity: c.quantity + item.quantity }
            : c
        )
      }
      const canAdd = item.isCustom || canAddLineToCart(0, item.quantity, item.stock)
      if (!canAdd) {
        toast.error('Stock insuffisant')
        return prev
      }
      toast.success(`${item.designation} ajouté`, { duration: 1500 })
      return [
        ...prev,
        {
          lineId: createLineId(),
          productId: item.productId,
          reference: item.reference,
          designation: item.designation,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          tva: item.tva,
          stock: item.stock,
          purchasePrice: item.purchasePrice,
          isCustom: item.isCustom,
        },
      ]
    })

    setPendingItem(null)
    setSearchCode('')
    setSearchDesignation('')
  }, [])

  const addPendingToCart = useCallback(() => {
    if (!pendingItem) return
    addItemToCart(pendingItem)
  }, [pendingItem, addItemToCart])

  const addCustomItemToCart = useCallback((draft: { reference: string; designation: string; quantity: number; unitPrice: number; discount?: number }) => {
    const designation = draft.designation.trim()
    if (!designation) {
      toast.error('Indiquez un nom pour le produit libre')
      return
    }
    const unitPrice = Number.isFinite(draft.unitPrice) ? draft.unitPrice : 0
    const quantity = Math.max(1, draft.quantity || 1)
    addItemToCart({
      productId: `custom-${Date.now()}`,
      reference: draft.reference.trim() || 'DIV',
      designation,
      unitPrice,
      discount: draft.discount ?? 0,
      tva: getDefaultItemTvaRate(),
      quantity,
      stock: 0,
      purchasePrice: 0,
      isCustom: true,
    })
  }, [addItemToCart])

  const editLine = useCallback((line: CalculatedLine) => {
    setSelectedLineId(line.lineId)
  }, [])

  const updateCartLine = useCallback((lineId: string, updates: Partial<CartLine>) => {
    setCart((prev) => prev.map((c) => (c.lineId === lineId ? { ...c, ...updates } : c)))
  }, [])

  const removeFromCart = useCallback((lineId: string) => {
    setCart((prev) => prev.filter((c) => c.lineId !== lineId))
  }, [])

  const duplicateLine = useCallback((line: CalculatedLine) => {
    setCart((prev) => [
      ...prev,
      {
        ...line,
        lineId: createLineId(),
        quantity: Math.max(1, line.quantity),
        stock: line.stock,
        purchasePrice: line.purchasePrice ?? 0,
      },
    ])
  }, [])

  const moveLineUp = useCallback((index: number) => {
    if (index <= 0) return
    setCart((prev) => {
      const next = [...prev]
      const temp = next[index]
      next[index] = next[index - 1]
      next[index - 1] = temp
      return next
    })
  }, [])

  const moveLineDown = useCallback((index: number) => {
    setCart((prev) => {
      if (index >= prev.length - 1) return prev
      const next = [...prev]
      const temp = next[index]
      next[index] = next[index + 1]
      next[index + 1] = temp
      return next
    })
  }, [])

  const resetState = useCallback(() => {
    setCart([])
    setPendingItem(null)
    setSearchCode('')
    setSearchDesignation('')
    setCashReceived('')
    setCustomerId('')
    setCustomerName('')
    setCustomerPhone('')
    setCustomerAddress('')
    setCustomerMatricule('')
    setIsWalkIn(false)
    setRemark('')
    setOrderNumber('')
    setDeliveryNumber('')
    setDeliveryDriverName('')
    setDeliveryDriverCin('')
    setDeliveryVehiclePlate('')
    setSelectedLineId(null)
    setInvoiceDate(new Date().toISOString().slice(0, 10))
  }, [])

  const selectCustomer = useCallback((customer: Customer | null) => {
    if (!customer) {
      setIsWalkIn(true)
      setCustomerId('')
      setCustomerName('Client comptoir')
      setCustomerPhone('')
      setCustomerAddress('')
      setCustomerMatricule('')
      return
    }
    setIsWalkIn(false)
    setCustomerId(customer._id)
    setCustomerName(customer.name)
    setCustomerPhone(customer.phone ?? '')
    setCustomerAddress(customer.address ?? '')
    setCustomerMatricule(customer.matricule ?? '')
  }, [])

  const createCustomerFromPos = useCallback(
    async (draft: { name: string; phone?: string; address?: string; matricule?: string }) => {
      const name = draft.name.trim()
      if (!name) {
        toast.error('Nom du client requis')
        return null
      }
      try {
        const created = await apiRequest<Customer & { created?: boolean }>('/customers/quick', {
          method: 'POST',
          body: JSON.stringify({
            name,
            phone: draft.phone?.trim() || undefined,
            address: draft.address?.trim() || undefined,
            matricule: draft.matricule?.trim() || undefined,
          }),
        })
        selectCustomer(created)
        queryClient.invalidateQueries({ queryKey: ['customers-list'] })
        queryClient.invalidateQueries({ queryKey: ['customers'] })
        toast.success(created.created ? 'Client créé' : 'Client sélectionné')
        return created
      } catch {
        toast.error('Erreur création client')
        return null
      }
    },
    [queryClient, selectCustomer]
  )

  const linkCustomerByName = useCallback(
    async (name: string): Promise<string | undefined> => {
      const trimmed = name.trim()
      if (!trimmed) return undefined
      const existing = customersList.find((c) => c.name.toLowerCase() === trimmed.toLowerCase())
      if (existing) { selectCustomer(existing); return existing._id }
      try {
        const created = await apiRequest<Customer & { created?: boolean }>('/customers/quick', {
          method: 'POST', body: JSON.stringify({
            name: trimmed,
            phone: customerPhone.trim() || undefined,
            address: customerAddress.trim() || undefined,
            matricule: customerMatricule.trim() || undefined,
          }),
        })
        selectCustomer(created)
        queryClient.invalidateQueries({ queryKey: ['customers-list'] })
        queryClient.invalidateQueries({ queryKey: ['customers'] })
        return created._id
      } catch { toast.error('Erreur création client'); return undefined }
    },
    [customersList, queryClient, selectCustomer, customerPhone, customerAddress, customerMatricule]
  )

  const calculatedLines = useMemo(() => calculateAllLines(cart), [cart])
  const summary = useMemo(() => calculateSummary(calculatedLines), [calculatedLines])
  const timbreFiscal = useMemo(() => (summary.totalTTC > 0 ? TIMBRE_FISCAL_AMOUNT : 0), [summary.totalTTC])
  const totalWithTimbre = useMemo(() => summary.totalTTC + timbreFiscal, [summary.totalTTC, timbreFiscal])
  const totalQuantity = useMemo(() => cart.reduce((s, c) => s + c.quantity, 0), [cart])
  const cartItemCount = cart.length

  const handleCheckout = useCallback(async () => {
    if (!cart.length) { toast.error('Panier vide'); return }

    const receivedAmount = parseFloat(cashReceived) || 0
    const amountPaid = Math.min(receivedAmount, totalWithTimbre)
    const amountDue = totalWithTimbre - amountPaid

    let resolvedCustomerId = customerId || undefined
    if (customerName.trim() && !isWalkIn && !customerId) {
      const linkedId = await linkCustomerByName(customerName)
      if (linkedId) resolvedCustomerId = linkedId
    }

    if (amountDue > 0 && !resolvedCustomerId) {
      toast.error('Indiquez le nom du client pour enregistrer une dette')
      return
    }

    try {
      const result = await apiRequest<{
        invoice?: { _id: string; reference: string }
        purchaseSlip?: { _id: string; reference: string }
        documentType: 'invoice' | 'purchase_slip'
      }>('/sales', {
        method: 'POST',
        body: JSON.stringify({
          customerId: resolvedCustomerId,
          customerName: customerName.trim() || undefined,
          customerAddress: customerAddress.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          customerMatricule: customerMatricule.trim() || undefined,
          cashReceived: cashReceived ? parseFloat(cashReceived) : undefined,
          paymentMethod: 'cash',
          lines: mapCartToSaleLines(cart),
          includeTva: true,
          amountPaid: amountPaid > 0 ? amountPaid : undefined,
          notes: remark.trim() || undefined,
        }),
      })

      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-slips'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['pos-products-category'] })

      resetState()
      return result
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création de la vente')
      return null
    }
  }, [cart, customerId, customerName, customerAddress, customerPhone, customerMatricule, isWalkIn, cashReceived, totalWithTimbre, remark, linkCustomerByName, queryClient, resetState])

  return {
    customerId, customerName, customerPhone, customerAddress, customerMatricule, isWalkIn,
    customersList, selectCustomer, createCustomerFromPos, linkCustomerByName, setCustomerName, setCustomerPhone, setCustomerAddress, setCustomerMatricule,
    invoiceDate, setInvoiceDate, documentNumber, setDocumentNumber, orderNumber, setOrderNumber, deliveryNumber, setDeliveryNumber, deliveryDriverName, setDeliveryDriverName, deliveryDriverCin, setDeliveryDriverCin, deliveryVehiclePlate, setDeliveryVehiclePlate, remark, setRemark,
    cart, setCart, addPendingToCart, addCustomItemToCart, editLine, updateCartLine, removeFromCart, duplicateLine, moveLineUp, moveLineDown,
    selectedLineId, setSelectedLineId,
    searchCode, setSearchCode, searchDesignation, setSearchDesignation, pendingItem, setPendingItem,
    cashReceived, setCashReceived,
    calculatedLines, summary, timbreFiscal, totalWithTimbre, totalQuantity, cartItemCount,
    handleCheckout, resetState,
  }
}
