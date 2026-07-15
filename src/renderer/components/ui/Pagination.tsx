import type { MouseEvent } from 'react'

interface Props {
  current: number
  totalPages: number
  onChange: (page: number) => void
}

export function Pagination({ current, totalPages, onChange }: Props) {
  const handle = (e: MouseEvent, p: number) => {
    e.preventDefault()
    if (p >= 1 && p <= totalPages && p !== current) onChange(p)
  }

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between mt-3">
      <div className="text-sm text-slate-500">Page {current} / {totalPages}</div>
      <div className="btn-group">
        <button className="btn-sm btn-ghost" onClick={(e) => handle(e, current - 1)}>Préc</button>
        {/* numbered pages around current (max 10 numbers) */}
        {(() => {
          const maxButtons = 10
          const visible = Math.min(totalPages, maxButtons)
          const half = Math.floor(maxButtons / 2)
          const start = Math.max(1, Math.min(current - half, totalPages - visible + 1))
          return Array.from({ length: visible }).map((_, i) => {
            const page = start + i
            return (
              <button
                key={page}
                className={`btn-sm ${page === current ? 'btn-primary' : 'btn-ghost'}`}
                onClick={(e) => handle(e, page)}
              >
                {page}
              </button>
            )
          })
        })()}
        <button className="btn-sm btn-ghost" onClick={(e) => handle(e, current + 1)}>Suiv</button>
      </div>
    </div>
  )
}

export default Pagination
