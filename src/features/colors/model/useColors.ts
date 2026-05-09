import { useState } from 'react'

const defaultPalettePresets = [
  {
    id: 'basic',
    label: 'Basic',
    colors: [
      '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
      '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080',
      '#008000', '#ffc0cb'
    ]
  },
  {
    id: 'gameboy',
    label: 'Game Boy',
    colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f']
  },
  {
    id: 'dawn',
    label: 'Dawn',
    colors: ['#1d1b2a', '#5b3558', '#b45a6f', '#f4b36a', '#f8f4e3']
  },
  {
    id: 'ocean',
    label: 'Ocean',
    colors: ['#041c32', '#04293a', '#064663', '#3b82f6', '#a5f3fc']
  }
] as const

export function useColors() {
  const [selectedColor, setSelectedColor] = useState('#000000')
  const [pickerColor, setPickerColor] = useState('#000000')
  const [palettePresets, setPalettePresets] = useState(
    defaultPalettePresets.map((preset) => ({ ...preset, colors: [...preset.colors] }))
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
    updatePaletteColor
  }
} 
