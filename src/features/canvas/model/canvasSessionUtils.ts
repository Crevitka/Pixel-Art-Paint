import type { AnimationFrame, CanvasSize, Layer } from '@/shared/types'

export type CanvasHistoryEntry = {
  canvasSize: CanvasSize
  frames: AnimationFrame[]
  activeFrameId: string
  selectedLayerIds: string[]
  selectionAnchorLayerId: string
  nextFrameNumber: number
}

export type CanvasProjectStateInput = {
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
}

export type RestoredCanvasProjectState = {
  canvasSize: CanvasSize
  frames: AnimationFrame[]
  activeFrameId: string
  selectedLayerIds: string[]
  selectionAnchorLayerId: string
  referenceImageUrl: string | null
  referenceOpacity: number
  referenceScale: number
  referenceOffset: {
    x: number
    y: number
  }
  isReferenceVisible: boolean
  animationFps: number
  nextFrameNumber: number
}

export function cloneLayers(layers: Layer[]) {
  return layers.map((layer) => ({
    ...layer,
    pixels: new Map(layer.pixels)
  }))
}

export function cloneFrame(frame: AnimationFrame): AnimationFrame {
  return {
    ...frame,
    layers: cloneLayers(frame.layers)
  }
}

export function cloneFrames(frames: AnimationFrame[]) {
  return frames.map(cloneFrame)
}

export function getFrameNumberFromId(frameId: string) {
  const match = /^frame-(\d+)$/.exec(frameId)
  return match ? Number(match[1]) : 0
}

export function pushCanvasHistoryEntry(
  historyEntries: CanvasHistoryEntry[],
  nextEntry: CanvasHistoryEntry,
  maxEntries: number
) {
  const nextHistoryEntries = [
    ...historyEntries,
    {
      ...nextEntry,
      canvasSize: { ...nextEntry.canvasSize },
      frames: cloneFrames(nextEntry.frames),
      selectedLayerIds: [...nextEntry.selectedLayerIds]
    }
  ]

  if (nextHistoryEntries.length <= maxEntries) {
    return nextHistoryEntries
  }

  return nextHistoryEntries.slice(nextHistoryEntries.length - maxEntries)
}

export function restoreCanvasProjectState(
  state: CanvasProjectStateInput,
  getFrameLabel: (number: number) => string
): RestoredCanvasProjectState {
  const restoredFrames = state.frames && state.frames.length > 0
    ? cloneFrames(state.frames)
    : [{
        id: 'frame-1',
        name: getFrameLabel(1),
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

  return {
    canvasSize: { ...state.canvasSize },
    frames: restoredFrames,
    activeFrameId: restoredActiveFrameId,
    selectedLayerIds: [restoredActiveFrame.activeLayerId],
    selectionAnchorLayerId: restoredActiveFrame.activeLayerId,
    referenceImageUrl: state.referenceImageUrl,
    referenceOpacity: state.referenceOpacity,
    referenceScale: Math.min(4, Math.max(0.1, state.referenceScale)),
    referenceOffset: {
      x: state.referenceOffset?.x ?? 0,
      y: state.referenceOffset?.y ?? 0
    },
    isReferenceVisible: state.isReferenceVisible,
    animationFps: Math.max(1, Math.min(24, state.animationFps ?? 8)),
    nextFrameNumber: Math.max(
      state.nextFrameNumber ?? 2,
      restoredFrames.reduce((maxFrameNumber, frame) => Math.max(maxFrameNumber, getFrameNumberFromId(frame.id)), 1) + 1
    )
  }
}
