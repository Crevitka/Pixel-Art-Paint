import { motion } from 'framer-motion'
import { MousePointer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { useColorContext } from '@/features/colors'
import { useCanvasContext } from '@/features/canvas'
import { useToolContext } from '@/features/tools'
import rotateCursorUrl from '@/shared/ui/rotateCursor.svg'
import type { CanvasSize, Layer, Tool } from '@/shared/types'

type LayerBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type ClipboardSelection = {
  width: number
  height: number
  pixels: Map<string, string>
  sourceBounds: LayerBounds
}

type PendingPastedImage = {
  blob: Blob
  previewUrl: string
  width: number
  height: number
}

type TransformHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | 'rotate'

const HANDLE_SIZE = 10
const ROTATE_HANDLE_OFFSET = 24
const ROTATE_CORNER_DISTANCE = 32
const ROTATE_CORNER_INNER_DISTANCE = 12
const ROTATE_CURSOR = `url("${rotateCursorUrl}") 7 7, crosshair`
const SPACE_ACTIVATION_KEYS = (keys: string[]) => (
  keys.includes(' ') || keys.includes('Space') || keys.includes('Spacebar')
)

function isStylusEraser(event: React.PointerEvent<HTMLCanvasElement>) {
  return event.pointerType === 'pen' && (event.button === 5 || (event.buttons & 32) !== 0)
}

function getBrushOrigin(centerX: number, centerY: number, brushSize: number) {
  return {
    ox: Math.floor(centerX - (brushSize - 1) / 2),
    oy: Math.floor(centerY - (brushSize - 1) / 2),
  }
}

function hexToRgba(hex: string, alpha: number) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return `rgba(37, 99, 235, ${alpha})`

  const colorNumber = parseInt(match[1], 16)
  const r = (colorNumber >> 16) & 255
  const g = (colorNumber >> 8) & 255
  const b = colorNumber & 255

  return `rgba(${r},${g},${b},${alpha})`
}

function getPixelColor(pixels: Map<string, string>, x: number, y: number) {
  return pixels.get(`${x},${y}`) ?? '#ffffff'
}

function getVisibleLayerColorAtPoint(layers: Layer[], x: number, y: number) {
  for (const layer of layers) {
    if (!layer.visible) continue

    const color = layer.pixels.get(`${x},${y}`)
    if (color) return color
  }

  return '#ffffff'
}

function rgbaToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

function blendChannelOverWhite(channel: number, alpha: number) {
  return Math.round(channel * alpha + 255 * (1 - alpha))
}

function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  )
}

function getLayerBounds(pixels: Map<string, string>): LayerBounds | null {
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

function translateBounds(bounds: LayerBounds, dx: number, dy: number): LayerBounds {
  return {
    minX: bounds.minX + dx,
    minY: bounds.minY + dy,
    maxX: bounds.maxX + dx,
    maxY: bounds.maxY + dy
  }
}

function createBoundsFromPoints(startX: number, startY: number, endX: number, endY: number): LayerBounds {
  return {
    minX: Math.min(startX, endX),
    minY: Math.min(startY, endY),
    maxX: Math.max(startX, endX),
    maxY: Math.max(startY, endY)
  }
}

function getCursorForHandle(handle: TransformHandle) {
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize'
    case 'e':
    case 'w':
      return 'ew-resize'
    case 'nw':
    case 'se':
      return 'nwse-resize'
    case 'ne':
    case 'sw':
      return 'nesw-resize'
    case 'rotate':
      return ROTATE_CURSOR
  }
}

function getTransformUiScale(zoom = 1) {
  return Math.min(3, Math.max(1, 1 / Math.max(zoom, 0.01)))
}

function getHandleCenters(bounds: LayerBounds, pixelSize: number, zoom = 1) {
  const uiScale = getTransformUiScale(zoom)
  const rotateHandleOffset = ROTATE_HANDLE_OFFSET * uiScale
  const left = bounds.minX * pixelSize
  const top = bounds.minY * pixelSize
  const right = (bounds.maxX + 1) * pixelSize
  const bottom = (bounds.maxY + 1) * pixelSize
  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2

  return [
    { handle: 'rotate' as const, x: centerX, y: top - rotateHandleOffset },
    { handle: 'nw' as const, x: left, y: top },
    { handle: 'n' as const, x: centerX, y: top },
    { handle: 'ne' as const, x: right, y: top },
    { handle: 'e' as const, x: right, y: centerY },
    { handle: 'se' as const, x: right, y: bottom },
    { handle: 's' as const, x: centerX, y: bottom },
    { handle: 'sw' as const, x: left, y: bottom },
    { handle: 'w' as const, x: left, y: centerY }
  ]
}

function getHandleAtCanvasPoint(
  x: number,
  y: number,
  bounds: LayerBounds,
  pixelSize: number,
  zoom = 1
): TransformHandle | null {
  const handleSize = HANDLE_SIZE * getTransformUiScale(zoom)
  const handles = getHandleCenters(bounds, pixelSize, zoom)

  for (const handle of handles) {
    if (
      x >= handle.x - handleSize / 2 &&
      x <= handle.x + handleSize / 2 &&
      y >= handle.y - handleSize / 2 &&
      y <= handle.y + handleSize / 2
    ) {
      return handle.handle
    }
  }

  return null
}

function getCornerRotateHandleAtCanvasPoint(
  x: number,
  y: number,
  bounds: LayerBounds,
  pixelSize: number,
  zoom = 1
): TransformHandle | null {
  const uiScale = getTransformUiScale(zoom)
  const left = bounds.minX * pixelSize
  const top = bounds.minY * pixelSize
  const right = (bounds.maxX + 1) * pixelSize
  const bottom = (bounds.maxY + 1) * pixelSize
  const corners = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom }
  ]

  const isOutsideBounds = x < left || x > right || y < top || y > bottom
  if (!isOutsideBounds) return null

  for (const corner of corners) {
    const distance = Math.hypot(x - corner.x, y - corner.y)
    if (
      distance <= ROTATE_CORNER_DISTANCE * uiScale &&
      distance >= ROTATE_CORNER_INNER_DISTANCE * uiScale
    ) {
      return 'rotate'
    }
  }

  return null
}

