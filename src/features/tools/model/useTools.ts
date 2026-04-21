import { useState } from 'react'
import { Tool } from '@/shared/types'

export function useTools() {
  const [selectedTool, setSelectedTool] = useState<Tool>('pencil')
  const [brushSize, setBrushSize] = useState(1) // Размер кисти в пикселях

  return {
    selectedTool,
    setSelectedTool,
    brushSize,
    setBrushSize
  }
} 