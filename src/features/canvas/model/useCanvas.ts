import { useCallback, useRef, useState } from 'react'
import { CanvasSize, Layer, MousePosition } from '@/shared/types'

type CanvasHistoryEntry = {
  canvasSize: CanvasSize
  layers: Layer[]
  activeLayerId: string
  nextLayerNumber: number
}

const MAX_HISTORY_ENTRIES = 100

function createLayer(id: string, name: string): Layer {
  return {
    id,
    name,
    visible: true,
    pixels: new Map()
  }
}

function translatePixels(
  pixels: Map<string, string>,
  dx: number,
  dy: number,
  width: number,
  height: number
) {
  if (dx === 0 && dy === 0) return pixels

  const nextPixels = new Map<string, string>()

  pixels.forEach((color, key) => {
    const [x, y] = key.split(',').map(Number)
    const nextX = x + dx
    const nextY = y + dy

    if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) return
    nextPixels.set(`${nextX},${nextY}`, color)
  })

  return nextPixels
}

function cloneLayers(layers: Layer[]) {
  return layers.map((layer) => ({
    ...layer,
    pixels: new Map(layer.pixels)
  }))
}

export function useCanvas() {
  const nextLayerNumberRef = useRef(2)
  const historyRef = useRef<CanvasHistoryEntry[]>([])
  const [canvasSize, setCanvasSizeState] = useState<CanvasSize>({ width: 32, height: 32 })
  const [zoom, setZoomState] = useState(1)
  const [minZoom, setMinZoomState] = useState(0.5)
  const [isDrawing, setIsDrawing] = useState(false)
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 })
  const [layers, setLayers] = useState<Layer[]>(() => [createLayer('layer-1', 'Слой 1')])
  const [activeLayerId, setActiveLayerId] = useState('layer-1')
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null)
  const [referenceOpacity, setReferenceOpacity] = useState(0.45)
  const [referenceScale, setReferenceScaleState] = useState(1)
  const [isReferenceVisible, setIsReferenceVisible] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeLayer = layers.find((layer) => layer.id === activeLayerId) ?? layers[0]
  const pixels = activeLayer?.pixels ?? new Map<string, string>()

  const pushHistory = useCallback(() => {
    historyRef.current.push({
      canvasSize: { ...canvasSize },
      layers: cloneLayers(layers),
      activeLayerId,
      nextLayerNumber: nextLayerNumberRef.current
    })

    if (historyRef.current.length > MAX_HISTORY_ENTRIES) {
      historyRef.current.shift()
    }
  }, [activeLayerId, canvasSize, layers])

  const undo = useCallback(() => {
    const previousEntry = historyRef.current.pop()
    if (!previousEntry) return

    setCanvasSizeState(previousEntry.canvasSize)
    setLayers(cloneLayers(previousEntry.layers))
    setActiveLayerId(previousEntry.activeLayerId)
    nextLayerNumberRef.current = previousEntry.nextLayerNumber
  }, [])

  const setPixels = useCallback((nextPixels: Map<string, string>) => {
    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === activeLayerId
          ? { ...layer, pixels: nextPixels }
          : layer
      )
    )
  }, [activeLayerId])

  const clearCanvas = useCallback(() => {
    pushHistory()
    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === activeLayerId
          ? { ...layer, pixels: new Map() }
          : layer
      )
    )
  }, [activeLayerId, pushHistory])

  const setCanvasSize = useCallback((size: CanvasSize) => {
    pushHistory()
    setLayers((currentLayers) =>
      currentLayers.map((layer) => {
        const nextPixels = new Map<string, string>()

        layer.pixels.forEach((color, key) => {
          const [x, y] = key.split(',').map(Number)

          if (x >= 0 && y >= 0 && x < size.width && y < size.height) {
            nextPixels.set(key, color)
          }
        })

        return {
          ...layer,
          pixels: nextPixels
        }
      })
    )

    setCanvasSizeState(size)
  }, [pushHistory])

  const setZoom = useCallback((nextZoom: number) => {
    setZoomState((currentZoom) => {
      const clampedZoom = Math.min(4, Math.max(minZoom, nextZoom))
      if (currentZoom === clampedZoom) return currentZoom
      return clampedZoom
    })
  }, [minZoom])

  const setMinZoom = useCallback((nextMinZoom: number) => {
    const clampedMinZoom = Math.min(4, Math.max(0.01, nextMinZoom))
    setMinZoomState(clampedMinZoom)
    setZoomState((currentZoom) => Math.max(clampedMinZoom, currentZoom))
  }, [])

  const setReferenceScale = useCallback((nextScale: number) => {
    setReferenceScaleState(Math.min(4, Math.max(0.1, nextScale)))
  }, [])

  const addLayer = useCallback(() => {
    pushHistory()
    const nextLayerNumber = nextLayerNumberRef.current
    nextLayerNumberRef.current += 1
    const nextId = `layer-${nextLayerNumber}`

    setLayers((currentLayers) => [
      createLayer(nextId, `Слой ${nextLayerNumber}`),
      ...currentLayers
    ])
    setActiveLayerId(nextId)
  }, [pushHistory])

  const addLayerWithPixels = useCallback((pixels: Map<string, string>, name?: string) => {
    pushHistory()
    const nextLayerNumber = nextLayerNumberRef.current
    nextLayerNumberRef.current += 1
    const nextId = `layer-${nextLayerNumber}`

    setLayers((currentLayers) => [
      {
        ...createLayer(nextId, name?.trim() || `Слой ${nextLayerNumber}`),
        pixels: new Map(pixels)
      },
      ...currentLayers
    ])
    setActiveLayerId(nextId)
  }, [pushHistory])

  const removeLayer = useCallback((layerId: string) => {
    if (layers.length === 1) return
    pushHistory()
    setLayers((currentLayers) => {
      if (currentLayers.length === 1) return currentLayers

      const nextLayers = currentLayers.filter((layer) => layer.id !== layerId)
      if (nextLayers.length === currentLayers.length) return currentLayers

      setActiveLayerId((currentActiveLayerId) => {
        if (currentActiveLayerId !== layerId) return currentActiveLayerId
        return nextLayers[0]?.id ?? currentActiveLayerId
      })

      return nextLayers
    })
  }, [layers.length, pushHistory])

  const toggleLayerVisibility = useCallback((layerId: string) => {
    pushHistory()
    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId
          ? { ...layer, visible: !layer.visible }
          : layer
      )
    )
  }, [pushHistory])

  const renameLayer = useCallback((layerId: string, name: string) => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    pushHistory()
    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId
          ? { ...layer, name: trimmedName }
          : layer
      )
    )
  }, [pushHistory])

  const translateLayer = useCallback((layerId: string, dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return

    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              pixels: translatePixels(layer.pixels, dx, dy, canvasSize.width, canvasSize.height)
            }
          : layer
      )
    )
  }, [canvasSize.height, canvasSize.width])

  const loadCanvasProjectState = useCallback((state: {
    canvasSize: CanvasSize
    layers: Layer[]
    activeLayerId: string
    referenceImageUrl: string | null
    referenceOpacity: number
    referenceScale: number
    isReferenceVisible: boolean
    nextLayerNumber: number
  }) => {
    historyRef.current = []
    nextLayerNumberRef.current = Math.max(2, state.nextLayerNumber)
    setCanvasSizeState(state.canvasSize)
    setLayers(cloneLayers(state.layers))
    setActiveLayerId(state.activeLayerId)
    setReferenceImageUrl(state.referenceImageUrl)
    setReferenceOpacity(state.referenceOpacity)
    setReferenceScaleState(Math.min(4, Math.max(0.1, state.referenceScale)))
    setIsReferenceVisible(state.isReferenceVisible)
  }, [])

  return {
    canvasSize,
    setCanvasSize,
    zoom,
    minZoom,
    setZoom,
    setMinZoom,
    layers,
    activeLayerId,
    setActiveLayerId,
    referenceImageUrl,
    setReferenceImageUrl,
    referenceOpacity,
    setReferenceOpacity,
    referenceScale,
    setReferenceScale,
    isReferenceVisible,
    setIsReferenceVisible,
    addLayer,
    addLayerWithPixels,
    removeLayer,
    toggleLayerVisibility,
    renameLayer,
    translateLayer,
    isDrawing,
    setIsDrawing,
    mousePosition,
    setMousePosition,
    pixels,
    setPixels,
    pushHistory,
    undo,
    clearCanvas,
    loadCanvasProjectState,
    canvasRef
  }
}