function drawTransformBox(
  ctx: CanvasRenderingContext2D,
  bounds: LayerBounds,
  pixelSize: number,
  activeHandle: TransformHandle | null,
  zoom = 1
) {
  const uiScale = getTransformUiScale(zoom)
  const handleSize = HANDLE_SIZE * uiScale
  const rotateHandleOffset = ROTATE_HANDLE_OFFSET * uiScale
  const left = bounds.minX * pixelSize
  const top = bounds.minY * pixelSize
  const width = (bounds.maxX - bounds.minX + 1) * pixelSize
  const height = (bounds.maxY - bounds.minY + 1) * pixelSize

  ctx.save()
  ctx.strokeStyle = '#2563eb'
  ctx.lineWidth = Math.max(2, 2 / Math.max(zoom, 0.01))
  ctx.setLineDash([6 * uiScale, 4 * uiScale])
  ctx.strokeRect(left, top, width, height)
  ctx.setLineDash([])

  ctx.beginPath()
  ctx.moveTo(left + width / 2, top)
  ctx.lineTo(left + width / 2, top - rotateHandleOffset)
  ctx.stroke()

  getHandleCenters(bounds, pixelSize, zoom).forEach(({ handle, x, y }) => {
    if (handle === 'rotate') {
      ctx.fillStyle = activeHandle === handle ? '#1d4ed8' : '#ffffff'
      ctx.beginPath()
      ctx.arc(x, y, handleSize / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      return
    }

    ctx.fillStyle = activeHandle === handle ? '#1d4ed8' : '#ffffff'
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = Math.max(2, 2 / Math.max(zoom, 0.01))
    ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
    ctx.strokeRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
  })

  ctx.restore()
}

function drawSelectionBox(ctx: CanvasRenderingContext2D, bounds: LayerBounds, pixelSize: number, zoom = 1) {
  const uiScale = getTransformUiScale(zoom)
  const left = bounds.minX * pixelSize
  const top = bounds.minY * pixelSize
  const width = (bounds.maxX - bounds.minX + 1) * pixelSize
  const height = (bounds.maxY - bounds.minY + 1) * pixelSize

  ctx.save()
  ctx.fillStyle = 'rgba(245, 158, 11, 0.12)'
  ctx.fillRect(left, top, width, height)
  ctx.strokeStyle = '#f59e0b'
  ctx.lineWidth = Math.max(2, 2 / Math.max(zoom, 0.01))
  ctx.setLineDash([8 * uiScale, 4 * uiScale])
  ctx.strokeRect(left, top, width, height)
  ctx.restore()
}

function getBoundsSize(bounds: LayerBounds) {
  return {
    width: bounds.maxX - bounds.minX + 1,
    height: bounds.maxY - bounds.minY + 1
  }
}

function clampBoundsToCanvas(bounds: LayerBounds, canvasSize: CanvasSize): LayerBounds {
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

function getBoundsCenter(bounds: LayerBounds) {
  return {
    x: (bounds.minX + bounds.maxX + 1) / 2,
    y: (bounds.minY + bounds.maxY + 1) / 2
  }
}

function getResizedBounds(
  bounds: LayerBounds,
  handle: TransformHandle,
  x: number,
  y: number,
  canvasSize: CanvasSize,
  preserveAspectRatio = false
): LayerBounds {
  if (handle === 'rotate') {
    return bounds
  }

  if (!preserveAspectRatio) {
    let nextMinX = bounds.minX
    let nextMinY = bounds.minY
    let nextMaxX = bounds.maxX
    let nextMaxY = bounds.maxY

    if (handle.includes('w')) {
      nextMinX = Math.max(0, Math.min(x, bounds.maxX))
    }
    if (handle.includes('e')) {
      nextMaxX = Math.min(canvasSize.width - 1, Math.max(x, bounds.minX))
    }
    if (handle.includes('n')) {
      nextMinY = Math.max(0, Math.min(y, bounds.maxY))
    }
    if (handle.includes('s')) {
      nextMaxY = Math.min(canvasSize.height - 1, Math.max(y, bounds.minY))
    }

    return {
      minX: nextMinX,
      minY: nextMinY,
      maxX: nextMaxX,
      maxY: nextMaxY
    }
  }

  const sourceSize = getBoundsSize(bounds)
  const aspectRatio = sourceSize.width / sourceSize.height

  if (handle === 'e' || handle === 'w') {
    const anchorX = handle === 'e' ? bounds.minX : bounds.maxX
    const nextWidth = Math.max(1, Math.abs(x - anchorX) + 1)
    const scale = nextWidth / sourceSize.width
    const scaledWidth = Math.max(1, Math.round(sourceSize.width * scale))
    const scaledHeight = Math.max(1, Math.round(sourceSize.height * scale))
    const centerY = getBoundsCenter(bounds).y - 0.5
    const nextMinY = Math.round(centerY - (scaledHeight - 1) / 2)
    const nextMaxY = nextMinY + scaledHeight - 1

    return clampBoundsToCanvas(
      handle === 'e'
        ? {
            minX: bounds.minX,
            minY: nextMinY,
            maxX: bounds.minX + scaledWidth - 1,
            maxY: nextMaxY
          }
        : {
            minX: bounds.maxX - scaledWidth + 1,
            minY: nextMinY,
            maxX: bounds.maxX,
            maxY: nextMaxY
          },
      canvasSize
    )
  }

  if (handle === 'n' || handle === 's') {
    const anchorY = handle === 's' ? bounds.minY : bounds.maxY
    const nextHeight = Math.max(1, Math.abs(y - anchorY) + 1)
    const scale = nextHeight / sourceSize.height
    const scaledWidth = Math.max(1, Math.round(sourceSize.width * scale))
    const scaledHeight = Math.max(1, Math.round(sourceSize.height * scale))
    const centerX = getBoundsCenter(bounds).x - 0.5
    const nextMinX = Math.round(centerX - (scaledWidth - 1) / 2)
    const nextMaxX = nextMinX + scaledWidth - 1

    return clampBoundsToCanvas(
      handle === 's'
        ? {
            minX: nextMinX,
            minY: bounds.minY,
            maxX: nextMaxX,
            maxY: bounds.minY + scaledHeight - 1
          }
        : {
            minX: nextMinX,
            minY: bounds.maxY - scaledHeight + 1,
            maxX: nextMaxX,
            maxY: bounds.maxY
          },
      canvasSize
    )
  }

  let anchorX = bounds.minX
  let anchorY = bounds.minY

  if (handle === 'nw') {
    anchorX = bounds.maxX
    anchorY = bounds.maxY
  } else if (handle === 'ne') {
    anchorX = bounds.minX
    anchorY = bounds.maxY
  } else if (handle === 'sw') {
    anchorX = bounds.maxX
    anchorY = bounds.minY
  }

  const proposedWidth = Math.max(1, Math.abs(x - anchorX) + 1)
  const proposedHeight = Math.max(1, Math.abs(y - anchorY) + 1)
  const widthScale = proposedWidth / sourceSize.width
  const heightScale = proposedHeight / sourceSize.height
  const scale = Math.max(widthScale, heightScale)
  const scaledWidth = Math.max(1, Math.round(sourceSize.width * scale))
  const scaledHeight = Math.max(1, Math.round(scaledWidth / aspectRatio))

  const nextBounds =
    handle === 'se'
      ? {
          minX: bounds.minX,
          minY: bounds.minY,
          maxX: bounds.minX + scaledWidth - 1,
          maxY: bounds.minY + scaledHeight - 1
        }
      : handle === 'sw'
        ? {
            minX: bounds.maxX - scaledWidth + 1,
            minY: bounds.minY,
            maxX: bounds.maxX,
            maxY: bounds.minY + scaledHeight - 1
          }
        : handle === 'ne'
          ? {
              minX: bounds.minX,
              minY: bounds.maxY - scaledHeight + 1,
              maxX: bounds.minX + scaledWidth - 1,
              maxY: bounds.maxY
            }
          : {
              minX: bounds.maxX - scaledWidth + 1,
              minY: bounds.maxY - scaledHeight + 1,
              maxX: bounds.maxX,
              maxY: bounds.maxY
            }

  return clampBoundsToCanvas(nextBounds, canvasSize)
}

function scalePixelsToBounds(
  pixels: Map<string, string>,
  sourceBounds: LayerBounds,
  targetBounds: LayerBounds
) {
  const nextPixels = new Map<string, string>()
  const sourceWidth = sourceBounds.maxX - sourceBounds.minX + 1
  const sourceHeight = sourceBounds.maxY - sourceBounds.minY + 1
  const targetWidth = targetBounds.maxX - targetBounds.minX + 1
  const targetHeight = targetBounds.maxY - targetBounds.minY + 1

  for (let y = 0; y < targetHeight; y++) {
    const sourceOffsetY = targetHeight === 1
      ? 0
      : Math.round((y / (targetHeight - 1)) * (sourceHeight - 1))

    for (let x = 0; x < targetWidth; x++) {
      const sourceOffsetX = targetWidth === 1
        ? 0
        : Math.round((x / (targetWidth - 1)) * (sourceWidth - 1))

      const sourceX = sourceBounds.minX + sourceOffsetX
      const sourceY = sourceBounds.minY + sourceOffsetY
      const color = pixels.get(`${sourceX},${sourceY}`)

      if (!color) continue

      nextPixels.set(`${targetBounds.minX + x},${targetBounds.minY + y}`, color)
    }
  }

  return nextPixels
}

function rotatePixels(
  pixels: Map<string, string>,
  bounds: LayerBounds,
  angleDegrees: number,
  canvasSize: CanvasSize
) {
  const nextPixels = new Map<string, string>()
  const angleRadians = (angleDegrees * Math.PI) / 180
  const cos = Math.cos(angleRadians)
  const sin = Math.sin(angleRadians)
  const center = getBoundsCenter(bounds)
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX + 1, y: bounds.minY },
    { x: bounds.maxX + 1, y: bounds.maxY + 1 },
    { x: bounds.minX, y: bounds.maxY + 1 }
  ].map((point) => {
    const dx = point.x - center.x
    const dy = point.y - center.y

    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos
    }
  })

  const minX = Math.floor(Math.min(...corners.map((corner) => corner.x)))
  const minY = Math.floor(Math.min(...corners.map((corner) => corner.y)))
  const maxX = Math.ceil(Math.max(...corners.map((corner) => corner.x))) - 1
  const maxY = Math.ceil(Math.max(...corners.map((corner) => corner.y))) - 1

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (x < 0 || y < 0 || x >= canvasSize.width || y >= canvasSize.height) continue

      const targetCenterX = x + 0.5
      const targetCenterY = y + 0.5
      const dx = targetCenterX - center.x
      const dy = targetCenterY - center.y
      const sourceCenterX = center.x + dx * cos + dy * sin
      const sourceCenterY = center.y - dx * sin + dy * cos
      const sourceX = Math.floor(sourceCenterX)
      const sourceY = Math.floor(sourceCenterY)

      if (sourceX < bounds.minX || sourceY < bounds.minY || sourceX > bounds.maxX || sourceY > bounds.maxY) {
        continue
      }

      const color = pixels.get(`${sourceX},${sourceY}`)
      if (!color) continue

      nextPixels.set(`${x},${y}`, color)
    }
  }

  return nextPixels
}

