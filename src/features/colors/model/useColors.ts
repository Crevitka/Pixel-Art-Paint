import { useState } from 'react'
import { DEFAULT_PALETTE_PRESETS } from '@/shared/lib/project'

export function useColors() {
  const [selectedColor, setSelectedColor] = useState('#000000')
  const [pickerColor, setPickerColor] = useState('#000000')
  const [palettePresets, setPalettePresets] = useState(
    DEFAULT_PALETTE_PRESETS.map((preset) => ({ ...preset, colors: [...preset.colors] }))
  )
  const [activePalettePresetId, setActivePalettePresetId] = useState(DEFAULT_PALETTE_PRESETS[0].id)
  const [paletteColors, setPaletteColors] = useState([...DEFAULT_PALETTE_PRESETS[0].colors])

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
      palettePresets.filter((preset) => preset.id.startsWith('custom-')).length + 1
    const nextPreset = {
      id: `custom-${Date.now()}`,
      label: `Custom ${nextPresetNumber}`,
      colors: [...paletteColors]
    }

    setPalettePresets((currentPresets) => [...currentPresets, nextPreset])
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
    loadColorProjectState
  }
} 
