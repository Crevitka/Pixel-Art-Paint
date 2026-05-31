import { useState } from 'react'
import { Tool } from '@/shared/types'

export function useTools() {
  const [selectedTool, setSelectedTool] = useState<Tool>('pencil')
  const [brushSize, setBrushSize] = useState(1)

  const loadToolProjectState = (state: {
    selectedTool: Tool
    brushSize: number
  }) => {
    setSelectedTool(state.selectedTool)
    setBrushSize(state.brushSize)
  }

  return {
    selectedTool,
    setSelectedTool,
    brushSize,
    setBrushSize,
    loadToolProjectState
  }
}
