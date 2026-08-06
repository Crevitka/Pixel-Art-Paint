import type { CanvasSize } from '@/shared/types'

export type LayerBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type ClipboardSelection = {
  width: number
  height: number
  pixels: Map<string, string>
  sourceBounds: LayerBounds
}

export type PastedClipboardState = {
  nextPixels: Map<string, string>
  nextSelectionBounds: LayerBounds
  nextClipboard: ClipboardSelection
}

export function getLayerBounds(pixels: Map<string, string>): LayerBounds | null {
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

export function translateBounds(bounds: LayerBounds, dx: number, dy: number): LayerBounds {
  return {
    minX: bounds.minX + dx,
    minY: bounds.minY + dy,
    maxX: bounds.maxX + dx,
    maxY: bounds.maxY + dy
  }
}

export function createBoundsFromPoints(startX: number, startY: number, endX: number, endY: number): LayerBounds {
  return {
    minX: Math.min(startX, endX),
    minY: Math.min(startY, endY),
    maxX: Math.max(startX, endX),
    maxY: Math.max(startY, endY)
  }
}

export function createSelectionKeysFromBounds(bounds: LayerBounds) {
  const keys = new Set<string>()

  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      keys.add(`${x},${y}`)
    }
  }

  return keys
}

export function getSelectionBoundsFromKeys(selectionKeys: Set<string>) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  selectionKeys.forEach((key) => {
    const [x, y] = key.split(',').map(Number)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  })

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null
  }

  return { minX, minY, maxX, maxY }
}

export function getConnectedSelectionKeys(
  pixelsMap: Map<string, string>,
  startX: number,
  startY: number,
  canvasSize: CanvasSize
) {
  const startKey = `${startX},${startY}`
  const targetColor = pixelsMap.get(startKey)
  if (!targetColor) return null

  const visited = new Set<string>()
  const selectionKeys = new Set<string>()
  const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }]
  let queueIndex = 0

  while (queueIndex < queue.length) {
    const point = queue[queueIndex++]
    const key = `${point.x},${point.y}`
    if (visited.has(key)) continue
    visited.add(key)

    if (pixelsMap.get(key) !== targetColor) continue
    selectionKeys.add(key)

    if (point.x > 0) queue.push({ x: point.x - 1, y: point.y })
    if (point.x < canvasSize.width - 1) queue.push({ x: point.x + 1, y: point.y })
    if (point.y > 0) queue.push({ x: point.x, y: point.y - 1 })
    if (point.y < canvasSize.height - 1) queue.push({ x: point.x, y: point.y + 1 })
  }

  return selectionKeys.size > 0 ? selectionKeys : null
}

export function clampBoundsToCanvas(bounds: LayerBounds, canvasSize: CanvasSize): LayerBounds {
  const nextMinX = Math.max(0, Math.min(bounds.minX, canvasSize.width - 1))
  const nextMinY = Math.max(0, Math.min(bounds.minY, canvasSize.height - 1))
  const nextMaxX = Math.max(nextMinX, Math.min(bounds.maxX, canvasSize.width - 1))
  const nextMaxY = Math.max(nextMinY, Math.min(bounds.maxY, canvasSize.height - 1))

  return {
    minX: nextMinX,
    minY: nextMinY,
    maxX: nextMaxX,
    maxY: nextMaxY
  }
}

export function getBoundsCenter(bounds: LayerBounds) {
  return {
    x: (bounds.minX + bounds.maxX + 1) / 2,
    y: (bounds.minY + bounds.maxY + 1) / 2
  }
}

export function removePixelsInBounds(pixels: Map<string, string>, bounds: LayerBounds) {
  const nextPixels = new Map(pixels)

  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      nextPixels.delete(`${x},${y}`)
    }
  }

  return nextPixels
}

export function removePixelsInSelectionKeys(pixels: Map<string, string>, selectionKeys: Set<string>) {
  const nextPixels = new Map(pixels)

  selectionKeys.forEach((key) => {
    nextPixels.delete(key)
  })

  return nextPixels
}

export function copyPixelsInBounds(pixels: Map<string, string>, bounds: LayerBounds): ClipboardSelection | null {
  const clipboardPixels = new Map<string, string>()

  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const color = pixels.get(`${x},${y}`)
      if (!color) continue

      clipboardPixels.set(`${x - bounds.minX},${y - bounds.minY}`, color)
    }
  }

  if (clipboardPixels.size === 0) return null

  return {
    width: bounds.maxX - bounds.minX + 1,
    height: bounds.maxY - bounds.minY + 1,
    pixels: clipboardPixels,
    sourceBounds: { ...bounds }
  }
}

export function copyPixelsInSelectionKeys(
  pixels: Map<string, string>,
  selectionKeys: Set<string>
): ClipboardSelection | null {
  const bounds = getSelectionBoundsFromKeys(selectionKeys)
  if (!bounds) return null

  const clipboardPixels = new Map<string, string>()

  selectionKeys.forEach((key) => {
    const color = pixels.get(key)
    if (!color) return

    const [x, y] = key.split(',').map(Number)
    clipboardPixels.set(`${x - bounds.minX},${y - bounds.minY}`, color)
  })

  if (clipboardPixels.size === 0) return null

  return {
    width: bounds.maxX - bounds.minX + 1,
    height: bounds.maxY - bounds.minY + 1,
    pixels: clipboardPixels,
    sourceBounds: { ...bounds }
  }
}

export function pasteClipboardPixels(
  targetPixels: Map<string, string>,
  clipboard: ClipboardSelection,
  offsetX: number,
  offsetY: number,
  canvasSize: CanvasSize
) {
  const nextPixels = new Map(targetPixels)

  clipboard.pixels.forEach((color, key) => {
    const [relativeX, relativeY] = key.split(',').map(Number)
    const x = offsetX + relativeX
    const y = offsetY + relativeY

    if (x < 0 || y < 0 || x >= canvasSize.width || y >= canvasSize.height) return
    nextPixels.set(`${x},${y}`, color)
  })

  return nextPixels
}

export function getPastedClipboardState(
  targetPixels: Map<string, string>,
  clipboard: ClipboardSelection,
  canvasSize: CanvasSize
): PastedClipboardState {
  const pasteX = Math.max(0, Math.min(canvasSize.width - 1, clipboard.sourceBounds.minX))
  const pasteY = Math.max(0, Math.min(canvasSize.height - 1, clipboard.sourceBounds.minY))
  const nextPixels = pasteClipboardPixels(targetPixels, clipboard, pasteX, pasteY, canvasSize)
  const nextSelectionBounds = clampBoundsToCanvas(
    {
      minX: pasteX,
      minY: pasteY,
      maxX: pasteX + clipboard.width - 1,
      maxY: pasteY + clipboard.height - 1
    },
    canvasSize
  )

  return {
    nextPixels,
    nextSelectionBounds,
    nextClipboard: {
      ...clipboard,
      sourceBounds: nextSelectionBounds
    }
  }
}
