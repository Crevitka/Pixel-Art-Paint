import { useCallback, useRef, useState } from 'react'
import { useI18nContext } from '@/features/i18n'
import { AnimationFrame, CanvasSize, Layer, MousePosition } from '@/shared/types'
import {
  addFrameToState,
  addLayerToFrame,
  addLayerWithPixelsToFrame,
  duplicateFrameInState,
  getActiveFrameSelectionState,
  getNextLayerSelectionState,
  removeFrameAndResolveSelection,
  removeLayerAndResolveSelection,
  renameLayerInFrame
} from './canvasEditorOpsUtils'
import {
  applyUndoHistoryEntry,
  clearActiveLayerPixels,
  flipLayerInFrame,
  resizeFramesToCanvas,
  setActiveLayerPixels,
  translateLayerInFrame
} from './canvasMutationUtils'
import {
  CanvasHistoryEntry,
  cloneFrames,
  restoreCanvasProjectState,
  pushCanvasHistoryEntry
} from './canvasSessionUtils'
import {
  reorderFramesInState,
  reorderLayersInFrame,
  toggleLayerVisibilityInFrame
} from './canvasStateUtils'

const MAX_HISTORY_ENTRIES = 100

function createLayer(id: string, name: string): Layer {
  return {
    id,
    name,
    visible: true,
    pixels: new Map()
  }
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
    historyRef.current = pushCanvasHistoryEntry(historyRef.current, {
      canvasSize: { ...canvasSize },
      frames: cloneFrames(frames),
      activeFrameId: activeFrameIdState,
      selectedLayerIds: [...selectedLayerIds],
      selectionAnchorLayerId: selectionAnchorLayerIdRef.current,
      nextFrameNumber: nextFrameNumberRef.current
    }, MAX_HISTORY_ENTRIES)
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
    const nextSelectionState = getActiveFrameSelectionState(frames, frameId)
    if (!nextSelectionState) return

    selectionAnchorLayerIdRef.current = nextSelectionState.selectionAnchorLayerId
    setActiveFrameIdState(nextSelectionState.activeFrameId)
    setSelectedLayerIds(nextSelectionState.selectedLayerIds)
  }, [frames])

  const setActiveLayerId = useCallback((layerId: string) => {
    const nextSelectionState = getNextLayerSelectionState({
      layers,
      selectionAnchorLayerId: selectionAnchorLayerIdRef.current,
      currentSelectedLayerIds: selectedLayerIds,
      layerId,
      activeLayerId: activeLayerIdState
    })
    if (!nextSelectionState) return

    selectionAnchorLayerIdRef.current = nextSelectionState.selectionAnchorLayerId
    updateActiveFrame((frame) => ({
      ...frame,
      activeLayerId: nextSelectionState.activeLayerId
    }))
    setSelectedLayerIds(nextSelectionState.selectedLayerIds)
  }, [activeLayerIdState, layers, selectedLayerIds, updateActiveFrame])

  const selectLayer = useCallback((layerId: string, options?: { toggle?: boolean; range?: boolean }) => {
    const nextSelectionState = getNextLayerSelectionState({
      layers,
      selectionAnchorLayerId: selectionAnchorLayerIdRef.current,
      currentSelectedLayerIds: selectedLayerIds,
      layerId,
      toggle: options?.toggle,
      range: options?.range,
      activeLayerId: activeLayerIdState
    })
    if (!nextSelectionState) return

    selectionAnchorLayerIdRef.current = nextSelectionState.selectionAnchorLayerId
    updateActiveFrame((frame) => ({
      ...frame,
      activeLayerId: nextSelectionState.activeLayerId
    }))
    setSelectedLayerIds(nextSelectionState.selectedLayerIds)
  }, [activeLayerIdState, layers, selectedLayerIds, updateActiveFrame])

  const undo = useCallback(() => {
    const nextState = applyUndoHistoryEntry(historyRef.current.pop())
    if (!nextState) return

    setCanvasSizeState(nextState.canvasSize)
    setFrames(nextState.frames)
    setActiveFrameIdState(nextState.activeFrameId)
    setSelectedLayerIds(nextState.selectedLayerIds)
    selectionAnchorLayerIdRef.current = nextState.selectionAnchorLayerId
    nextFrameNumberRef.current = nextState.nextFrameNumber
  }, [])

  const setPixels = useCallback((nextPixels: Map<string, string>) => {
    updateActiveFrame((frame) => setActiveLayerPixels(frame, nextPixels))
  }, [updateActiveFrame])

  const clearCanvas = useCallback(() => {
    pushHistory()
    updateActiveFrame(clearActiveLayerPixels)
  }, [pushHistory, updateActiveFrame])

  const setCanvasSize = useCallback((size: CanvasSize) => {
    pushHistory()
    setFrames((currentFrames) => resizeFramesToCanvas(currentFrames, size))
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
    const nextState = addFrameToState({
      frames,
      activeFrameId: activeFrameIdState,
      nextFrameNumber: nextFrameNumberRef.current,
      getFrameLabel: (number) => t('canvas.animation.frameLabel', { number }),
      getDefaultLayerName: (number) => t('project.defaultLayer', { number })
    })

    nextFrameNumberRef.current = nextState.nextFrameNumber
    setFrames(nextState.frames)
    selectionAnchorLayerIdRef.current = nextState.selectionAnchorLayerId
    setActiveFrameIdState(nextState.activeFrameId)
    setSelectedLayerIds(nextState.selectedLayerIds)
  }, [activeFrameIdState, frames, pushHistory, t])

  const duplicateFrame = useCallback((frameId: string) => {
    const nextState = duplicateFrameInState({
      frames,
      frameId,
      nextFrameNumber: nextFrameNumberRef.current
    })
    if (!nextState) return

    pushHistory()
    nextFrameNumberRef.current = nextState.nextFrameNumber
    setFrames(nextState.frames)
    selectionAnchorLayerIdRef.current = nextState.selectionAnchorLayerId
    setActiveFrameIdState(nextState.activeFrameId)
    setSelectedLayerIds(nextState.selectedLayerIds)
  }, [frames, pushHistory])

  const removeFrame = useCallback((frameId: string) => {
    if (frames.length === 1) return

    pushHistory()
    setFrames((currentFrames) => {
      const nextState = removeFrameAndResolveSelection({
        frames: currentFrames,
        activeFrameId: activeFrameIdState,
        frameId,
        selectedLayerIds,
        selectionAnchorLayerId: selectionAnchorLayerIdRef.current
      })
      if (!nextState) return currentFrames

      if (activeFrameIdState === frameId) {
        selectionAnchorLayerIdRef.current = nextState.selectionAnchorLayerId
        setActiveFrameIdState(nextState.activeFrameId)
        setSelectedLayerIds(nextState.selectedLayerIds)
      }

      return nextState.frames
    })
  }, [activeFrameIdState, frames.length, pushHistory, selectedLayerIds])

  const reorderFrame = useCallback((
    frameId: string,
    targetFrameId: string,
    position: 'before' | 'after' = 'before'
  ) => {
    if (frameId === targetFrameId) return

    pushHistory()
    setFrames((currentFrames) => reorderFramesInState(currentFrames, frameId, targetFrameId, position))
  }, [pushHistory])

  const addLayer = useCallback(() => {
    pushHistory()
    updateActiveFrame((frame) => {
      const nextState = addLayerToFrame({
        frame,
        getDefaultLayerName: (number) => t('project.defaultLayer', { number })
      })
      selectionAnchorLayerIdRef.current = nextState.selectionAnchorLayerId
      setSelectedLayerIds(nextState.selectedLayerIds)
      return nextState.frame
    })
  }, [pushHistory, t, updateActiveFrame])

  const addLayerWithPixels = useCallback((pixelsMap: Map<string, string>, name?: string) => {
    pushHistory()
    updateActiveFrame((frame) => {
      const nextState = addLayerWithPixelsToFrame({
        frame,
        pixelsMap,
        name,
        getDefaultLayerName: (number) => t('project.defaultLayer', { number })
      })
      selectionAnchorLayerIdRef.current = nextState.selectionAnchorLayerId
      setSelectedLayerIds(nextState.selectedLayerIds)
      return nextState.frame
    })
  }, [pushHistory, t, updateActiveFrame])

  const reorderLayer = useCallback((
    layerId: string,
    targetLayerId: string,
    position: 'before' | 'after' = 'before'
  ) => {
    if (layerId === targetLayerId) return

    pushHistory()
    updateActiveFrame((frame) => reorderLayersInFrame(frame, layerId, targetLayerId, position))
  }, [pushHistory, updateActiveFrame])

  const removeLayer = useCallback((layerId: string) => {
    if (layers.length === 1) return

    pushHistory()
    updateActiveFrame((frame) => {
      const nextState = removeLayerAndResolveSelection({
        frame,
        layerId,
        selectedLayerIds,
        selectionAnchorLayerId: selectionAnchorLayerIdRef.current
      })
      if (!nextState) return frame

      setSelectedLayerIds(nextState.selectedLayerIds)
      selectionAnchorLayerIdRef.current = nextState.selectionAnchorLayerId

      return nextState.frame
    })
  }, [layers.length, pushHistory, selectedLayerIds, updateActiveFrame])

  const toggleLayerVisibility = useCallback((layerId: string) => {
    pushHistory()
    updateActiveFrame((frame) => toggleLayerVisibilityInFrame(frame, layerId))
  }, [pushHistory, updateActiveFrame])

  const renameLayer = useCallback((layerId: string, name: string) => {
    if (!name.trim()) return

    pushHistory()
    updateActiveFrame((frame) => renameLayerInFrame(frame, layerId, name))
  }, [pushHistory, updateActiveFrame])

  const translateLayer = useCallback((layerId: string, dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return

    updateActiveFrame((frame) => translateLayerInFrame(frame, layerId, dx, dy, canvasSize))
  }, [canvasSize.height, canvasSize.width, updateActiveFrame])

  const flipLayerHorizontal = useCallback((layerId: string) => {
    pushHistory()
    updateActiveFrame((frame) => flipLayerInFrame(frame, layerId, 'horizontal'))
  }, [pushHistory, updateActiveFrame])

  const flipLayerVertical = useCallback((layerId: string) => {
    pushHistory()
    updateActiveFrame((frame) => flipLayerInFrame(frame, layerId, 'vertical'))
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
    const restoredState = restoreCanvasProjectState(
      state,
      (number) => t('canvas.animation.frameLabel', { number })
    )

    nextFrameNumberRef.current = restoredState.nextFrameNumber
    setCanvasSizeState(restoredState.canvasSize)
    setFrames(restoredState.frames)
    setActiveFrameIdState(restoredState.activeFrameId)
    selectionAnchorLayerIdRef.current = restoredState.selectionAnchorLayerId
    setSelectedLayerIds(restoredState.selectedLayerIds)
    setReferenceImageUrl(restoredState.referenceImageUrl)
    setReferenceOpacity(restoredState.referenceOpacity)
    setReferenceScaleState(restoredState.referenceScale)
    setReferenceOffsetState(restoredState.referenceOffset)
    setIsReferenceVisible(restoredState.isReferenceVisible)
    setAnimationFpsState(restoredState.animationFps)
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