function drawEraserOutline(
  ctx: CanvasRenderingContext2D,
  pixelX: number,
  pixelY: number,
  sizeCells: number,
  cellSize: number,
  canvasPxWidth: number,
  canvasPxHeight: number
) {
  const x = pixelX * cellSize
  const y = pixelY * cellSize
  const w = sizeCells * cellSize
  const h = sizeCells * cellSize

  if (x + w <= 0 || y + h <= 0 || x >= canvasPxWidth || y >= canvasPxHeight) return

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, canvasPxWidth, canvasPxHeight)
  ctx.clip()
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.9)'
  ctx.lineWidth = 2
  ctx.setLineDash([5, 4])
  ctx.lineDashOffset = 0
  ctx.strokeRect(x, y, w, h)
  ctx.restore()
}

function drawBrushOutline(
  ctx: CanvasRenderingContext2D,
  pixelX: number,
  pixelY: number,
  sizeCells: number,
  cellSize: number,
  canvasPxWidth: number,
  canvasPxHeight: number,
  brushColor: string
) {
  const x = pixelX * cellSize
  const y = pixelY * cellSize
  const w = sizeCells * cellSize
  const h = sizeCells * cellSize

  if (x + w <= 0 || y + h <= 0 || x >= canvasPxWidth || y >= canvasPxHeight) return

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, canvasPxWidth, canvasPxHeight)
  ctx.clip()
  ctx.fillStyle = hexToRgba(brushColor, 0.18)
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)'
  ctx.lineWidth = 2
  ctx.setLineDash([5, 4])
  ctx.strokeRect(x, y, w, h)
  ctx.strokeStyle = brushColor
  ctx.lineWidth = 2
  ctx.lineDashOffset = 3
  ctx.strokeRect(x, y, w, h)
  ctx.restore()
}

function removePixelsInBounds(pixels: Map<string, string>, bounds: LayerBounds) {
  const nextPixels = new Map(pixels)

  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      nextPixels.delete(`${x},${y}`)
    }
  }

  return nextPixels
}

function copyPixelsInBounds(pixels: Map<string, string>, bounds: LayerBounds): ClipboardSelection | null {
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

function pasteClipboardPixels(
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

function loadImageFromBlob(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load pasted image'))
    }

    image.src = objectUrl
  })
}

function imageToPixelMap(image: HTMLImageElement, canvasSize: CanvasSize) {
  const width = Math.min(canvasSize.width, image.naturalWidth || image.width)
  const height = Math.min(canvasSize.height, image.naturalHeight || image.height)
  const renderCanvas = document.createElement('canvas')
  renderCanvas.width = width
  renderCanvas.height = height

  const ctx = renderCanvas.getContext('2d')
  if (!ctx) return new Map<string, string>()

  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0, width, height)

  const imageData = ctx.getImageData(0, 0, width, height)
  const nextPixels = new Map<string, string>()

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4
      const alphaByte = imageData.data[offset + 3]
      if (alphaByte === 0) continue

      const alpha = alphaByte / 255
      const r = blendChannelOverWhite(imageData.data[offset], alpha)
      const g = blendChannelOverWhite(imageData.data[offset + 1], alpha)
      const b = blendChannelOverWhite(imageData.data[offset + 2], alpha)

      nextPixels.set(`${x},${y}`, rgbaToHex(r, g, b))
    }
  }

  return nextPixels
}

