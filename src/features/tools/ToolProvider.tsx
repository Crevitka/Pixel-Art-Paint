import {
  createContext,
  useContext,
  ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useTools } from './model/useTools'
import type { Tool } from '@/shared/types'

interface ToolContextType {
  selectedTool: Tool
  setSelectedTool: Dispatch<SetStateAction<Tool>>
  brushSize: number
  setBrushSize: (size: number) => void
  loadToolProjectState: (state: {
    selectedTool: Tool
    brushSize: number
  }) => void
}

const ToolContext = createContext<ToolContextType | undefined>(undefined)

export function ToolProvider({ children }: { children: ReactNode }) {
  const tools = useTools()

  return (
    <ToolContext.Provider value={tools}>
      {children}
    </ToolContext.Provider>
  )
}

export function useToolContext() {
  const context = useContext(ToolContext)
  if (!context) {
    throw new Error('useToolContext must be used within ToolProvider')
  }
  return context
} 
