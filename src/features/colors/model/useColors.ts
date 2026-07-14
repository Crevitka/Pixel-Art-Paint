import { useState } from 'react'
import { getDefaultPalettePresets, type PalettePreset } from '@/shared/lib/project'

export function useColors() {
  const defaultPalettePresets = getDefaultPalettePresets('ru')
  const [selectedColor, setSelectedColor] = useState('#000000')
  const [pickerColor, setPickerColor] = useState('#000000')
  const [palettePresets, setPalettePresets] = useState(
    defaultPalettePresets.map((preset: PalettePreset) => ({ ...preset, colors: [...preset.colors] }))
  )
  const [activePalettePresetId, setActivePalettePresetId] = useState(defaultPalettePresets[0].id)
  const [paletteColors, setPaletteColors] = useState([...defaultPalettePresets[0].colors])

  const applyPalettePreset = (presetId: string) => {
    const preset = palettePresets.find((item) => item.id === presetId)
    if (!preset) return

    setActivePalettePresetId(preset.id)
    setPaletteColors([...preset.colors])
    setSelectedColor(preset.colors[0])
    setPickerColor(preset.colors[0])
  }

  const createPalettePreset = () => {
    const nextPresetNumber =
      palettePresets.filter((preset: PalettePreset) => preset.id.startsWith('custom-')).length + 1
    const nextPreset = {
      id: `custom-${Date.now()}`,
      label: `Custom ${nextPresetNumber}`,
      colors: [...paletteColors]
    }

    setPalettePresets((currentPresets: PalettePreset[]) => [...currentPresets, nextPreset])
    setActivePalettePresetId(nextPreset.id)
  }

  const addPaletteColor = (color: string) => {
    const normalizedColor = color.toLowerCase()

    setPaletteColors((currentColors) => {
      if (currentColors.includes(normalizedColor)) return currentColors
      return [...currentColors, normalizedColor]
    })
    setSelectedColor(normalizedColor)
  }

  const updatePaletteColor = (index: number, color: string) => {
    const normalizedColor = color.toLowerCase()

    setPaletteColors((currentColors) => {
      if (index < 0 || index >= currentColors.length) return currentColors

      const nextColors = [...currentColors]
      nextColors[index] = normalizedColor
      return nextColors
    })

    setSelectedColor(normalizedColor)
    setPickerColor(normalizedColor)
  }

  const reorderPaletteColor = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return

    setPaletteColors((currentColors) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= currentColors.length ||
        toIndex >= currentColors.length
      ) {
        return currentColors
      }

      const nextColors = [...currentColors]
      const [movedColor] = nextColors.splice(fromIndex, 1)
      nextColors.splice(toIndex, 0, movedColor)
      return nextColors
    })
  }

  const loadColorProjectState = (state: {
    selectedColor: string
    pickerColor: string
    paletteColors: string[]
    palettePresets: { id: string; label: string; colors: string[] }[]
    activePalettePresetId: string
  }) => {
    setSelectedColor(state.selectedColor)
    setPickerColor(state.pickerColor)
    setPaletteColors([...state.paletteColors])
    setPalettePresets(state.palettePresets.map((preset) => ({
      ...preset,
      colors: [...preset.colors]
    })))
    setActivePalettePresetId(state.activePalettePresetId)
  }

  return {
    selectedColor,
    setSelectedColor,
    pickerColor,
    setPickerColor,
    paletteColors,
    palettePresets,
    activePalettePresetId,
    applyPalettePreset,
    createPalettePreset,
    addPaletteColor,
    updatePaletteColor,
    reorderPaletteColor,
    loadColorProjectState
  }
} 
