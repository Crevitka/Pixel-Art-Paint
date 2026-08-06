import type { AnimationFrame } from '@/shared/types'
import { getLayerBounds } from '../../../widgets/canvas/model/canvasUtils'

export function removeFrameFromState(options: {
  frames: AnimationFrame[]
  activeFrameId: string
  frameId: string
}) {
  const { frames, activeFrameId, frameId } = options
  if (frames.length === 1) {
    return null
  }

  const sourceIndex = frames.findIndex((frame) => frame.id === frameId)
  if (sourceIndex === -1) {
    return null
  }

  const nextFrames = frames.filter((frame) => frame.id !== frameId)
  const fallbackFrame = nextFrames[Math.max(0, sourceIndex - 1)] ?? nextFrames[0]
  const nextActiveFrameId = activeFrameId === frameId
    ? fallbackFrame?.id ?? activeFrameId
    : activeFrameId
  const nextActiveLayerId = activeFrameId === frameId
    ? fallbackFrame?.activeLayerId ?? null
    : null

  return {
    frames: nextFrames,
    activeFrameId: nextActiveFrameId,
    activeLayerId: nextActiveLayerId
  }
}

export function reorderFramesInState(
  frames: AnimationFrame[],
  frameId: string,
  targetFrameId: string,
  position: 'before' | 'after' = 'before'
) {
  if (frameId === targetFrameId) return frames

  const sourceIndex = frames.findIndex((frame) => frame.id === frameId)
  const targetIndex = frames.findIndex((frame) => frame.id === targetFrameId)
  if (sourceIndex === -1 || targetIndex === -1) return frames

  const nextFrames = [...frames]
  const [movedFrame] = nextFrames.splice(sourceIndex, 1)
  const nextTargetIndex = nextFrames.findIndex((frame) => frame.id === targetFrameId)
  const insertIndex = position === 'after' ? nextTargetIndex + 1 : nextTargetIndex
  nextFrames.splice(insertIndex, 0, movedFrame)
  return nextFrames
}

export function reorderLayersInFrame(
  frame: AnimationFrame,
  layerId: string,
  targetLayerId: string,
  position: 'before' | 'after' = 'before'
) {
  if (layerId === targetLayerId) return frame

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
}

export function removeLayerFromFrameState(options: {
  frame: AnimationFrame
  layerId: string
  selectedLayerIds: string[]
  selectionAnchorLayerId: string
}) {
  const { frame, layerId, selectedLayerIds, selectionAnchorLayerId } = options
  if (frame.layers.length === 1) {
    return null
  }

  const nextLayers = frame.layers.filter((layer) => layer.id !== layerId)
  if (nextLayers.length === frame.layers.length) {
    return null
  }

  const nextActiveLayerId = frame.activeLayerId === layerId
    ? nextLayers[0]?.id ?? frame.activeLayerId
    : frame.activeLayerId
  const nextSelectedLayerIds = selectedLayerIds.filter((id) => id !== layerId)

  return {
    frame: {
      ...frame,
      layers: nextLayers,
      activeLayerId: nextActiveLayerId
    },
    selectedLayerIds: nextSelectedLayerIds.length > 0 ? nextSelectedLayerIds : [nextActiveLayerId],
    selectionAnchorLayerId: selectionAnchorLayerId === layerId
      ? nextActiveLayerId
      : selectionAnchorLayerId
  }
}

export function toggleLayerVisibilityInFrame(frame: AnimationFrame, layerId: string) {
  return {
    ...frame,
    layers: frame.layers.map((layer) =>
      layer.id === layerId
        ? { ...layer, visible: !layer.visible }
        : layer
      )
  }
}

export function translateLayerPixels(
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

export function flipLayerPixelsHorizontally(pixels: Map<string, string>) {
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

export function flipLayerPixelsVertically(pixels: Map<string, string>) {
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
