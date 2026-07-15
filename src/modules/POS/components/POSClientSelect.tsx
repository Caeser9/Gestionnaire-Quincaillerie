import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent } from 'react'
import { User, Search } from 'lucide-react'

interface Customer {
  _id: string
  name: string
  phone?: string
  address?: string
  matricule?: string
}

interface POSClientSelectProps {
  customers: Customer[]
  customerId: string
  customerName: string
  customerPhone: string
  customerAddress: string
  customerMatricule: string
  isWalkIn: boolean
  onSelectCustomer: (customer: Customer | null) => void
  onCreateCustomer: (draft: { name: string; phone?: string; address?: string; matricule?: string }) => Promise<unknown>
  onUpdatePhone: (phone: string) => void
  onUpdateAddress: (address: string) => void
  onUpdateMatricule: (matricule: string) => void
  disabled?: boolean
}

export function POSClientSelect({
  customers,
  customerId,
  customerName,
  customerPhone,
  customerAddress,
  customerMatricule,
  isWalkIn,
  onSelectCustomer,
  onCreateCustomer,
  onUpdatePhone,
  onUpdateAddress,
  onUpdateMatricule,
  disabled,
}: POSClientSelectProps) {
  const [open, setOpen] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [searchClient, setSearchClient] = useState('')
  const [createForm, setCreateForm] = useState({ name: '', phone: '', address: '', matricule: '' })
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchClient.toLowerCase()) ||
      c.phone?.includes(searchClient)
  )

  const handleSelect = (customer: Customer | null) => {
    onSelectCustomer(customer)
    setOpen(false)
    setShowCreateForm(false)
    setSearchClient('')
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setShowCreateForm(false)
      setSearchClient('')
    }
    if (e.key === 'Enter' && filtered.length > 0 && !showCreateForm) {
      handleSelect(filtered[0])
    }
  }

  const openCreateForm = () => {
    setCreateForm({
      name: searchClient.trim(),
      phone: '',
      address: '',
      matricule: '',
    })
    setShowCreateForm(true)
  }

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!createForm.name.trim()) return
    setCreating(true)
    try {
      await onCreateCustomer({
        name: createForm.name.trim(),
        phone: createForm.phone.trim() || undefined,
        address: createForm.address.trim() || undefined,
        matricule: createForm.matricule.trim() || undefined,
      })
      setOpen(false)
      setShowCreateForm(false)
      setSearchClient('')
      setCreateForm({ name: '', phone: '', address: '', matricule: '' })
    } finally {
      setCreating(false)
    }
  }

  const hasCustomer = !!customerId || isWalkIn || !!customerName.trim()

  return (
    <div className="relative">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {hasCustomer ? (
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                <User size={20} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {customerName}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {isWalkIn
                    ? 'Vente comptoir'
                    : [customerPhone, customerMatricule, customerAddress].filter(Boolean).join(' · ') || 'Client enregistré'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <User size={20} />
              <span className="text-sm">Aucun client sélectionné</span>
            </div>
          )}
        </div>
        <button
          type="button"
          data-pos-client-btn
          onClick={() => setOpen(!open)}
          disabled={disabled}
          className="shrink-0 px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          {hasCustomer ? 'Changer' : 'Sélectionner'}
          <span className="ml-1 text-[10px] opacity-60">F1</span>
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {!showCreateForm ? (
            <>
              <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchClient}
                    onChange={(e) => setSearchClient(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Rechercher un client..."
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => handleSelect(null)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                    isWalkIn ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <User size={16} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Vente comptoir</p>
                    <p className="text-xs text-slate-400">Client anonyme</p>
                  </div>
                </button>

                <div className="border-t border-slate-100 dark:border-slate-800 mx-3" />

                {filtered.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                      customerId === c._id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <User size={16} className="text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{c.name}</p>
                      {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                    </div>
                    {customerId === c._id && (
                      <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                        <span className="text-white text-[10px]">✓</span>
                      </div>
                    )}
                  </button>
                ))}

                {filtered.length === 0 && searchClient && (
                  <div className="px-4 py-4 text-center text-sm text-slate-400">Aucun client trouvé</div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 p-2">
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="w-full px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                >
                  + Ajouter nouveau client
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleCreateSubmit} className="p-3 space-y-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Nouveau client</p>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Nom</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                  className="w-full mt-1 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Téléphone</label>
                <input
                  type="text"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  className="w-full mt-1 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Adresse</label>
                <input
                  type="text"
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  className="w-full mt-1 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Matricule fiscale / Code TVA</label>
                <input
                  type="text"
                  value={createForm.matricule}
                  onChange={(e) => setCreateForm({ ...createForm, matricule: e.target.value })}
                  className="w-full mt-1 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={creating || !createForm.name.trim()}
                  className="flex-1 px-3 py-2 text-sm font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {creating ? 'Création…' : 'Créer le client'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {hasCustomer && !isWalkIn && !open && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Téléphone</label>
            <input
              type="text"
              value={customerPhone}
              onChange={(e) => onUpdatePhone(e.target.value)}
              placeholder="Tél."
              className="w-full mt-1 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Adresse</label>
            <input
              type="text"
              value={customerAddress}
              onChange={(e) => onUpdateAddress(e.target.value)}
              placeholder="Adresse"
              className="w-full mt-1 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Matricule fiscale / Code TVA</label>
            <input
              type="text"
              value={customerMatricule}
              onChange={(e) => onUpdateMatricule(e.target.value)}
              placeholder="Matricule fiscale / Code TVA"
              className="w-full mt-1 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      )}
    </div>
  )
}
