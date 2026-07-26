import { useCallback, useRef, useState } from 'react'
import { useI18nContext } from '@/features/i18n'
import { AnimationFrame, CanvasSize, Layer, MousePosition } from '@/shared/types'

type CanvasHistoryEntry = {
  canvasSize: CanvasSize
  frames: AnimationFrame[]
  activeFrameId: string
  selectedLayerIds: string[]
  selectionAnchorLayerId: string
  nextFrameNumber: number
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

function cloneLayers(layers: Layer[]) {
  return layers.map((layer) => ({
    ...layer,
    pixels: new Map(layer.pixels)
  }))
}

function cloneFrame(frame: AnimationFrame): AnimationFrame {
  return {
    ...frame,
    layers: cloneLayers(frame.layers)
  }
}

function cloneFrames(frames: AnimationFrame[]) {
  return frames.map(cloneFrame)
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

function getLayerBounds(pixels: Map<string, string>) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  pixels.forEach((_, key) => {
    const [x, y] = key.split(',').map(Number)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  })

  if (!Number.isFinite(minX)) return null

  return { minX, minY, maxX, maxY }
}

function flipPixelsHorizontally(pixels: Map<string, string>) {
  const bounds = getLayerBounds(pixels)
  if (!bounds) return pixels

  const nextPixels = new Map<string, string>()

  pixels.forEach((color, key) => {
    const [x, y] = key.split(',').map(Number)
    const flippedX = bounds.maxX - (x - bounds.minX)
    nextPixels.set(`${flippedX},${y}`, color)
  })

  return nextPixels
}

function flipPixelsVertically(pixels: Map<string, string>) {
  const bounds = getLayerBounds(pixels)
  if (!bounds) return pixels

  const nextPixels = new Map<string, string>()

  pixels.forEach((color, key) => {
    const [x, y] = key.split(',').map(Number)
    const flippedY = bounds.maxY - (y - bounds.minY)
    nextPixels.set(`${x},${flippedY}`, color)
  })

  return nextPixels
}

function getFrameNumberFromId(frameId: string) {
  const match = /^frame-(\d+)$/.exec(frameId)
  return match ? Number(match[1]) : 0
}

export function useCanvas() {
  const { t } = useI18nContext()
  const initialLayer = createLayer('layer-1', t('project.defaultLayer', { number: 1 }))
  const initialFrame: AnimationFrame = {
    id: 'frame-1',
    name: t('canvas.animation.frameLabel', { number: 1 }),
    layers: [initialLayer],
    activeLayerId: initialLayer.id,
    nextLayerNumber: 2
  }

  const nextFrameNumberRef = useRef(2)
  const historyRef = useRef<CanvasHistoryEntry[]>([])
  const selectionAnchorLayerIdRef = useRef(initialLayer.id)
  const [canvasSize, setCanvasSizeState] = useState<CanvasSize>({ width: 32, height: 32 })
  const [zoom, setZoomState] = useState(1)
  const [minZoom, setMinZoomState] = useState(0.5)
  const [isDrawing, setIsDrawing] = useState(false)
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 })
  const [frames, setFrames] = useState<AnimationFrame[]>(() => [initialFrame])
  const [activeFrameIdState, setActiveFrameIdState] = useState(initialFrame.id)
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([initialLayer.id])
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null)
  const [referenceOpacity, setReferenceOpacity] = useState(0.45)
  const [referenceScale, setReferenceScaleState] = useState(1)
  const [referenceOffset, setReferenceOffsetState] = useState({ x: 0, y: 0 })
  const [isReferenceMoveMode, setIsReferenceMoveMode] = useState(false)
  const [isReferenceVisible, setIsReferenceVisible] = useState(true)
  const [animationFps, setAnimationFpsState] = useState(8)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const activeFrame = frames.find((frame) => frame.id === activeFrameIdState) ?? frames[0]
  const layers = activeFrame?.layers ?? []
  const activeLayerIdState = activeFrame?.activeLayerId ?? layers[0]?.id ?? ''
  const activeLayer = layers.find((layer) => layer.id === activeLayerIdState) ?? layers[0]
  const pixels = activeLayer?.pixels ?? new Map<string, string>()

  const pushHistory = useCallback(() => {
    historyRef.current.push({
      canvasSize: { ...canvasSize },
      frames: cloneFrames(frames),
      activeFrameId: activeFrameIdState,
      selectedLayerIds: [...selectedLayerIds],
      selectionAnchorLayerId: selectionAnchorLayerIdRef.current,
      nextFrameNumber: nextFrameNumberRef.current
    })

    if (historyRef.current.length > MAX_HISTORY_ENTRIES) {
      historyRef.current.shift()
    }
  }, [activeFrameIdState, canvasSize, frames, selectedLayerIds])

  const updateActiveFrame = useCallback((updater: (frame: AnimationFrame) => AnimationFrame) => {
    setFrames((currentFrames) =>
      currentFrames.map((frame) =>
        frame.id === activeFrameIdState
          ? updater(frame)
          : frame
      )
    )
  }, [activeFrameIdState])

  const setActiveFrameId = useCallback((frameId: string) => {
    const nextFrame = frames.find((frame) => frame.id === frameId)
    if (!nextFrame) return

    selectionAnchorLayerIdRef.current = nextFrame.activeLayerId
    setActiveFrameIdState(frameId)
    setSelectedLayerIds([nextFrame.activeLayerId])
  }, [frames])

  const setActiveLayerId = useCallback((layerId: string) => {
    if (!layers.some((layer) => layer.id === layerId)) return

    selectionAnchorLayerIdRef.current = layerId
    updateActiveFrame((frame) => ({
      ...frame,
      activeLayerId: layerId
    }))
    setSelectedLayerIds([layerId])
  }, [layers, updateActiveFrame])

  const selectLayer = useCallback((layerId: string, options?: { toggle?: boolean; range?: boolean }) => {
    if (!layers.some((layer) => layer.id === layerId)) return

    if (options?.range) {
      const anchorLayerId = selectionAnchorLayerIdRef.current
      const anchorIndex = layers.findIndex((layer) => layer.id === anchorLayerId)
      const targetIndex = layers.findIndex((layer) => layer.id === layerId)

      if (anchorIndex !== -1 && targetIndex !== -1) {
        const [startIndex, endIndex] = anchorIndex < targetIndex
          ? [anchorIndex, targetIndex]
          : [targetIndex, anchorIndex]

        setSelectedLayerIds(layers.slice(startIndex, endIndex + 1).map((layer) => layer.id))
        updateActiveFrame((frame) => ({
          ...frame,
          activeLayerId: layerId
        }))
        return
      }
    }

    if (options?.toggle) {
      selectionAnchorLayerIdRef.current = layerId
      setSelectedLayerIds((currentSelectedLayerIds) => {
        if (currentSelectedLayerIds.includes(layerId)) {
          if (currentSelectedLayerIds.length === 1) {
            updateActiveFrame((frame) => ({
              ...frame,
              activeLayerId: layerId
            }))
            return currentSelectedLayerIds
          }

          const nextSelectedLayerIds = currentSelectedLayerIds.filter((id) => id !== layerId)
          updateActiveFrame((frame) => ({
            ...frame,
            activeLayerId: frame.activeLayerId === layerId ? nextSelectedLayerIds[0] : frame.activeLayerId
          }))
          return nextSelectedLayerIds
        }

        updateActiveFrame((frame) => ({
          ...frame,
          activeLayerId: layerId
        }))
        return [...currentSelectedLayerIds, layerId]
      })
      return
    }

    selectionAnchorLayerIdRef.current = layerId
    updateActiveFrame((frame) => ({
      ...frame,
      activeLayerId: layerId
    }))
    setSelectedLayerIds([layerId])
  }, [layers, updateActiveFrame])

  const undo = useCallback(() => {
    const previousEntry = historyRef.current.pop()
    if (!previousEntry) return

    setCanvasSizeState(previousEntry.canvasSize)
    setFrames(cloneFrames(previousEntry.frames))
    setActiveFrameIdState(previousEntry.activeFrameId)
    setSelectedLayerIds([...previousEntry.selectedLayerIds])
    selectionAnchorLayerIdRef.current = previousEntry.selectionAnchorLayerId
    nextFrameNumberRef.current = previousEntry.nextFrameNumber
  }, [])

  const setPixels = useCallback((nextPixels: Map<string, string>) => {
    updateActiveFrame((frame) => ({
      ...frame,
      layers: frame.layers.map((layer) =>
        layer.id === frame.activeLayerId
          ? { ...layer, pixels: nextPixels }
          : layer
      )
    }))
  }, [updateActiveFrame])

  const clearCanvas = useCallback(() => {
    pushHistory()
    updateActiveFrame((frame) => ({
      ...frame,
      layers: frame.layers.map((layer) =>
        layer.id === frame.activeLayerId
          ? { ...layer, pixels: new Map() }
          : layer
      )
    }))
  }, [pushHistory, updateActiveFrame])

  const setCanvasSize = useCallback((size: CanvasSize) => {
    pushHistory()
    setFrames((currentFrames) =>
      currentFrames.map((frame) => ({
        ...frame,
        layers: frame.layers.map((layer) => {
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
      }))
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

  const setReferenceOffset = useCallback((nextOffset: { x: number; y: number }) => {
    const nextX = Number.isFinite(nextOffset.x) ? nextOffset.x : 0
    const nextY = Number.isFinite(nextOffset.y) ? nextOffset.y : 0
    setReferenceOffsetState({ x: nextX, y: nextY })
  }, [])

  const setAnimationFps = useCallback((nextFps: number) => {
    setAnimationFpsState(Math.max(1, Math.min(24, Math.round(nextFps))))
  }, [])

  const addFrame = useCallback(() => {
    pushHistory()
    const nextFrameNumber = nextFrameNumberRef.current
    nextFrameNumberRef.current += 1
    const nextFrameId = `frame-${nextFrameNumber}`

    const sourceFrame = activeFrame ?? frames[0]
    const nextFrame: AnimationFrame = sourceFrame
      ? {
          id: nextFrameId,
          name: t('canvas.animation.frameLabel', { number: nextFrameNumber }),
          layers: cloneLayers(sourceFrame.layers),
          activeLayerId: sourceFrame.activeLayerId,
          nextLayerNumber: sourceFrame.nextLayerNumber
        }
      : {
          id: nextFrameId,
          name: t('canvas.animation.frameLabel', { number: nextFrameNumber }),
          layers: [createLayer('layer-1', t('project.defaultLayer', { number: 1 }))],
          activeLayerId: 'layer-1',
          nextLayerNumber: 2
        }

    setFrames((currentFrames) => {
      const sourceIndex = currentFrames.findIndex((frame) => frame.id === activeFrameIdState)
      const nextFrames = [...currentFrames]
      const insertIndex = sourceIndex === -1 ? currentFrames.length : sourceIndex + 1
      nextFrames.splice(insertIndex, 0, nextFrame)
      return nextFrames
    })
    selectionAnchorLayerIdRef.current = nextFrame.activeLayerId
    setActiveFrameIdState(nextFrameId)
    setSelectedLayerIds([nextFrame.activeLayerId])
  }, [activeFrame, activeFrameIdState, frames, pushHistory, t])

  const duplicateFrame = useCallback((frameId: string) => {
    const sourceFrame = frames.find((frame) => frame.id === frameId)
    if (!sourceFrame) return

    pushHistory()
    const nextFrameNumber = nextFrameNumberRef.current
    nextFrameNumberRef.current += 1
    const nextFrameId = `frame-${nextFrameNumber}`
    const nextFrame: AnimationFrame = {
      id: nextFrameId,
      name: `${sourceFrame.name} copy`,
      layers: cloneLayers(sourceFrame.layers),
      activeLayerId: sourceFrame.activeLayerId,
      nextLayerNumber: sourceFrame.nextLayerNumber
    }

    setFrames((currentFrames) => {
      const sourceIndex = currentFrames.findIndex((frame) => frame.id === frameId)
      const nextFrames = [...currentFrames]
      nextFrames.splice(sourceIndex + 1, 0, nextFrame)
      return nextFrames
    })
    selectionAnchorLayerIdRef.current = nextFrame.activeLayerId
    setActiveFrameIdState(nextFrameId)
    setSelectedLayerIds([nextFrame.activeLayerId])
  }, [frames, pushHistory])

  const removeFrame = useCallback((frameId: string) => {
    if (frames.length === 1) return

    pushHistory()
    setFrames((currentFrames) => {
      const sourceIndex = currentFrames.findIndex((frame) => frame.id === frameId)
      if (sourceIndex === -1 || currentFrames.length === 1) return currentFrames

      const nextFrames = currentFrames.filter((frame) => frame.id !== frameId)
      const fallbackFrame = nextFrames[Math.max(0, sourceIndex - 1)] ?? nextFrames[0]

      if (activeFrameIdState === frameId && fallbackFrame) {
        selectionAnchorLayerIdRef.current = fallbackFrame.activeLayerId
        setActiveFrameIdState(fallbackFrame.id)
        setSelectedLayerIds([fallbackFrame.activeLayerId])
      }

      return nextFrames
    })
  }, [activeFrameIdState, frames.length, pushHistory])

  const reorderFrame = useCallback((
    frameId: string,
    targetFrameId: string,
    position: 'before' | 'after' = 'before'
  ) => {
    if (frameId === targetFrameId) return

    pushHistory()
    setFrames((currentFrames) => {
      const sourceIndex = currentFrames.findIndex((frame) => frame.id === frameId)
      const targetIndex = currentFrames.findIndex((frame) => frame.id === targetFrameId)

      if (sourceIndex === -1 || targetIndex === -1) return currentFrames

      const nextFrames = [...currentFrames]
      const [movedFrame] = nextFrames.splice(sourceIndex, 1)
      const nextTargetIndex = nextFrames.findIndex((frame) => frame.id === targetFrameId)
      const insertIndex = position === 'after' ? nextTargetIndex + 1 : nextTargetIndex
      nextFrames.splice(insertIndex, 0, movedFrame)
      return nextFrames
    })
  }, [pushHistory])

  const addLayer = useCallback(() => {
    pushHistory()
    updateActiveFrame((frame) => {
      const nextLayerNumber = frame.nextLayerNumber
      const nextId = `layer-${nextLayerNumber}`

      selectionAnchorLayerIdRef.current = nextId
      setSelectedLayerIds([nextId])

      return {
        ...frame,
        layers: [
          createLayer(nextId, t('project.defaultLayer', { number: nextLayerNumber })),
          ...frame.layers
        ],
        activeLayerId: nextId,
        nextLayerNumber: nextLayerNumber + 1
      }
    })
  }, [pushHistory, t, updateActiveFrame])

  const addLayerWithPixels = useCallback((pixelsMap: Map<string, string>, name?: string) => {
    pushHistory()
    updateActiveFrame((frame) => {
      const nextLayerNumber = frame.nextLayerNumber
      const nextId = `layer-${nextLayerNumber}`

      selectionAnchorLayerIdRef.current = nextId
      setSelectedLayerIds([nextId])

      return {
        ...frame,
        layers: [
          {
            ...createLayer(nextId, name?.trim() || t('project.defaultLayer', { number: nextLayerNumber })),
            pixels: new Map(pixelsMap)
          },
          ...frame.layers
        ],
        activeLayerId: nextId,
        nextLayerNumber: nextLayerNumber + 1
      }
    })
  }, [pushHistory, t, updateActiveFrame])

  const reorderLayer = useCallback((
    layerId: string,
    targetLayerId: string,
    position: 'before' | 'after' = 'before'
  ) => {
    if (layerId === targetLayerId) return

    pushHistory()
    updateActiveFrame((frame) => {
      const sourceIndex = frame.layers.findIndex((layer) => layer.id === layerId)
      const targetIndex = frame.layers.findIndex((layer) => layer.id === targetLayerId)

      if (sourceIndex === -1 || targetIndex === -1) return frame

      const nextLayers = [...frame.layers]
      const [movedLayer] = nextLayers.splice(sourceIndex, 1)
      const baseTargetIndex = nextLayers.findIndex((layer) => layer.id === targetLayerId)
      const insertIndex = position === 'after' ? baseTargetIndex + 1 : baseTargetIndex
      nextLayers.splice(insertIndex, 0, movedLayer)

      return {
        ...frame,
        layers: nextLayers
      }
    })
  }, [pushHistory, updateActiveFrame])

  const removeLayer = useCallback((layerId: string) => {
    if (layers.length === 1) return

    pushHistory()
    updateActiveFrame((frame) => {
      if (frame.layers.length === 1) return frame

      const nextLayers = frame.layers.filter((layer) => layer.id !== layerId)
      if (nextLayers.length === frame.layers.length) return frame

      const nextActiveLayerId = frame.activeLayerId === layerId
        ? nextLayers[0]?.id ?? frame.activeLayerId
        : frame.activeLayerId

      setSelectedLayerIds((currentSelectedLayerIds) => {
        const nextSelectedLayerIds = currentSelectedLayerIds.filter((id) => id !== layerId)
        return nextSelectedLayerIds.length > 0 ? nextSelectedLayerIds : [nextActiveLayerId]
      })

      if (selectionAnchorLayerIdRef.current === layerId) {
        selectionAnchorLayerIdRef.current = nextActiveLayerId
      }

      return {
        ...frame,
        layers: nextLayers,
        activeLayerId: nextActiveLayerId
      }
    })
  }, [layers.length, pushHistory, updateActiveFrame])

  const toggleLayerVisibility = useCallback((layerId: string) => {
    pushHistory()
    updateActiveFrame((frame) => ({
      ...frame,
      layers: frame.layers.map((layer) =>
        layer.id === layerId
          ? { ...layer, visible: !layer.visible }
          : layer
      )
    }))
  }, [pushHistory, updateActiveFrame])

  const renameLayer = useCallback((layerId: string, name: string) => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    pushHistory()
    updateActiveFrame((frame) => ({
      ...frame,
      layers: frame.layers.map((layer) =>
        layer.id === layerId
          ? { ...layer, name: trimmedName }
          : layer
      )
    }))
  }, [pushHistory, updateActiveFrame])

  const translateLayer = useCallback((layerId: string, dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return

    updateActiveFrame((frame) => ({
      ...frame,
      layers: frame.layers.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              pixels: translatePixels(layer.pixels, dx, dy, canvasSize.width, canvasSize.height)
            }
          : layer
      )
    }))
  }, [canvasSize.height, canvasSize.width, updateActiveFrame])

  const flipLayerHorizontal = useCallback((layerId: string) => {
    pushHistory()
    updateActiveFrame((frame) => ({
      ...frame,
      layers: frame.layers.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              pixels: flipPixelsHorizontally(layer.pixels)
            }
          : layer
      )
    }))
  }, [pushHistory, updateActiveFrame])

  const flipLayerVertical = useCallback((layerId: string) => {
    pushHistory()
    updateActiveFrame((frame) => ({
      ...frame,
      layers: frame.layers.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              pixels: flipPixelsVertically(layer.pixels)
            }
          : layer
      )
    }))
  }, [pushHistory, updateActiveFrame])

  const loadCanvasProjectState = useCallback((state: {
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
    referenceOffset?: {
      x: number
      y: number
    }
    isReferenceVisible: boolean
    nextLayerNumber: number
  }) => {
    historyRef.current = []

    const restoredFrames = state.frames && state.frames.length > 0
      ? cloneFrames(state.frames)
      : [{
          id: 'frame-1',
          name: t('canvas.animation.frameLabel', { number: 1 }),
          layers: cloneLayers(state.layers),
          activeLayerId: state.activeLayerId,
          nextLayerNumber: Math.max(2, state.nextLayerNumber)
        }]

    const restoredActiveFrameId =
      state.activeFrameId && restoredFrames.some((frame) => frame.id === state.activeFrameId)
        ? state.activeFrameId
        : restoredFrames[0].id
    const restoredActiveFrame =
      restoredFrames.find((frame) => frame.id === restoredActiveFrameId) ?? restoredFrames[0]

    nextFrameNumberRef.current = Math.max(
      state.nextFrameNumber ?? 2,
      restoredFrames.reduce((maxFrameNumber, frame) => Math.max(maxFrameNumber, getFrameNumberFromId(frame.id)), 1) + 1
    )
    setCanvasSizeState(state.canvasSize)
    setFrames(restoredFrames)
    setActiveFrameIdState(restoredActiveFrameId)
    selectionAnchorLayerIdRef.current = restoredActiveFrame.activeLayerId
    setSelectedLayerIds([restoredActiveFrame.activeLayerId])
    setReferenceImageUrl(state.referenceImageUrl)
    setReferenceOpacity(state.referenceOpacity)
    setReferenceScaleState(Math.min(4, Math.max(0.1, state.referenceScale)))
    setReferenceOffsetState({
      x: state.referenceOffset?.x ?? 0,
      y: state.referenceOffset?.y ?? 0
    })
    setIsReferenceVisible(state.isReferenceVisible)
    setAnimationFpsState(Math.max(1, Math.min(24, state.animationFps ?? 8)))
  }, [t])

  return {
    canvasSize,
    setCanvasSize,
    zoom,
    minZoom,
    setZoom,
    setMinZoom,
    frames,
    activeFrameId: activeFrameIdState,
    setActiveFrameId,
    addFrame,
    duplicateFrame,
    removeFrame,
    reorderFrame,
    animationFps,
    setAnimationFps,
    layers,
    activeLayerId: activeLayerIdState,
    selectedLayerIds,
    setActiveLayerId,
    selectLayer,
    referenceImageUrl,
    setReferenceImageUrl,
    referenceOpacity,
    setReferenceOpacity,
    referenceScale,
    setReferenceScale,
    referenceOffset,
    setReferenceOffset,
    isReferenceMoveMode,
    setIsReferenceMoveMode,
    isReferenceVisible,
    setIsReferenceVisible,
    addLayer,
    addLayerWithPixels,
    reorderLayer,
    removeLayer,
    toggleLayerVisibility,
    renameLayer,
    translateLayer,
    flipLayerHorizontal,
    flipLayerVertical,
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
