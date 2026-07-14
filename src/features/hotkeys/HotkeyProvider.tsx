import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  DEFAULT_HOTKEYS,
  loadHotkeys,
  saveHotkeys,
  type HotkeyBinding,
  type HotkeyId
} from './model/hotkeys'

type HotkeyContextValue = {
  hotkeys: Record<HotkeyId, HotkeyBinding>
  setHotkey: (id: HotkeyId, binding: HotkeyBinding) => void
  resetHotkeys: () => void
}

const HotkeyContext = createContext<HotkeyContextValue | null>(null)

type HotkeyProviderProps = {
  children: ReactNode
}

export function HotkeyProvider({ children }: HotkeyProviderProps) {
  const [hotkeys, setHotkeys] = useState<Record<HotkeyId, HotkeyBinding>>(() => loadHotkeys())

  const value = useMemo<HotkeyContextValue>(() => ({
    hotkeys,
    setHotkey: (id, binding) => {
      setHotkeys((currentHotkeys) => {
        const nextHotkeys = {
          ...currentHotkeys,
          [id]: binding
        }
        saveHotkeys(nextHotkeys)
        return nextHotkeys
      })
    },
    resetHotkeys: () => {
      setHotkeys(DEFAULT_HOTKEYS)
      saveHotkeys(DEFAULT_HOTKEYS)
    }
  }), [hotkeys])

  return (
    <HotkeyContext.Provider value={value}>
      {children}
    </HotkeyContext.Provider>
  )
}

export function useHotkeyContext() {
  const context = useContext(HotkeyContext)
  if (!context) {
    throw new Error('useHotkeyContext must be used within a HotkeyProvider')
  }

  return context
}
