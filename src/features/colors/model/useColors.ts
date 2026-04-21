import { useState } from 'react'

export function useColors() {
  const [selectedColor, setSelectedColor] = useState('#000000')
  const [pickerColor, setPickerColor] = useState('#000000')

  const [paletteColors, setPaletteColors] = useState([
    '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
    '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080',
    '#008000', '#ffc0cb'
  ])

  const addPaletteColor = (color: string) => {
    const normalizedColor = color.toLowerCase()

    setPaletteColors((currentColors) => {
      if (currentColors.includes(normalizedColor)) return currentColors
      return [...currentColors, normalizedColor]
    })
    setSelectedColor(normalizedColor)
  }

  return {
    selectedColor,
    setSelectedColor,
    pickerColor,
    setPickerColor,
    paletteColors,
    addPaletteColor
  }
} 
