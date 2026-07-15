import { useCallback, useEffect, useRef } from 'react'

type ShortcutHandler = () => void

interface ShortcutMap {
  F1?: ShortcutHandler
  F2?: ShortcutHandler
  F3?: ShortcutHandler
  F4?: ShortcutHandler
  F5?: ShortcutHandler
  F6?: ShortcutHandler
  F7?: ShortcutHandler
  F8?: ShortcutHandler
  F9?: ShortcutHandler
  F10?: ShortcutHandler
  F11?: ShortcutHandler
  F12?: ShortcutHandler
  Escape?: ShortcutHandler
}

export function usePOSShortcuts(
  shortcuts: ShortcutMap,
  _searchInputRef?: { current: HTMLInputElement | null },
  enabled = true
) {
  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return

      // F-keys always work
      if (e.key.startsWith('F') && e.key.length <= 3) {
        const fKey = e.key as keyof ShortcutMap
        const handlerFn = shortcutsRef.current[fKey]
        if (handlerFn) {
          e.preventDefault()
          handlerFn()
          return
        }
      }

      // Escape
      if (e.key === 'Escape') {
        const escapeFn = shortcutsRef.current.Escape
        if (escapeFn) {
          e.preventDefault()
          escapeFn()
        }
      }
    },
    [enabled]
  )

  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handler])
}
