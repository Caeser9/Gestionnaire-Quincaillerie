import { LoaderCircle, Search, X } from 'lucide-react'
import { forwardRef, type KeyboardEventHandler } from 'react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  loading?: boolean
  size?: 'default' | 'large'
  onClear?: () => void
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    { value, onChange, placeholder = 'Rechercher...', loading, size = 'default', onClear, onKeyDown },
    ref
  ) {
  return (
    <div className="relative">
      <Search
        size={size === 'large' ? 20 : 18}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
      />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={size === 'large' ? 'input-lg pl-12 pr-10' : 'input pl-11 pr-10'}
      />
      {loading && (
        <LoaderCircle
          size={18}
          className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
        />
      )}
      {!loading && value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
})
