import { createContext, useContext, ReactNode } from 'react'
import { useColors } from './model/useColors'

interface ColorContextType {
  selectedColor: string
  setSelectedColor: (color: string) => void
  pickerColor: string
  setPickerColor: (color: string) => void
  paletteColors: string[]
  palettePresets: { id: string; label: string; colors: string[] }[]
  activePalettePresetId: string
  applyPalettePreset: (presetId: string) => void
  createPalettePreset: () => void
  addPaletteColor: (color: string) => void
  updatePaletteColor: (index: number, color: string) => void
  reorderPaletteColor: (fromIndex: number, toIndex: number) => void
  loadColorProjectState: (state: {
    selectedColor: string
    pickerColor: string
    paletteColors: string[]
    palettePresets: { id: string; label: string; colors: string[] }[]
    activePalettePresetId: string
  }) => void
}

const ColorContext = createContext<ColorContextType | undefined>(undefined)

export function ColorProvider({ children }: { children: ReactNode }) {
  const colors = useColors()

  return (
    <ColorContext.Provider value={colors}>
      {children}
    </ColorContext.Provider>
  )
}

export function useColorContext() {
  const context = useContext(ColorContext)
  if (!context) {
    throw new Error('useColorContext must be used within ColorProvider')
  }
  return context
} 