export function CanvasWidget() {
  const {
    canvasSize,
    zoom,
    minZoom,
    layers,
    activeLayerId,
    referenceImageUrl,
    referenceOpacity,
    referenceScale,
    isReferenceVisible,
    setReferenceImageUrl,
    setMinZoom,
    setZoom,
    setIsDrawing,
    mousePosition,
    setMousePosition,
    pixels,
    setPixels,
    pushHistory,
    undo,
    addLayerWithPixels,
    translateLayer,
    canvasRef
  } = useCanvasContext()

  const { selectedTool, setSelectedTool, brushSize } = useToolContext()
  const { selectedColor, setSelectedColor, setPickerColor } = useColorContext()

  const containerRef = useRef<HTMLDivElement>(null)
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const isPointerOverCanvasRef = useRef(false)
  const strokeToolRef = useRef<Tool>('pencil')
  const activePointerIdRef = useRef<number | null>(null)
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const lastDrawPointRef = useRef<{ x: number; y: number } | null>(null)
  const freehandPixelsRef = useRef<Map<string, string> | null>(null)
  const lineDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const lineBasePixelsRef = useRef<Map<string, string> | null>(null)
  const shapeDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const shapeBasePixelsRef = useRef<Map<string, string> | null>(null)
  const minZoomCenterFrameRef = useRef<number | null>(null)
  const previousCanvasSizeRef = useRef(canvasSize)
  const previousContainerSizeRef = useRef<{ width: number; height: number } | null>(null)
  const pendingPastedImageUrlRef = useRef<string | null>(null)
  const clipboardRef = useRef<ClipboardSelection | null>(null)
  const scaleHandleRef = useRef<TransformHandle | null>(null)
  const scaleStartRef = useRef<{ bounds: LayerBounds; pixels: Map<string, string> } | null>(null)
  const rotateStartRef = useRef<{
    bounds: LayerBounds
    center: { x: number; y: number }
    pixels: Map<string, string>
    startAngle: number
  } | null>(null)
  const [stylusEraserActive, setStylusEraserActive] = useState(false)
  const [isLayerDragging, setIsLayerDragging] = useState(false)
  const [isLayerScaling, setIsLayerScaling] = useState(false)
  const [isLayerRotating, setIsLayerRotating] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [layerDragOffset, setLayerDragOffset] = useState({ x: 0, y: 0 })
  const [isMoveModifierPressed, setIsMoveModifierPressed] = useState(false)
  const [hoveredHandle, setHoveredHandle] = useState<TransformHandle | null>(null)
  const [scalePreviewPixels, setScalePreviewPixels] = useState<Map<string, string> | null>(null)
  const [scalePreviewBounds, setScalePreviewBounds] = useState<LayerBounds | null>(null)
  const [rotatePreviewPixels, setRotatePreviewPixels] = useState<Map<string, string> | null>(null)
  const [rotatePreviewBounds, setRotatePreviewBounds] = useState<LayerBounds | null>(null)
  const [rotatePreviewAngle, setRotatePreviewAngle] = useState(0)
  const [selectionBounds, setSelectionBounds] = useState<LayerBounds | null>(null)
  const [selectionPreviewBounds, setSelectionPreviewBounds] = useState<LayerBounds | null>(null)
  const [pendingPastedImage, setPendingPastedImage] = useState<PendingPastedImage | null>(null)

  const pixelDisplaySize = 16
  const canvasWidth = canvasSize.width * pixelDisplaySize
  const canvasHeight = canvasSize.height * pixelDisplaySize
  const activeLayer = layers.find((layer) => layer.id === activeLayerId)
  const activeLayerBounds = getLayerBounds(activeLayer?.pixels ?? new Map())
  const previewBounds = isLayerRotating
    ? rotatePreviewBounds
    : isLayerScaling
      ? scalePreviewBounds
      : isLayerDragging && activeLayerBounds
        ? translateBounds(activeLayerBounds, layerDragOffset.x, layerDragOffset.y)
        : activeLayerBounds
  const shouldShowTransformBox = Boolean(
    selectedTool !== 'selection' && (isMoveModifierPressed || isLayerDragging || isLayerScaling || isLayerRotating) && previewBounds
  )
  const activeSelectionBounds = isSelecting ? selectionPreviewBounds : selectionBounds

  const showEraserOutline = selectedTool === 'eraser' || stylusEraserActive
  const showBrushOutline =
    selectedTool === 'pencil' && !stylusEraserActive && !isLayerDragging && !isLayerScaling && !isLayerRotating

  const eraserOutlineKey = showEraserOutline ? `${mousePosition.x},${mousePosition.y}` : ''
  const brushOutlineKey = showBrushOutline ? `${mousePosition.x},${mousePosition.y},${selectedColor}` : ''

  const cutSelection = () => {
    if (!selectionBounds) return

    clipboardRef.current = copyPixelsInBounds(pixels, selectionBounds)

    const nextPixels = removePixelsInBounds(pixels, selectionBounds)
    if (nextPixels.size === pixels.size) return

    pushHistory()
    setPixels(nextPixels)
    setSelectionBounds(null)
    setSelectionPreviewBounds(null)
    selectionStartRef.current = null
    setIsSelecting(false)
  }

  const copySelection = () => {
    if (!selectionBounds) return
    clipboardRef.current = copyPixelsInBounds(pixels, selectionBounds)
  }

  const pasteSelection = () => {
    const clipboard = clipboardRef.current
    if (!clipboard) return

    const pasteX = Math.max(0, Math.min(canvasSize.width - 1, clipboard.sourceBounds.minX + 1))
    const pasteY = Math.max(0, Math.min(canvasSize.height - 1, clipboard.sourceBounds.minY + 1))
    const nextPixels = pasteClipboardPixels(pixels, clipboard, pasteX, pasteY, canvasSize)

    pushHistory()
    setPixels(nextPixels)

    const nextSelectionBounds = clampBoundsToCanvas(
      {
        minX: pasteX,
        minY: pasteY,
        maxX: pasteX + clipboard.width - 1,
        maxY: pasteY + clipboard.height - 1
      },
      canvasSize
    )

    setSelectionBounds(nextSelectionBounds)
    setSelectionPreviewBounds(null)
    selectionStartRef.current = null
    setIsSelecting(false)
    clipboardRef.current = {
      ...clipboard,
      sourceBounds: nextSelectionBounds
    }
  }

  const clearPendingPastedImage = () => {
    setPendingPastedImage((currentImage) => {
      if (currentImage?.previewUrl) {
        URL.revokeObjectURL(currentImage.previewUrl)
      }
      pendingPastedImageUrlRef.current = null
      return null
    })
  }

  const insertPendingImageAsReference = () => {
    if (!pendingPastedImage) return

    if (referenceImageUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(referenceImageUrl)
    }

    setReferenceImageUrl(pendingPastedImage.previewUrl)
    pendingPastedImageUrlRef.current = null

    setPendingPastedImage(null)
  }

  const insertPendingImageAsLayer = async () => {
    if (!pendingPastedImage) return

    try {
      const image = await loadImageFromBlob(pendingPastedImage.blob)
      const nextPixels = imageToPixelMap(image, canvasSize)
      addLayerWithPixels(nextPixels, 'Pasted image')
      clearPendingPastedImage()
    } catch {
      clearPendingPastedImage()
    }
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateMinZoom = () => {
      const containerWidth = Math.max(1, container.clientWidth - 40)
      const containerHeight = Math.max(1, container.clientHeight - 96)
      const fitZoomByWidth = containerWidth / (canvasSize.width * pixelDisplaySize)
      const fitZoomByHeight = containerHeight / (canvasSize.height * pixelDisplaySize)
      const fitZoom = Math.min(fitZoomByWidth, fitZoomByHeight)
      setMinZoom(Math.min(0.5, fitZoom))
    }

    updateMinZoom()
    window.addEventListener('resize', updateMinZoom)

    return () => {
      window.removeEventListener('resize', updateMinZoom)
    }
  }, [canvasSize.height, canvasSize.width, setMinZoom])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const preventGestureZoom = (event: Event) => {
      event.preventDefault()
    }

    const preventBrowserWheelZoom = (event: WheelEvent) => {
      const targetInsideCanvas = event.target instanceof Node && container.contains(event.target)
      if ((!targetInsideCanvas && !isPointerOverCanvasRef.current) || (!event.ctrlKey && !event.metaKey)) {
        return
      }

      event.preventDefault()
    }

    container.addEventListener('gesturestart', preventGestureZoom as EventListener, { passive: false })
    container.addEventListener('gesturechange', preventGestureZoom as EventListener, { passive: false })
    container.addEventListener('gestureend', preventGestureZoom as EventListener, { passive: false })
    window.addEventListener('wheel', preventBrowserWheelZoom, { passive: false, capture: true })
    window.addEventListener('wheel', handleDirectWheelZoom, { passive: false, capture: true })

    return () => {
      container.removeEventListener('gesturestart', preventGestureZoom as EventListener)
      container.removeEventListener('gesturechange', preventGestureZoom as EventListener)
      container.removeEventListener('gestureend', preventGestureZoom as EventListener)
      window.removeEventListener('wheel', preventBrowserWheelZoom, true)
      window.removeEventListener('wheel', handleDirectWheelZoom, true)
    }
  }, [minZoom])

  useEffect(() => {
    const transform = transformRef.current
    const container = containerRef.current
    if (!transform || !container) return

    const previousSize = previousCanvasSizeRef.current
    const sizeChanged =
      previousSize.width !== canvasSize.width ||
      previousSize.height !== canvasSize.height

    previousCanvasSizeRef.current = canvasSize

    if (!sizeChanged) return

    const nextScale = transform.state.scale

    requestAnimationFrame(() => {
      const centeredX = (container.clientWidth - canvasWidth * nextScale) / 2
      const centeredY = (container.clientHeight - canvasHeight * nextScale) / 2
      transform.setTransform(centeredX, centeredY, nextScale, 120)
    })
  }, [canvasHeight, canvasSize, canvasWidth])

  useEffect(() => {
    const transform = transformRef.current
    const container = containerRef.current
    if (!transform || !container) return

    previousContainerSizeRef.current = {
      width: container.clientWidth,
      height: container.clientHeight
    }

    const resizeObserver = new ResizeObserver(() => {
      const previousSize = previousContainerSizeRef.current
      const nextSize = {
        width: container.clientWidth,
        height: container.clientHeight
      }

      previousContainerSizeRef.current = nextSize

      if (!previousSize) return
      if (previousSize.width === nextSize.width && previousSize.height === nextSize.height) return

      const nextScale = transform.state.scale

      requestAnimationFrame(() => {
        const centeredX = (container.clientWidth - canvasWidth * nextScale) / 2
        const centeredY = (container.clientHeight - canvasHeight * nextScale) / 2
        transform.setTransform(centeredX, centeredY, nextScale, 120)
      })
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [canvasHeight, canvasWidth])

  useEffect(() => {
    const transform = transformRef.current
    const container = containerRef.current
    if (!transform) return
    if (!container) return

    if (zoom <= minZoom + 0.001) {
      if (minZoomCenterFrameRef.current !== null) {
        cancelAnimationFrame(minZoomCenterFrameRef.current)
      }

      minZoomCenterFrameRef.current = requestAnimationFrame(() => {
        const centeredX = (container.clientWidth - canvasWidth * minZoom) / 2
        const centeredY = (container.clientHeight - canvasHeight * minZoom) / 2
        transform.setTransform(centeredX, centeredY, minZoom, 0)
        minZoomCenterFrameRef.current = null
      })
    }

    return () => {
      if (minZoomCenterFrameRef.current !== null) {
        cancelAnimationFrame(minZoomCenterFrameRef.current)
        minZoomCenterFrameRef.current = null
      }
    }
  }, [canvasHeight, canvasWidth, minZoom, zoom])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isEditableElement(event.target)) {
        event.preventDefault()
      }

      if (event.code === 'Space' && !event.repeat) {
        if (!isEditableElement(document.activeElement)) {
          event.preventDefault()
          setIsSpacePressed(true)
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') {
        event.preventDefault()
        undo()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyC' && !isEditableElement(event.target)) {
        event.preventDefault()
        copySelection()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyX' && !isEditableElement(event.target)) {
        event.preventDefault()
        cutSelection()
        return
      }

      if (event.key === 'Escape') {
        clearPendingPastedImage()
        setSelectionBounds(null)
        setSelectionPreviewBounds(null)
        selectionStartRef.current = null
        setIsSelecting(false)
      }

      if (event.key === 'Control') {
        setIsMoveModifierPressed(true)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isEditableElement(event.target)) {
        event.preventDefault()
      }

      if (event.code === 'Space') {
        setIsSpacePressed(false)
        setIsPanning(false)
      }

      if (event.key === 'Control') {
        setIsMoveModifierPressed(false)
        setHoveredHandle(null)
      }
    }

    const handleWindowBlur = () => {
      setIsMoveModifierPressed(false)
      setHoveredHandle(null)
      setIsSpacePressed(false)
      setIsPanning(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [clearPendingPastedImage, copySelection, cutSelection, undo])

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (isEditableElement(event.target) || isEditableElement(document.activeElement)) return

      const clipboardData = event.clipboardData
      if (!clipboardData) return

      const imageItem = Array.from(clipboardData.items).find((item) => item.type.startsWith('image/'))
      if (imageItem) {
        const file = imageItem.getAsFile()
        if (!file) return

        event.preventDefault()

        const previewUrl = URL.createObjectURL(file)
        pendingPastedImageUrlRef.current = previewUrl

        setPendingPastedImage((currentImage) => {
          if (currentImage?.previewUrl) {
            URL.revokeObjectURL(currentImage.previewUrl)
          }

          return {
            blob: file,
            previewUrl,
            width: 0,
            height: 0
          }
        })

        void loadImageFromBlob(file)
          .then((image) => {
            setPendingPastedImage((currentImage) => {
              if (!currentImage || currentImage.blob !== file) return currentImage

              return {
                ...currentImage,
                width: image.naturalWidth || image.width,
                height: image.naturalHeight || image.height
              }
            })
          })
          .catch(() => {
            clearPendingPastedImage()
          })

        return
      }

      if (clipboardRef.current) {
        event.preventDefault()
        pasteSelection()
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('paste', handlePaste)
    }
  }, [pasteSelection])

  useEffect(() => {
    return () => {
      if (pendingPastedImageUrlRef.current) {
        URL.revokeObjectURL(pendingPastedImageUrlRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawGrid(ctx, canvas.width, canvas.height, pixelDisplaySize)

    layers
      .filter((layer) => layer.visible)
      .reverse()
      .forEach((layer) => {
        if (layer.id === activeLayerId && isLayerRotating && rotatePreviewPixels) {
          drawPixels(ctx, rotatePreviewPixels, pixelDisplaySize)
          return
        }

        if (layer.id === activeLayerId && isLayerScaling && scalePreviewPixels) {
          drawPixels(ctx, scalePreviewPixels, pixelDisplaySize)
          return
        }

        if (layer.id === activeLayerId && isLayerDragging) {
          drawPixelsWithOffset(ctx, layer.pixels, pixelDisplaySize, layerDragOffset.x, layerDragOffset.y)
          return
        }

        drawPixels(ctx, layer.pixels, pixelDisplaySize)
      })

    if (shouldShowTransformBox && previewBounds) {
      drawTransformBox(
        ctx,
        previewBounds,
        pixelDisplaySize,
        isLayerRotating ? 'rotate' : isLayerScaling ? scaleHandleRef.current : hoveredHandle,
        zoom
      )
    }

    if (activeSelectionBounds) {
      drawSelectionBox(ctx, activeSelectionBounds, pixelDisplaySize, zoom)
    }

    if (showEraserOutline) {
      const { ox, oy } = getBrushOrigin(mousePosition.x, mousePosition.y, brushSize)
      drawEraserOutline(ctx, ox, oy, brushSize, pixelDisplaySize, canvas.width, canvas.height)
    } else if (showBrushOutline) {
      const { ox, oy } = getBrushOrigin(mousePosition.x, mousePosition.y, brushSize)
      drawBrushOutline(ctx, ox, oy, brushSize, pixelDisplaySize, canvas.width, canvas.height, selectedColor)
    }
  }, [
    activeLayerId,
    brushOutlineKey,
    brushSize,
    canvasRef,
    hoveredHandle,
    isLayerDragging,
    isLayerRotating,
    isLayerScaling,
    layerDragOffset.x,
    layerDragOffset.y,
    layers,
    mousePosition.x,
    mousePosition.y,
    previewBounds,
    activeSelectionBounds,
    rotatePreviewPixels,
    scalePreviewPixels,
    selectedColor,
    shouldShowTransformBox,
    showBrushOutline,
    showEraserOutline,
    eraserOutlineKey,
    zoom
  ])

  useEffect(() => {
    const previewCanvas = previewCanvasRef.current
    if (!previewCanvas) return

    const ctx = previewCanvas.getContext('2d')
    if (!ctx) return

    const previewSize = 96
    previewCanvas.width = previewSize
    previewCanvas.height = previewSize

    ctx.clearRect(0, 0, previewSize, previewSize)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, previewSize, previewSize)

    const scale = Math.min(previewSize / canvasSize.width, previewSize / canvasSize.height)
    const offsetX = (previewSize - canvasSize.width * scale) / 2
    const offsetY = (previewSize - canvasSize.height * scale) / 2

    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.strokeRect(offsetX, offsetY, canvasSize.width * scale, canvasSize.height * scale)

    layers
      .filter((layer) => layer.visible)
      .slice()
      .reverse()
      .forEach((layer) => {
        layer.pixels.forEach((color, key) => {
          const [x, y] = key.split(',').map(Number)
          ctx.fillStyle = color
          ctx.fillRect(offsetX + x * scale, offsetY + y * scale, Math.max(scale, 1), Math.max(scale, 1))
        })
      })
  }, [canvasSize.height, canvasSize.width, layers])

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, pixelSize: number) => {
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1

    for (let x = 0; x <= width; x += pixelSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    for (let y = 0; y <= height; y += pixelSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
  }

  const drawPixels = (ctx: CanvasRenderingContext2D, pixelsMap: Map<string, string>, pixelSize: number) => {
    pixelsMap.forEach((color, key) => {
      const [x, y] = key.split(',').map(Number)
      ctx.fillStyle = color
      ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize)
    })
  }

  const drawPixelsWithOffset = (
    ctx: CanvasRenderingContext2D,
    pixelsMap: Map<string, string>,
    pixelSize: number,
    dx: number,
    dy: number
  ) => {
    pixelsMap.forEach((color, key) => {
      const [x, y] = key.split(',').map(Number)
      const nextX = x + dx
      const nextY = y + dy

      if (nextX < 0 || nextY < 0 || nextX >= canvasSize.width || nextY >= canvasSize.height) return

      ctx.fillStyle = color
      ctx.fillRect(nextX * pixelSize, nextY * pixelSize, pixelSize, pixelSize)
    })
  }

  const resetLayerTransform = () => {
    dragStartRef.current = null
    dragOffsetRef.current = { x: 0, y: 0 }
    scaleHandleRef.current = null
    scaleStartRef.current = null
    rotateStartRef.current = null
    setLayerDragOffset({ x: 0, y: 0 })
    setScalePreviewPixels(null)
    setScalePreviewBounds(null)
    setRotatePreviewPixels(null)
    setRotatePreviewBounds(null)
    setRotatePreviewAngle(0)
    setIsLayerDragging(false)
    setIsLayerScaling(false)
    setIsLayerRotating(false)
  }

  const resetSelectionDrag = () => {
    selectionStartRef.current = null
    setSelectionPreviewBounds(null)
    setIsSelecting(false)
  }

  const resetLineDrag = () => {
    lineDragStartRef.current = null
    lineBasePixelsRef.current = null
  }

  const resetFreehandStroke = () => {
    freehandPixelsRef.current = null
  }

  const resetShapeDrag = () => {
    shapeDragStartRef.current = null
    shapeBasePixelsRef.current = null
  }

  const resetPan = () => {
    setIsPanning(false)
  }

  const endStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return

    activePointerIdRef.current = null

    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }

    setIsDrawing(false)

    if (event.pointerType === 'pen') {
      setStylusEraserActive(false)
    }

    if (isSelecting && selectionPreviewBounds) {
      setSelectionBounds(selectionPreviewBounds)
      resetSelectionDrag()
      return
    }

    if (isLayerDragging && activeLayerId) {
      const { x, y } = dragOffsetRef.current
      translateLayer(activeLayerId, x, y)
      resetLayerTransform()
      return
    }

    if (isLayerRotating && rotatePreviewPixels) {
      setPixels(rotatePreviewPixels)
      resetLayerTransform()
      return
    }

    if (isLayerScaling && scalePreviewPixels) {
      setPixels(scalePreviewPixels)
      resetLayerTransform()
      return
    }

    if (strokeToolRef.current === 'pencil' || strokeToolRef.current === 'eraser') {
      lastDrawPointRef.current = { ...mousePosition }
    }
    resetFreehandStroke()
    resetLineDrag()
    resetShapeDrag()
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'pen') {
      event.stopPropagation()
    }

    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.pointerType === 'pen' && event.button !== 0 && event.button !== 5) return

    if (isSpacePressed) {
      return
    }

    strokeToolRef.current = isStylusEraser(event) ? 'eraser' : selectedTool
    activePointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)

    const coords = getPixelCoordinates(event)
    const canvasPoint = getCanvasCoordinates(event)
    setMousePosition(coords)

    if (selectedTool === 'selection') {
      const clampedCoords = clampPointToCanvas(coords.x, coords.y)
      selectionStartRef.current = clampedCoords
      const nextSelectionBounds = createBoundsFromPoints(clampedCoords.x, clampedCoords.y, clampedCoords.x, clampedCoords.y)
      setSelectionPreviewBounds(nextSelectionBounds)
      setSelectionBounds(nextSelectionBounds)
      setIsSelecting(true)
      setIsDrawing(false)
      return
    }

    if (selectedTool === 'eyedropper') {
      const clampedCoords = clampPointToCanvas(coords.x, coords.y)
      const pickedColor = getVisibleLayerColorAtPoint(layers, clampedCoords.x, clampedCoords.y)
      setSelectedColor(pickedColor)
      setPickerColor(pickedColor)
      setSelectedTool('pencil')
      setIsDrawing(false)
      return
    }

    if (event.ctrlKey && activeLayer && activeLayerBounds) {
      pushHistory()
      const handle =
        getHandleAtCanvasPoint(canvasPoint.x, canvasPoint.y, activeLayerBounds, pixelDisplaySize, zoom) ??
        getCornerRotateHandleAtCanvasPoint(canvasPoint.x, canvasPoint.y, activeLayerBounds, pixelDisplaySize, zoom)

      if (handle) {
        if (handle === 'rotate') {
          const center = getBoundsCenter(activeLayerBounds)
          const pointerX = canvasPoint.x / pixelDisplaySize
          const pointerY = canvasPoint.y / pixelDisplaySize

          rotateStartRef.current = {
            bounds: activeLayerBounds,
            center,
            pixels: new Map(activeLayer.pixels),
            startAngle: Math.atan2(pointerY - center.y, pointerX - center.x)
          }
          setRotatePreviewPixels(new Map(activeLayer.pixels))
          setRotatePreviewBounds(activeLayerBounds)
          setRotatePreviewAngle(0)
          setIsLayerRotating(true)
          setIsDrawing(false)
          return
        }

        scaleHandleRef.current = handle
        scaleStartRef.current = {
          bounds: activeLayerBounds,
          pixels: new Map(activeLayer.pixels)
        }
        setScalePreviewBounds(activeLayerBounds)
        setScalePreviewPixels(new Map(activeLayer.pixels))
        setIsLayerScaling(true)
        setIsDrawing(false)
        return
      }

      dragStartRef.current = coords
      dragOffsetRef.current = { x: 0, y: 0 }
      setLayerDragOffset({ x: 0, y: 0 })
      setIsLayerDragging(true)
      setIsDrawing(false)
      return
    }

    pushHistory()
    setIsDrawing(true)
    if (strokeToolRef.current === 'rectangle' || strokeToolRef.current === 'ellipse') {
      shapeDragStartRef.current = coords
      shapeBasePixelsRef.current = new Map(pixels)
      drawShape(coords, coords, strokeToolRef.current, brushSize, shapeBasePixelsRef.current)
    } else if (
      event.shiftKey &&
      (strokeToolRef.current === 'pencil' || strokeToolRef.current === 'eraser')
    ) {
      const lineStartPoint = lastDrawPointRef.current ?? coords
      lineDragStartRef.current = lineStartPoint
      lineBasePixelsRef.current = new Map(pixels)
      drawStraightLine(lineStartPoint, coords, strokeToolRef.current, brushSize, lineBasePixelsRef.current)
    } else {
      if (strokeToolRef.current === 'pencil' || strokeToolRef.current === 'eraser') {
        const nextPixels = new Map(pixels)
        const { ox, oy } = getBrushOrigin(coords.x, coords.y, brushSize)
        applyBrushToPixels(nextPixels, ox, oy, strokeToolRef.current, brushSize)
        freehandPixelsRef.current = nextPixels
        setPixels(nextPixels)
      } else {
        drawPixel(coords.x, coords.y, strokeToolRef.current, brushSize)
      }
    }

    if (strokeToolRef.current === 'pencil' || strokeToolRef.current === 'eraser') {
      lastDrawPointRef.current = { ...coords }
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'pen') {
      event.stopPropagation()
    }

    const coords = getPixelCoordinates(event)
    const canvasPoint = getCanvasCoordinates(event)
    setMousePosition(coords)

    const stylusEraser = isStylusEraser(event)
    setStylusEraserActive(stylusEraser)

    if (activePointerIdRef.current === null && selectedTool !== 'selection' && isMoveModifierPressed && activeLayerBounds) {
      setHoveredHandle(
        getHandleAtCanvasPoint(canvasPoint.x, canvasPoint.y, activeLayerBounds, pixelDisplaySize, zoom) ??
        getCornerRotateHandleAtCanvasPoint(canvasPoint.x, canvasPoint.y, activeLayerBounds, pixelDisplaySize, zoom)
      )
    } else if (!isMoveModifierPressed && !isLayerScaling && !isLayerRotating) {
      setHoveredHandle(null)
    }

    if (activePointerIdRef.current !== event.pointerId) return

    if (isSelecting && selectionStartRef.current) {
      const clampedCoords = clampPointToCanvas(coords.x, coords.y)
      setSelectionPreviewBounds(
        createBoundsFromPoints(
          selectionStartRef.current.x,
          selectionStartRef.current.y,
          clampedCoords.x,
          clampedCoords.y
        )
      )
      return
    }

    if (
      shapeDragStartRef.current &&
      shapeBasePixelsRef.current &&
      (strokeToolRef.current === 'rectangle' || strokeToolRef.current === 'ellipse')
    ) {
      drawShape(
        shapeDragStartRef.current,
        coords,
        strokeToolRef.current,
        brushSize,
        shapeBasePixelsRef.current
      )
      return
    }

    if (
      lineDragStartRef.current &&
      lineBasePixelsRef.current &&
      (strokeToolRef.current === 'pencil' || strokeToolRef.current === 'eraser')
    ) {
      drawStraightLine(
        lineDragStartRef.current,
        coords,
        strokeToolRef.current,
        brushSize,
        lineBasePixelsRef.current
      )
      return
    }

    if (isLayerRotating && rotateStartRef.current) {
      const pointerX = canvasPoint.x / pixelDisplaySize
      const pointerY = canvasPoint.y / pixelDisplaySize
      const nextAngle =
        Math.atan2(pointerY - rotateStartRef.current.center.y, pointerX - rotateStartRef.current.center.x) -
        rotateStartRef.current.startAngle
      const nextAngleDegrees = Number(((nextAngle * 180) / Math.PI).toFixed(1))
      const nextPixels = rotatePixels(
        rotateStartRef.current.pixels,
        rotateStartRef.current.bounds,
        nextAngleDegrees,
        canvasSize
      )

      setRotatePreviewAngle(nextAngleDegrees)
      setRotatePreviewPixels(nextPixels)
      setRotatePreviewBounds(getLayerBounds(nextPixels))
      return
    }

    if (isLayerScaling && scaleHandleRef.current && scaleStartRef.current) {
      const nextBounds = getResizedBounds(
        scaleStartRef.current.bounds,
        scaleHandleRef.current,
        coords.x,
        coords.y,
        canvasSize,
        event.shiftKey
      )

      setScalePreviewBounds(nextBounds)
      setScalePreviewPixels(
        scalePixelsToBounds(scaleStartRef.current.pixels, scaleStartRef.current.bounds, nextBounds)
      )
      return
    }

    if (dragStartRef.current) {
      const nextOffset = {
        x: coords.x - dragStartRef.current.x,
        y: coords.y - dragStartRef.current.y
      }

      if (nextOffset.x !== dragOffsetRef.current.x || nextOffset.y !== dragOffsetRef.current.y) {
        dragOffsetRef.current = nextOffset
        setLayerDragOffset(nextOffset)
      }

      return
    }

    if (strokeToolRef.current === 'pencil' || strokeToolRef.current === 'eraser') {
      const coalescedEvents = event.nativeEvent.getCoalescedEvents?.() ?? []
      const coalescedPoints = coalescedEvents
        .map((coalescedEvent) => getPixelCoordinatesFromClientPoint(coalescedEvent.clientX, coalescedEvent.clientY))
        .filter((point, index, points) => {
          if (index === 0) return true
          const previousPoint = points[index - 1]
          return point.x !== previousPoint.x || point.y !== previousPoint.y
        })

      const points = coalescedPoints.length > 0 ? coalescedPoints : [coords]
      let lastPoint = lastDrawPointRef.current
      const nextPixels = freehandPixelsRef.current ? new Map(freehandPixelsRef.current) : new Map(pixels)

      for (const point of points) {
        if (lastPoint) {
          applyStraightLineToPixels(nextPixels, lastPoint, point, strokeToolRef.current, brushSize)
        } else {
          const { ox, oy } = getBrushOrigin(point.x, point.y, brushSize)
          applyBrushToPixels(nextPixels, ox, oy, strokeToolRef.current, brushSize)
        }

        lastPoint = point
      }

      freehandPixelsRef.current = nextPixels
      setPixels(nextPixels)
      lastDrawPointRef.current = lastPoint ?? coords
      return
    }

    drawPixel(coords.x, coords.y, strokeToolRef.current, brushSize)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'pen') {
      event.stopPropagation()
    }

    endStroke(event)
  }

  const handlePointerCancel = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'pen') {
      event.stopPropagation()
    }

    endStroke(event)
  }

  const handleLostPointerCapture = () => {
    activePointerIdRef.current = null
    resetLayerTransform()
    resetSelectionDrag()
    resetLineDrag()
    resetFreehandStroke()
    resetShapeDrag()
    resetPan()
    setIsDrawing(false)
    setStylusEraserActive(false)
  }

  const handlePointerLeave = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'pen') {
      setStylusEraserActive(false)
    }

    if (!isLayerScaling && !isLayerRotating) {
      setHoveredHandle(null)
    }
  }

  const getCanvasCoordinates = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height

    return { x, y }
  }

  const getPixelCoordinates = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvasPoint = getCanvasCoordinates(event)

    return {
      x: Math.floor(canvasPoint.x / pixelDisplaySize),
      y: Math.floor(canvasPoint.y / pixelDisplaySize)
    }
  }

  const getPixelCoordinatesFromClientPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * canvas.width
    const y = ((clientY - rect.top) / rect.height) * canvas.height

    return {
      x: Math.floor(x / pixelDisplaySize),
      y: Math.floor(y / pixelDisplaySize)
    }
  }

  const clampPointToCanvas = (x: number, y: number) => {
    return {
      x: Math.max(0, Math.min(canvasSize.width - 1, x)),
      y: Math.max(0, Math.min(canvasSize.height - 1, y))
    }
  }

  const drawPixel = (
    centerX: number,
    centerY: number,
    tool: Tool,
    strokeBrushSize: number
  ) => {
    if (tool === 'fill') {
      if (
        centerX < 0 ||
        centerX >= canvasSize.width ||
        centerY < 0 ||
        centerY >= canvasSize.height
      ) {
        return
      }

      floodFill(centerX, centerY, selectedColor)
      return
    }

    if (tool === 'rectangle' || tool === 'ellipse') {
      drawShape(
        { x: centerX, y: centerY },
        { x: centerX, y: centerY },
        tool,
        strokeBrushSize
      )
      return
    }

    const { ox, oy } = getBrushOrigin(centerX, centerY, strokeBrushSize)
    const nextPixels = new Map(pixels)

    applyBrushToPixels(nextPixels, ox, oy, tool, strokeBrushSize)

    setPixels(nextPixels)
  }

  const applyBrushToPixels = (
    pixelsMap: Map<string, string>,
    originX: number,
    originY: number,
    tool: Tool,
    strokeBrushSize: number
  ) => {
    if (tool === 'fill' || tool === 'selection' || tool === 'rectangle' || tool === 'ellipse') return

    for (let dx = 0; dx < strokeBrushSize; dx++) {
      for (let dy = 0; dy < strokeBrushSize; dy++) {
        const px = originX + dx
        const py = originY + dy
        const key = `${px},${py}`

        if (px < canvasSize.width && py < canvasSize.height && px >= 0 && py >= 0) {
          if (tool === 'eraser') {
            pixelsMap.delete(key)
          } else {
            pixelsMap.set(key, selectedColor)
          }
        }
      }
    }
  }

  const drawStraightLine = (
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
    tool: Tool,
    strokeBrushSize: number,
    basePixels = pixels
  ) => {
    if (tool === 'fill' || tool === 'selection' || tool === 'rectangle' || tool === 'ellipse') return

    const nextPixels = new Map(basePixels)
    let x0 = startPoint.x
    let y0 = startPoint.y
    const x1 = endPoint.x
    const y1 = endPoint.y
    const dx = Math.abs(x1 - x0)
    const dy = Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let error = dx - dy

    while (true) {
      const { ox, oy } = getBrushOrigin(x0, y0, strokeBrushSize)
      applyBrushToPixels(nextPixels, ox, oy, tool, strokeBrushSize)

      if (x0 === x1 && y0 === y1) break

      const error2 = error * 2
      if (error2 > -dy) {
        error -= dy
        x0 += sx
      }
      if (error2 < dx) {
        error += dx
        y0 += sy
      }
    }

    setPixels(nextPixels)
  }

  const applyStraightLineToPixels = (
    pixelsMap: Map<string, string>,
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
    tool: Tool,
    strokeBrushSize: number
  ) => {
    if (tool === 'fill' || tool === 'selection' || tool === 'rectangle' || tool === 'ellipse') return

    let x0 = startPoint.x
    let y0 = startPoint.y
    const x1 = endPoint.x
    const y1 = endPoint.y
    const dx = Math.abs(x1 - x0)
    const dy = Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let error = dx - dy

    while (true) {
      const { ox, oy } = getBrushOrigin(x0, y0, strokeBrushSize)
      applyBrushToPixels(pixelsMap, ox, oy, tool, strokeBrushSize)

      if (x0 === x1 && y0 === y1) break

      const error2 = error * 2
      if (error2 > -dy) {
        error -= dy
        x0 += sx
      }
      if (error2 < dx) {
        error += dx
        y0 += sy
      }
    }
  }

  const floodFill = (startX: number, startY: number, fillColor: string) => {
    const targetColor = getPixelColor(pixels, startX, startY)
    if (targetColor === fillColor) return

    const stack: [number, number][] = [[startX, startY]]
    const nextPixels = new Map(pixels)

    while (stack.length > 0) {
      const [x, y] = stack.pop()!
      const key = `${x},${y}`

      if (x < 0 || x >= canvasSize.width || y < 0 || y >= canvasSize.height) continue
      if (getPixelColor(nextPixels, x, y) !== targetColor) continue

      if (fillColor === '#ffffff') {
        nextPixels.delete(key)
      } else {
        nextPixels.set(key, fillColor)
      }

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
    }

    setPixels(nextPixels)
  }

  const drawRectangle = (
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
    strokeBrushSize: number,
    basePixels = pixels
  ) => {
    const nextPixels = new Map(basePixels)
    const bounds = createBoundsFromPoints(startPoint.x, startPoint.y, endPoint.x, endPoint.y)

    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const topOrigin = getBrushOrigin(x, bounds.minY, strokeBrushSize)
      const bottomOrigin = getBrushOrigin(x, bounds.maxY, strokeBrushSize)
      applyBrushToPixels(nextPixels, topOrigin.ox, topOrigin.oy, 'pencil', strokeBrushSize)
      applyBrushToPixels(nextPixels, bottomOrigin.ox, bottomOrigin.oy, 'pencil', strokeBrushSize)
    }

    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      const leftOrigin = getBrushOrigin(bounds.minX, y, strokeBrushSize)
      const rightOrigin = getBrushOrigin(bounds.maxX, y, strokeBrushSize)
      applyBrushToPixels(nextPixels, leftOrigin.ox, leftOrigin.oy, 'pencil', strokeBrushSize)
      applyBrushToPixels(nextPixels, rightOrigin.ox, rightOrigin.oy, 'pencil', strokeBrushSize)
    }

    setPixels(nextPixels)
  }

  const drawEllipse = (
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
    strokeBrushSize: number,
    basePixels = pixels
  ) => {
    const nextPixels = new Map(basePixels)
    const bounds = createBoundsFromPoints(startPoint.x, startPoint.y, endPoint.x, endPoint.y)
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    const radiusX = Math.max((bounds.maxX - bounds.minX) / 2, 0)
    const radiusY = Math.max((bounds.maxY - bounds.minY) / 2, 0)

    if (radiusX === 0 && radiusY === 0) {
      const origin = getBrushOrigin(bounds.minX, bounds.minY, strokeBrushSize)
      applyBrushToPixels(nextPixels, origin.ox, origin.oy, 'pencil', strokeBrushSize)
      setPixels(nextPixels)
      return
    }

    const points = new Set<string>()
    const steps = Math.max(24, Math.ceil(2 * Math.PI * Math.max(radiusX, radiusY, 1) * 2))

    for (let step = 0; step <= steps; step++) {
      const angle = (step / steps) * Math.PI * 2
      const x = Math.round(centerX + radiusX * Math.cos(angle))
      const y = Math.round(centerY + radiusY * Math.sin(angle))
      points.add(`${x},${y}`)
    }

    points.forEach((point) => {
      const [x, y] = point.split(',').map(Number)
      const origin = getBrushOrigin(x, y, strokeBrushSize)
      applyBrushToPixels(nextPixels, origin.ox, origin.oy, 'pencil', strokeBrushSize)
    })

    setPixels(nextPixels)
  }

  const drawShape = (
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
    tool: Tool,
    strokeBrushSize: number,
    basePixels = pixels
  ) => {
    if (tool === 'rectangle') {
      drawRectangle(startPoint, endPoint, strokeBrushSize, basePixels)
      return
    }

    if (tool === 'ellipse') {
      drawEllipse(startPoint, endPoint, strokeBrushSize, basePixels)
    }
  }

  const handleZoomSliderChange = (nextZoom: number) => {
    const clampedZoom = Math.min(4, Math.max(minZoom, nextZoom))
    const transform = transformRef.current

    if (transform) {
      transform.setTransform(transform.state.positionX, transform.state.positionY, clampedZoom, 0)
    }

    setZoom(clampedZoom)
  }

  const zoomCanvasAtClientPoint = (clientX: number, clientY: number, nextZoom: number) => {
    const container = containerRef.current
    const transform = transformRef.current
    if (!container || !transform) return

    const rect = container.getBoundingClientRect()
    const pointerX = clientX - rect.left
    const pointerY = clientY - rect.top
    const currentScale = transform.state.scale
    const currentPositionX = transform.state.positionX
    const currentPositionY = transform.state.positionY

    if (Math.abs(nextZoom - currentScale) < 0.0001) return

    const contentX = (pointerX - currentPositionX) / currentScale
    const contentY = (pointerY - currentPositionY) / currentScale
    const nextPositionX = pointerX - contentX * nextZoom
    const nextPositionY = pointerY - contentY * nextZoom

    transform.setTransform(nextPositionX, nextPositionY, nextZoom, 0)
    setZoom(nextZoom)
  }

  const handleDirectWheelZoom = (event: WheelEvent) => {
    const container = containerRef.current
    const transform = transformRef.current
    if (!container || !transform) return

    const targetInsideCanvas = event.target instanceof Node && container.contains(event.target)
    if (!targetInsideCanvas && !isPointerOverCanvasRef.current) return
    if (event.ctrlKey || event.metaKey) return

    const looksLikeWheelDevice = event.deltaMode !== 0 || Math.abs(event.deltaY) >= 40
    if (!looksLikeWheelDevice) return

    event.preventDefault()

    const normalizedDelta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
    const zoomFactor = Math.exp(-normalizedDelta * 0.0018)
    const nextZoom = Math.min(4, Math.max(minZoom, transform.state.scale * zoomFactor))

    zoomCanvasAtClientPoint(event.clientX, event.clientY, nextZoom)
  }

  const cursorValue =
    selectedTool === 'selection'
      ? 'crosshair'
      : isPanning
        ? 'grabbing'
        : isSpacePressed
          ? 'grab'
          : isLayerRotating
            ? ROTATE_CURSOR
            : isLayerScaling && scaleHandleRef.current
              ? getCursorForHandle(scaleHandleRef.current)
              : isLayerDragging
                ? 'grabbing'
                : hoveredHandle && isMoveModifierPressed
                  ? getCursorForHandle(hoveredHandle)
                  : isMoveModifierPressed && activeLayerBounds
                    ? 'grab'
                    : 'crosshair'

  return (
    <motion.div
      className="glass-effect relative rounded-2xl p-5 flex h-full flex-col min-w-0 min-h-0"
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div
        ref={containerRef}
        className={`flex-1 min-w-0 min-h-0 overflow-hidden ${isPanning ? 'select-none' : ''}`}
        onPointerEnter={() => {
          isPointerOverCanvasRef.current = true
        }}
        onPointerLeave={() => {
          isPointerOverCanvasRef.current = false
        }}
        style={{
          userSelect: isPanning ? 'none' : undefined
        }}
      >
        <TransformWrapper
          key={`${canvasSize.width}x${canvasSize.height}`}
          initialScale={zoom}
          minScale={minZoom}
          maxScale={4}
          limitToBounds
          centerOnInit
          centerZoomedOut
          smooth={false}
          pinch={{ step: 1.5 }}
          wheel={{
            step: 0.075,
            activationKeys: ['Control'],
            excluded: []
          }}
          panning={{
            disabled: !isSpacePressed,
            velocityDisabled: true,
            allowLeftClickPan: true,
            allowMiddleClickPan: false,
            allowRightClickPan: false,
            activationKeys: SPACE_ACTIVATION_KEYS,
            excluded: []
          }}
          trackPadPanning={{
            disabled: false,
            velocityDisabled: true,
            activationKeys: [],
            lockAxisX: false,
            lockAxisY: false,
            excluded: []
          }}
          doubleClick={{ disabled: true }}
          onInit={(ref) => {
            transformRef.current = ref
          }}
          onTransform={(_ref, state) => {
            setZoom(state.scale)
          }}
          onPanningStart={() => {
            if (isSpacePressed) {
              setIsPanning(true)
            }
          }}
          onPanningStop={() => {
            setIsPanning(false)
          }}
        >
          <TransformComponent
            wrapperStyle={{
              width: '100%',
              height: '100%'
            }}
            contentStyle={{
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`
            }}
          >
            <div
              className="relative"
              style={{
                width: `${canvasWidth}px`,
                height: `${canvasHeight}px`
              }}
            >
              {referenceImageUrl && isReferenceVisible ? (
                <img
                  src={referenceImageUrl}
                  alt="Reference"
                  className="pointer-events-none absolute inset-0 z-10 rounded-lg object-contain"
                  style={{
                    opacity: referenceOpacity,
                    width: `${canvasWidth}px`,
                    height: `${canvasHeight}px`,
                    transform: `scale(${referenceScale})`,
                    transformOrigin: 'center center'
                  }}
                />
              ) : null}
              <motion.canvas
                ref={canvasRef as React.RefObject<HTMLCanvasElement>}
                width={canvasWidth}
                height={canvasHeight}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onLostPointerCapture={handleLostPointerCapture}
                onPointerLeave={handlePointerLeave}
                className="touch-none relative z-0 border-2 border-gray-200 rounded-lg bg-white shadow-lg max-w-none h-auto shrink-0"
                style={{
                  cursor: cursorValue,
                  width: `${canvasWidth}px`,
                  height: `${canvasHeight}px`
                }}
              />
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>
      {pendingPastedImage ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-slate-950/35 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Вставить изображение</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Выберите, как добавить изображение из буфера обмена.
                </p>
              </div>
              <button
                type="button"
                onClick={clearPendingPastedImage}
                className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Отмена
              </button>
            </div>

            <div className="mt-4 flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <img
                src={pendingPastedImage.previewUrl}
                alt="Предпросмотр вставленного изображения"
                className="h-20 w-20 rounded-lg border border-slate-200 bg-white object-contain"
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900">
                  {pendingPastedImage.width > 0 && pendingPastedImage.height > 0
                    ? `${pendingPastedImage.width}×${pendingPastedImage.height}px`
                    : 'Определяем размер...'}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Как новый слой изображение будет вставлено в левый верхний угол и обрежется по размеру холста.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  void insertPendingImageAsLayer()
                }}
                className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Вставить как слой
              </button>
              <button
                type="button"
                onClick={insertPendingImageAsReference}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Вставить как референс
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <motion.div
        className="mt-3 flex shrink-0 items-center gap-3 rounded-xl border border-gray-200 bg-white/70 px-4 py-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="shrink-0 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <canvas
            ref={previewCanvasRef}
            className="block h-16 w-16 rounded bg-white image-rendering-pixelated"
            style={{ imageRendering: 'pixelated' }}
            aria-label="Мини-превью холста"
          />
        </div>
        <div className="flex min-w-[72px] items-center gap-2 text-sm font-semibold text-gray-700">
          <MousePointer className="h-4 w-4" />
          {Math.round(zoom * 100)}%
        </div>
        <input
          type="range"
          min={minZoom}
          max="4"
          step="0.01"
          value={zoom}
          onChange={(event) => handleZoomSliderChange(Number(event.target.value))}
          className="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
          aria-label="Масштаб холста"
        />
      </motion.div>
    </motion.div>
  )
}
