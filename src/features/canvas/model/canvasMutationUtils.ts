import type { AnimationFrame, CanvasSize } from '@/shared/types'
import { cloneFrames, type CanvasHistoryEntry } from './canvasSessionUtils'
import {
  flipLayerPixelsHorizontally,
  flipLayerPixelsVertically,
  translateLayerPixels
} from './canvasStateUtils'

export type UndoCanvasState = {
  canvasSize: CanvasSize
  frames: AnimationFrame[]
  activeFrameId: string
  selectedLayerIds: string[]
  selectionAnchorLayerId: string
  nextFrameNumber: number
}

export function applyUndoHistoryEntry(previousEntry: CanvasHistoryEntry | undefined): UndoCanvasState | null {
  if (!previousEntry) return null

  return {
    canvasSize: { ...previousEntry.canvasSize },
    frames: cloneFrames(previousEntry.frames),
    activeFrameId: previousEntry.activeFrameId,
    selectedLayerIds: [...previousEntry.selectedLayerIds],
    selectionAnchorLayerId: previousEntry.selectionAnchorLayerId,
    nextFrameNumber: previousEntry.nextFrameNumber
  }
}

export function setActiveLayerPixels(frame: AnimationFrame, nextPixels: Map<string, string>) {
  return {
    ...frame,
    layers: frame.layers.map((layer) =>
      layer.id === frame.activeLayerId
        ? { ...layer, pixels: nextPixels }
        : layer
    )
  }
}

export function clearActiveLayerPixels(frame: AnimationFrame) {
  return setActiveLayerPixels(frame, new Map())
}

export function resizeFramesToCanvas(frames: AnimationFrame[], size: CanvasSize) {
  return frames.map((frame) => ({
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
}

export function translateLayerInFrame(
  frame: AnimationFrame,
  layerId: string,
  dx: number,
  dy: number,
  canvasSize: CanvasSize
) {
  if (dx === 0 && dy === 0) return frame

  return {
    ...frame,
    layers: frame.layers.map((layer) =>
      layer.id === layerId
        ? {
            ...layer,
            pixels: translateLayerPixels(layer.pixels, dx, dy, canvasSize.width, canvasSize.height)
          }
        : layer
    )
  }
}

export function flipLayerInFrame(frame: AnimationFrame, layerId: string, axis: 'horizontal' | 'vertical') {
  return {
    ...frame,
    layers: frame.layers.map((layer) =>
      layer.id === layerId
        ? {
            ...layer,
            pixels: axis === 'horizontal'
              ? flipLayerPixelsHorizontally(layer.pixels)
              : flipLayerPixelsVertically(layer.pixels)
          }
        : layer
    )
  }
}
