import { createContext, useContext, ReactNode } from 'react'
import { useCanvas } from './model/useCanvas'
import { AnimationFrame, CanvasSize, Layer, MousePosition } from '@/shared/types'

type CanvasProjectState = {
  canvasSize: CanvasSize
  layers: Layer[]
  activeLayerId: string
  frames?: AnimationFrame[]
  activeFrameId?: string
  animationFps?: number
  nextFrameNumber?: number
  referenceImageUrl: string | null
  referenceOpacity: number
  referenceScale: number
  referenceOffset: {
    x: number
    y: number
  }
  isReferenceVisible: boolean
  nextLayerNumber: number
}

interface CanvasContextType {
  canvasSize: CanvasSize
  setCanvasSize: (size: CanvasSize) => void
  zoom: number
  minZoom: number
  setZoom: (zoom: number) => void
  setMinZoom: (zoom: number) => void
  frames: AnimationFrame[]
  activeFrameId: string
  setActiveFrameId: (frameId: string) => void
  addFrame: () => void
  duplicateFrame: (frameId: string) => void
  removeFrame: (frameId: string) => void
  reorderFrame: (frameId: string, targetFrameId: string, position?: 'before' | 'after') => void
  animationFps: number
  setAnimationFps: (fps: number) => void
  layers: Layer[]
  activeLayerId: string
  selectedLayerIds: string[]
  setActiveLayerId: (layerId: string) => void
  selectLayer: (layerId: string, options?: { toggle?: boolean; range?: boolean }) => void
  referenceImageUrl: string | null
  setReferenceImageUrl: (url: string | null) => void
  referenceOpacity: number
  setReferenceOpacity: (opacity: number) => void
  referenceScale: number
  setReferenceScale: (scale: number) => void
  referenceOffset: {
    x: number
    y: number
  }
  setReferenceOffset: (offset: { x: number; y: number }) => void
  isReferenceMoveMode: boolean
  setIsReferenceMoveMode: (enabled: boolean) => void
  isReferenceVisible: boolean
  setIsReferenceVisible: (visible: boolean) => void
  addLayer: () => void
  addLayerWithPixels: (pixels: Map<string, string>, name?: string) => void
  reorderLayer: (layerId: string, targetLayerId: string, position?: 'before' | 'after') => void
  removeLayer: (layerId: string) => void
  toggleLayerVisibility: (layerId: string) => void
  renameLayer: (layerId: string, name: string) => void
  translateLayer: (layerId: string, dx: number, dy: number) => void
  flipLayerHorizontal: (layerId: string) => void
  flipLayerVertical: (layerId: string) => void
  isDrawing: boolean
  setIsDrawing: (drawing: boolean) => void
  mousePosition: MousePosition
  setMousePosition: (position: MousePosition) => void
  pixels: Map<string, string>
  setPixels: (pixels: Map<string, string>) => void
  pushHistory: () => void
  undo: () => void
  clearCanvas: () => void
  loadCanvasProjectState: (state: CanvasProjectState) => void
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined)

export function CanvasProvider({ children }: { children: ReactNode }) {
  const canvas = useCanvas()

  return (
    <CanvasContext.Provider value={canvas}>
      {children}
    </CanvasContext.Provider>
  )
}

export function useCanvasContext() {
  const context = useContext(CanvasContext)
  if (!context) {
    throw new Error('useCanvasContext must be used within CanvasProvider')
  }
  return context
} 
