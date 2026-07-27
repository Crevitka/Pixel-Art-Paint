import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronLeft, ChevronRight, Copy, Film, Layers2, MousePointer, Pause, Play, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { useColorContext } from '@/features/colors'
import { useCanvasContext } from '@/features/canvas'
import { eventMatchesHotkey, useHotkeyContext } from '@/features/hotkeys'
import { useI18nContext } from '@/features/i18n'
import { useToolContext } from '@/features/tools'
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
type RotateCorner = 'nw' | 'ne' | 'sw' | 'se'

const HANDLE_SIZE = 12
const HANDLE_HIT_SIZE = 24
const ROTATE_HANDLE_OFFSET = 24
const ROTATE_CORNER_DISTANCE = 32
const ROTATE_CORNER_INNER_DISTANCE = 12
const ROTATE_CORNER_HIT_PADDING = 16
const SPACE_ACTIVATION_KEYS = (keys: string[]) => (
  keys.includes(' ') || keys.includes('Space') || keys.includes('Spacebar')
)

const rotateCursorCache = new Map<number, string>()
type CursorIconNode = Array<
  | { tag: 'path'; attrs: { d: string } }
  | { tag: 'rect'; attrs: { width: string; height: string; x: string; y: string; rx?: string } }
  | { tag: 'circle'; attrs: { cx: string; cy: string; r: string } }
>

const PENCIL_CURSOR_ICON: CursorIconNode = [
  { tag: 'path', attrs: { d: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z' } },
  { tag: 'path', attrs: { d: 'm15 5 4 4' } }
]

const ERASER_CURSOR_ICON: CursorIconNode = [
  { tag: 'path', attrs: { d: 'm7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21' } },
  { tag: 'path', attrs: { d: 'M22 21H7' } },
  { tag: 'path', attrs: { d: 'm5 11 9 9' } }
]

const FILL_CURSOR_ICON: CursorIconNode = [
  { tag: 'path', attrs: { d: 'm19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z' } },
  { tag: 'path', attrs: { d: 'm5 2 5 5' } },
  { tag: 'path', attrs: { d: 'M2 13h15' } },
  { tag: 'path', attrs: { d: 'M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z' } }
]

const SELECTION_CURSOR_ICON: CursorIconNode = [
  { tag: 'path', attrs: { d: 'M6 2v14a2 2 0 0 0 2 2h14' } },
  { tag: 'path', attrs: { d: 'M18 22V8a2 2 0 0 0-2-2H2' } }
]

const RECTANGLE_CURSOR_ICON: CursorIconNode = [
  { tag: 'rect', attrs: { width: '18', height: '18', x: '3', y: '3', rx: '2' } }
]

const ELLIPSE_CURSOR_ICON: CursorIconNode = [
  { tag: 'circle', attrs: { cx: '12', cy: '12', r: '10' } }
]

const EYEDROPPER_CURSOR_ICON: CursorIconNode = [
  { tag: 'path', attrs: { d: 'm2 22 1-1h3l9-9' } },
  { tag: 'path', attrs: { d: 'M3 21v-3l9-9' } },
  { tag: 'path', attrs: { d: 'm15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z' } }
]

function createToolCursor(iconNode: CursorIconNode, hotspotX: number, hotspotY: number, fallback = 'crosshair') {
  const shapes = iconNode
    .map(({ tag, attrs }) => {
      const attributes = Object.entries(attrs)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ')

      return `<${tag} ${attributes} />`
    })
    .join('')

  const svg = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${shapes}
      </g>
    </svg>
  `.trim()

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY}, ${fallback}`
}

const PENCIL_CURSOR = createToolCursor(PENCIL_CURSOR_ICON, 3, 21)
const ERASER_CURSOR = createToolCursor(ERASER_CURSOR_ICON, 8, 20, 'cell')
const FILL_CURSOR = createToolCursor(FILL_CURSOR_ICON, 6, 18, 'pointer')
const SELECTION_CURSOR = createToolCursor(SELECTION_CURSOR_ICON, 8, 8, 'crosshair')
const RECTANGLE_CURSOR = createToolCursor(RECTANGLE_CURSOR_ICON, 8, 8, 'crosshair')
const ELLIPSE_CURSOR = createToolCursor(ELLIPSE_CURSOR_ICON, 8, 8, 'crosshair')
const EYEDROPPER_CURSOR = createToolCursor(EYEDROPPER_CURSOR_ICON, 3, 20, 'copy')

function getRotateCursor(angleDegrees = 0) {
  const normalizedAngle = ((Math.round(angleDegrees * 10) / 10) % 360 + 360) % 360
  const cachedCursor = rotateCursorCache.get(normalizedAngle)
  if (cachedCursor) return cachedCursor

  const svg = `
    <svg width="24" height="24" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(${normalizedAngle} 7.5 7.5)">
        <path d="M12.9586 10.7895C12.9586 9.63753 12.729 8.49686 12.283 7.4326C11.8369 6.36834 11.1831 5.40133 10.3589 4.58678C9.53475 3.77223 8.55629 3.1261 7.47944 2.68527C6.40258 2.24444 5.24842 2.01754 4.08284 2.01754V3.07018C5.10855 3.07018 6.12421 3.26984 7.07185 3.65777C8.01948 4.0457 8.88052 4.6143 9.6058 5.33111C10.3311 6.04791 10.9064 6.89888 11.2989 7.83543C11.6915 8.77197 11.8935 9.77576 11.8935 10.7895H12.9586Z" fill="black"/>
        <path d="M14.476 12.106C14.6199 12.1109 14.7558 12.171 14.8539 12.2731C14.9521 12.3751 15.0046 12.5102 14.9997 12.6496C14.9948 12.7891 14.933 12.9209 14.8279 13.0162L12.7923 14.8577C12.7089 14.9335 12.603 14.9818 12.4896 14.9958C12.3763 15.0098 12.2612 14.9887 12.1609 14.9356C12.1206 14.9142 12.0832 14.8878 12.0497 14.8572L10.0157 13.0162C9.9142 12.9202 9.85553 12.7894 9.85222 12.6519C9.84891 12.5144 9.90123 12.3812 9.99799 12.2806C10.0947 12.1801 10.2282 12.1202 10.3699 12.1139C10.5116 12.1076 10.6502 12.1553 10.7561 12.2468L11.8787 13.2625V10.7895C11.8787 10.6499 11.9359 10.516 12.0377 10.4173C12.1395 10.3186 12.2775 10.2632 12.4215 10.2632C12.5655 10.2632 12.7035 10.3186 12.8053 10.4173C12.9071 10.516 12.9643 10.6499 12.9643 10.7895V13.2625L14.0869 12.2468C14.1922 12.1517 14.3322 12.101 14.476 12.106Z" fill="black"/>
        <path d="M2.92828 4.56988C2.92329 4.71203 2.86247 4.84637 2.75918 4.94335C2.65599 5.04042 2.51929 5.09224 2.37819 5.08741C2.23709 5.08258 2.10367 5.0215 2.00725 4.9176L0.143947 2.9058C0.0672958 2.82339 0.0184122 2.71872 0.00426085 2.60669C-0.00989054 2.49466 0.0114117 2.38099 0.0651326 2.28187C0.0868446 2.24197 0.113508 2.20501 0.144479 2.17189L2.00726 0.1617C2.10446 0.0614016 2.23677 0.00341422 2.37587 0.000145976C2.51498 -0.00312194 2.64983 0.0485883 2.75156 0.144212C2.8533 0.239837 2.91385 0.371778 2.92025 0.511805C2.92665 0.651832 2.8784 0.788821 2.78581 0.893459L1.75803 2.0029L4.26037 2.0029C4.40161 2.0029 4.53706 2.05942 4.63693 2.16003C4.73679 2.26064 4.7929 2.3971 4.7929 2.53938C4.7929 2.68167 4.73679 2.81812 4.63693 2.91873C4.53706 3.01934 4.40161 3.07586 4.26037 3.07586H1.75803L2.78581 4.1853C2.88203 4.2894 2.93328 4.42773 2.92828 4.56988Z" fill="black"/>
      </g>
    </svg>
  `.trim()

  const cursor = `url("data:image/svg+xml,${encodeURIComponent(svg)}") 7 7, crosshair`
  rotateCursorCache.set(normalizedAngle, cursor)
  return cursor
}

function getRotateCornerCursorOffset(corner: RotateCorner | null) {
  switch (corner) {
    case 'se':
      return 90
    case 'sw':
      return 180
    case 'nw':
      return 270
    case 'ne':
    default:
      return 0
  }
}

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

function renderPixelPreview(
  ctx: CanvasRenderingContext2D,
  canvasSize: CanvasSize,
  layers: Layer[],
  previewSize: number
) {
  ctx.clearRect(0, 0, previewSize, previewSize)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, previewSize, previewSize)

  const scale = Math.min(previewSize / canvasSize.width, previewSize / canvasSize.height)
  const offsetX = (previewSize - canvasSize.width * scale) / 2
  const offsetY = (previewSize - canvasSize.height * scale) / 2

  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.strokeRect(offsetX, offsetY, canvasSize.width * scale, canvasSize.height * scale)

  layers.forEach((layer) => {
    layer.pixels.forEach((color, key) => {
      const [x, y] = key.split(',').map(Number)
      ctx.fillStyle = color
      ctx.fillRect(offsetX + x * scale, offsetY + y * scale, Math.max(scale, 1), Math.max(scale, 1))
    })
  })
}

type FrameThumbnailProps = {
  canvasSize: CanvasSize
  layers: Layer[]
  frameId: string
  index: number
  isActive: boolean
  isDragTarget: boolean
  onClick: () => void
  onDragStart: (frameId: string) => void
  onDragOver: (frameId: string) => void
  onDrop: (frameId: string) => void
  onDragEnd: () => void
}

function FrameThumbnail({
  canvasSize,
  layers,
  frameId,
  index,
  isActive,
  isDragTarget,
  onClick,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd
}: FrameThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const previewSize = 72
    canvas.width = previewSize
    canvas.height = previewSize

    renderPixelPreview(
      ctx,
      canvasSize,
      layers.filter((layer) => layer.visible).slice().reverse(),
      previewSize
    )
  }, [canvasSize, layers])

  return (
    <button
      type="button"
      onClick={onClick}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', frameId)
        onDragStart(frameId)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        onDragOver(frameId)
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDrop(frameId)
      }}
      onDragEnd={onDragEnd}
      className={`flex w-[92px] shrink-0 flex-col items-center gap-2 rounded-xl border p-2 transition ${
        isActive
          ? 'border-primary-500 bg-primary-50 text-primary-700'
          : 'border-gray-200 bg-white text-gray-600 hover:border-primary-300 hover:text-primary-700'
      } ${isDragTarget ? 'ring-2 ring-primary-300 ring-offset-2' : ''}`}
    >
      <canvas
        ref={canvasRef}
        className="block h-[58px] w-[58px] rounded border border-gray-200 bg-white image-rendering-pixelated"
        style={{ imageRendering: 'pixelated' }}
      />
      <span className="text-xs font-medium">{index + 1}</span>
    </button>
  )
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

function getCursorForHandle(handle: TransformHandle, rotateAngle = 0) {
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
      return getRotateCursor(rotateAngle)
  }
}

function getRotateCursorForCorner(angleDegrees = 0, corner: RotateCorner | null = null) {
  return getRotateCursor(angleDegrees + getRotateCornerCursorOffset(corner))
}

function getCursorForTool(tool: Tool) {
  switch (tool) {
    case 'pencil':
      return PENCIL_CURSOR
    case 'eraser':
      return ERASER_CURSOR
    case 'fill':
      return FILL_CURSOR
    case 'selection':
      return SELECTION_CURSOR
    case 'rectangle':
      return RECTANGLE_CURSOR
    case 'ellipse':
      return ELLIPSE_CURSOR
    case 'eyedropper':
      return EYEDROPPER_CURSOR
  }
}

function getTransformUiScale(zoom = 1) {
  return Math.min(3, Math.max(1, 1 / Math.max(zoom, 0.01)))
}

function getTransformHandleUiScale(zoom = 1) {
  return Math.min(14, Math.max(1.2, 2.4 / Math.max(zoom, 0.01)))
}

function getTransformOverlayPadding(zoom = 1) {
  const handleUiScale = getTransformHandleUiScale(zoom)
  return Math.ceil((ROTATE_HANDLE_OFFSET + HANDLE_SIZE * 1.5 + ROTATE_CORNER_HIT_PADDING) * handleUiScale)
}

function getTransformBoxMetrics(bounds: LayerBounds, pixelSize: number, zoom = 1) {
  const handleUiScale = getTransformHandleUiScale(zoom)
  const handleSize = HANDLE_SIZE * handleUiScale
  const edgeOffset = handleSize * 0.75
  const left = bounds.minX * pixelSize
  const top = bounds.minY * pixelSize
  const right = (bounds.maxX + 1) * pixelSize
  const bottom = (bounds.maxY + 1) * pixelSize

  return {
    left,
    top,
    right,
    bottom,
    outerLeft: left - edgeOffset,
    outerTop: top - edgeOffset,
    outerRight: right + edgeOffset,
    outerBottom: bottom + edgeOffset,
    edgeOffset,
    handleSize
  }
}

function getHandleCenters(bounds: LayerBounds, pixelSize: number, zoom = 1) {
  const handleUiScale = getTransformHandleUiScale(zoom)
  const rotateHandleOffset = ROTATE_HANDLE_OFFSET * handleUiScale
  const { outerLeft, outerTop, outerRight, outerBottom } = getTransformBoxMetrics(bounds, pixelSize, zoom)
  const centerX = (outerLeft + outerRight) / 2
  const centerY = (outerTop + outerBottom) / 2

  return [
    { handle: 'rotate' as const, x: centerX, y: outerTop - rotateHandleOffset },
    { handle: 'nw' as const, x: outerLeft, y: outerTop },
    { handle: 'n' as const, x: centerX, y: outerTop },
    { handle: 'ne' as const, x: outerRight, y: outerTop },
    { handle: 'e' as const, x: outerRight, y: centerY },
    { handle: 'se' as const, x: outerRight, y: outerBottom },
    { handle: 's' as const, x: centerX, y: outerBottom },
    { handle: 'sw' as const, x: outerLeft, y: outerBottom },
    { handle: 'w' as const, x: outerLeft, y: centerY }
  ]
}

function getHandleAtCanvasPoint(
  x: number,
  y: number,
  bounds: LayerBounds,
  pixelSize: number,
  zoom = 1
): TransformHandle | null {
  const handleUiScale = getTransformHandleUiScale(zoom)
  const handleSize = Math.max(HANDLE_SIZE * handleUiScale, HANDLE_HIT_SIZE * handleUiScale)
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
): RotateCorner | null {
  const handleUiScale = getTransformHandleUiScale(zoom)
  const { outerLeft: left, outerTop: top, outerRight: right, outerBottom: bottom } =
    getTransformBoxMetrics(bounds, pixelSize, zoom)
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
      distance <= (ROTATE_CORNER_DISTANCE + ROTATE_CORNER_HIT_PADDING) * handleUiScale &&
      distance >= Math.max(0, (ROTATE_CORNER_INNER_DISTANCE - ROTATE_CORNER_HIT_PADDING / 2) * handleUiScale)
    ) {
      if (corner.x === left && corner.y === top) return 'nw'
      if (corner.x === right && corner.y === top) return 'ne'
      if (corner.x === right && corner.y === bottom) return 'se'
      return 'sw'
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
  const handleUiScale = getTransformHandleUiScale(zoom)
  const { outerLeft, outerTop, outerRight, handleSize } = getTransformBoxMetrics(bounds, pixelSize, zoom)
  const rotateHandleOffset = ROTATE_HANDLE_OFFSET * handleUiScale
  const left = bounds.minX * pixelSize
  const top = bounds.minY * pixelSize
  const strokeWidth = (bounds.maxX - bounds.minX + 1) * pixelSize
  const strokeHeight = (bounds.maxY - bounds.minY + 1) * pixelSize
  const outerWidth = outerRight - outerLeft

  ctx.save()
  ctx.strokeStyle = '#2563eb'
  ctx.lineWidth = Math.max(2, 2 / Math.max(zoom, 0.01))
  ctx.setLineDash([6 * uiScale, 4 * uiScale])
  ctx.strokeRect(left, top, strokeWidth, strokeHeight)
  ctx.setLineDash([])

  ctx.beginPath()
  ctx.moveTo(left + strokeWidth / 2, top)
  ctx.lineTo(outerLeft + outerWidth / 2, outerTop - rotateHandleOffset)
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

function drawRotationAngleBadge(
  ctx: CanvasRenderingContext2D,
  bounds: LayerBounds,
  pixelSize: number,
  angleDegrees: number,
  zoom = 1
) {
  const uiScale = getTransformUiScale(zoom)
  const centerX = ((bounds.minX + bounds.maxX + 1) * pixelSize) / 2
  const top = bounds.minY * pixelSize
  const label = `${angleDegrees.toFixed(1)}°`
  const fontSize = Math.max(12, 12 / Math.max(zoom, 0.01))
  const paddingX = 8 * uiScale
  const paddingY = 5 * uiScale
  const offsetY = 20 * uiScale

  ctx.save()
  ctx.font = `600 ${fontSize}px Inter, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const metrics = ctx.measureText(label)
  const labelWidth = metrics.width + paddingX * 2
  const labelHeight = fontSize + paddingY * 2
  const preferredY = top - offsetY - labelHeight / 2
  const labelCenterY = preferredY - labelHeight / 2 < 0
    ? top + offsetY + labelHeight / 2
    : preferredY
  const labelLeft = centerX - labelWidth / 2
  const labelTop = labelCenterY - labelHeight / 2
  const radius = 8 * uiScale

  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.95)'
  ctx.lineWidth = Math.max(1.5, 1.5 / Math.max(zoom, 0.01))
  ctx.beginPath()
  ctx.roundRect(labelLeft, labelTop, labelWidth, labelHeight, radius)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#eff6ff'
  ctx.fillText(label, centerX, labelCenterY)
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

  pixels.forEach((color, key) => {
    const [sourceX, sourceY] = key.split(',').map(Number)

    if (
      sourceX < sourceBounds.minX ||
      sourceX > sourceBounds.maxX ||
      sourceY < sourceBounds.minY ||
      sourceY > sourceBounds.maxY
    ) {
      return
    }

    const sourceOffsetX = sourceX - sourceBounds.minX
    const sourceOffsetY = sourceY - sourceBounds.minY
    const targetStartX = Math.floor((sourceOffsetX / sourceWidth) * targetWidth)
    const targetEndX = Math.max(
      targetStartX,
      Math.ceil(((sourceOffsetX + 1) / sourceWidth) * targetWidth) - 1
    )
    const targetStartY = Math.floor((sourceOffsetY / sourceHeight) * targetHeight)
    const targetEndY = Math.max(
      targetStartY,
      Math.ceil(((sourceOffsetY + 1) / sourceHeight) * targetHeight) - 1
    )

    for (let targetY = targetStartY; targetY <= targetEndY; targetY++) {
      for (let targetX = targetStartX; targetX <= targetEndX; targetX++) {
        nextPixels.set(`${targetBounds.minX + targetX},${targetBounds.minY + targetY}`, color)
      }
    }
  })

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
  const rotateVertex = (sourceX: number, sourceY: number) => {
    const dx = sourceX - center.x
    const dy = sourceY - center.y

    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos
    }
  }

  const setPixel = (x: number, y: number, color: string) => {
    if (x < 0 || y < 0 || x >= canvasSize.width || y >= canvasSize.height) return
    nextPixels.set(`${x},${y}`, color)
  }

  const isPointInConvexPolygon = (
    point: { x: number; y: number },
    polygon: Array<{ x: number; y: number }>
  ) => {
    let hasPositive = false
    let hasNegative = false

    for (let index = 0; index < polygon.length; index++) {
      const current = polygon[index]
      const next = polygon[(index + 1) % polygon.length]
      const cross =
        (next.x - current.x) * (point.y - current.y) -
        (next.y - current.y) * (point.x - current.x)

      if (cross > 0.00001) hasPositive = true
      if (cross < -0.00001) hasNegative = true
      if (hasPositive && hasNegative) return false
    }

    return true
  }

  pixels.forEach((color, key) => {
    const [sourceX, sourceY] = key.split(',').map(Number)

    if (
      sourceX < bounds.minX ||
      sourceX > bounds.maxX ||
      sourceY < bounds.minY ||
      sourceY > bounds.maxY
    ) {
      return
    }

    const rotatedQuad = [
      rotateVertex(sourceX, sourceY),
      rotateVertex(sourceX + 1, sourceY),
      rotateVertex(sourceX + 1, sourceY + 1),
      rotateVertex(sourceX, sourceY + 1)
    ]
    const minX = Math.floor(Math.min(...rotatedQuad.map((point) => point.x)))
    const maxX = Math.ceil(Math.max(...rotatedQuad.map((point) => point.x))) - 1
    const minY = Math.floor(Math.min(...rotatedQuad.map((point) => point.y)))
    const maxY = Math.ceil(Math.max(...rotatedQuad.map((point) => point.y))) - 1
    let filledAnyPixel = false

    for (let targetY = minY; targetY <= maxY; targetY++) {
      for (let targetX = minX; targetX <= maxX; targetX++) {
        const targetCenter = { x: targetX + 0.5, y: targetY + 0.5 }

        if (!isPointInConvexPolygon(targetCenter, rotatedQuad)) {
          continue
        }

        setPixel(targetX, targetY, color)
        filledAnyPixel = true
      }
    }

    if (!filledAnyPixel) {
      const sourceCenter = rotateVertex(sourceX + 0.5, sourceY + 0.5)
      setPixel(Math.round(sourceCenter.x - 0.5), Math.round(sourceCenter.y - 0.5), color)
    }
  })

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

function drawEyedropperOutline(
  ctx: CanvasRenderingContext2D,
  pixelX: number,
  pixelY: number,
  cellSize: number,
  canvasPxWidth: number,
  canvasPxHeight: number
) {
  const x = pixelX * cellSize
  const y = pixelY * cellSize

  if (x + cellSize <= 0 || y + cellSize <= 0 || x >= canvasPxWidth || y >= canvasPxHeight) return

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, canvasPxWidth, canvasPxHeight)
  ctx.clip()
  ctx.fillStyle = 'rgba(14, 165, 233, 0.18)'
  ctx.fillRect(x, y, cellSize, cellSize)
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)'
  ctx.lineWidth = 2
  ctx.setLineDash([4, 3])
  ctx.strokeRect(x, y, cellSize, cellSize)
  ctx.setLineDash([])
  ctx.strokeStyle = '#0ea5e9'
  ctx.lineWidth = 2
  ctx.strokeRect(x, y, cellSize, cellSize)
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
  const { t } = useI18nContext()
  const {
    canvasSize,
    zoom,
    minZoom,
    frames,
    activeFrameId,
    setActiveFrameId,
    addFrame,
    duplicateFrame,
    removeFrame,
    reorderFrame,
    animationFps,
    setAnimationFps,
    layers,
    activeLayerId,
    referenceImageUrl,
    referenceOpacity,
    referenceScale,
    referenceOffset,
    isReferenceMoveMode,
    isReferenceVisible,
    setReferenceImageUrl,
    setReferenceOffset,
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
    flipLayerHorizontal,
    flipLayerVertical,
    canvasRef
  } = useCanvasContext()

  const { selectedTool, setSelectedTool, brushSize } = useToolContext()
  const { hotkeys } = useHotkeyContext()
  const { selectedColor, setSelectedColor, setPickerColor } = useColorContext()

  const containerRef = useRef<HTMLDivElement>(null)
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const isPointerOverCanvasRef = useRef(false)
  const strokeToolRef = useRef<Tool>('pencil')
  const activePointerIdRef = useRef<number | null>(null)
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const referenceDragStartRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const lastDrawPointRef = useRef<{ x: number; y: number } | null>(null)
  const freehandPixelsRef = useRef<Map<string, string> | null>(null)
  const lineDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const lineBasePixelsRef = useRef<Map<string, string> | null>(null)
  const shapeDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const shapeBasePixelsRef = useRef<Map<string, string> | null>(null)
  const minZoomCenterFrameRef = useRef<number | null>(null)
  const minZoomCenterTimeoutRef = useRef<number | null>(null)
  const spacePanUsedRef = useRef(false)
  const spacePressedRef = useRef(false)
  const spacePointerPanPointRef = useRef<{ x: number; y: number } | null>(null)
  const trackpadPanStopTimeoutRef = useRef<number | null>(null)
  const spaceScrollAnchorRef = useRef({ x: 0, y: 0 })
  const previousCanvasSizeRef = useRef(canvasSize)
  const previousContainerSizeRef = useRef<{ width: number; height: number } | null>(null)
  const pendingPastedImageUrlRef = useRef<string | null>(null)
  const clipboardRef = useRef<ClipboardSelection | null>(null)
  const scaleHandleRef = useRef<TransformHandle | null>(null)
  const scaleStartRef = useRef<{ bounds: LayerBounds; pixels: Map<string, string> } | null>(null)
  const activeRotateCornerRef = useRef<RotateCorner | null>(null)
  const rotateStartRef = useRef<{
    bounds: LayerBounds
    center: { x: number; y: number }
    pixels: Map<string, string>
    startAngle: number
    baseAngle: number
  } | null>(null)
  const rotationSessionCacheRef = useRef<{
    layerId: string
    sourceBounds: LayerBounds
    sourcePixels: Map<string, string>
    accumulatedAngle: number
    committedPixels: Map<string, string> | null
  } | null>(null)
  const [stylusEraserActive, setStylusEraserActive] = useState(false)
  const [isLayerDragging, setIsLayerDragging] = useState(false)
  const [isLayerScaling, setIsLayerScaling] = useState(false)
  const [isLayerRotating, setIsLayerRotating] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const isPanningRef = useRef(false)
  const [isAltEyedropperPressed, setIsAltEyedropperPressed] = useState(false)
  const [layerDragOffset, setLayerDragOffset] = useState({ x: 0, y: 0 })
  const [isMoveModifierPressed, setIsMoveModifierPressed] = useState(false)
  const [hoveredHandle, setHoveredHandle] = useState<TransformHandle | null>(null)
  const [hoveredRotateCorner, setHoveredRotateCorner] = useState<RotateCorner | null>(null)
  const [scalePreviewPixels, setScalePreviewPixels] = useState<Map<string, string> | null>(null)
  const [scalePreviewBounds, setScalePreviewBounds] = useState<LayerBounds | null>(null)
  const [rotatePreviewPixels, setRotatePreviewPixels] = useState<Map<string, string> | null>(null)
  const [rotatePreviewBounds, setRotatePreviewBounds] = useState<LayerBounds | null>(null)
  const [rotatePreviewAngle, setRotatePreviewAngle] = useState(0)
  const [selectionBounds, setSelectionBounds] = useState<LayerBounds | null>(null)
  const [selectionPreviewBounds, setSelectionPreviewBounds] = useState<LayerBounds | null>(null)
  const [pendingPastedImage, setPendingPastedImage] = useState<PendingPastedImage | null>(null)
  const [isReferenceDragging, setIsReferenceDragging] = useState(false)
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(false)
  const [animationFrameIndex, setAnimationFrameIndex] = useState(0)
  const [isOnionSkinEnabled, setIsOnionSkinEnabled] = useState(false)
  const [isAnimationPanelCollapsed, setIsAnimationPanelCollapsed] = useState(true)
  const [isPointerInsideCanvasArea, setIsPointerInsideCanvasArea] = useState(false)
  const [draggedFrameId, setDraggedFrameId] = useState<string | null>(null)
  const [dragOverFrameId, setDragOverFrameId] = useState<string | null>(null)

  const pixelDisplaySize = 16
  const canvasWidth = canvasSize.width * pixelDisplaySize
  const canvasHeight = canvasSize.height * pixelDisplaySize
  const activeLayer = layers.find((layer) => layer.id === activeLayerId)
  const activeFrameIndex = Math.max(0, frames.findIndex((frame) => frame.id === activeFrameId))
  const activeAnimationFrame = frames[animationFrameIndex] ?? frames[activeFrameIndex] ?? null
  const displayedLayers = isAnimationPlaying
    ? (activeAnimationFrame?.layers ?? [])
    : layers
  const transformOverlayPadding = getTransformOverlayPadding(zoom)
  const previousOnionFrame = !isAnimationPlaying && isOnionSkinEnabled && activeFrameIndex > 0
    ? frames[activeFrameIndex - 1]
    : null
  const nextOnionFrame = !isAnimationPlaying && isOnionSkinEnabled && activeFrameIndex < frames.length - 1
    ? frames[activeFrameIndex + 1]
    : null
  const activeLayerBounds = getLayerBounds(activeLayer?.pixels ?? new Map())
  const previewBounds = isLayerRotating
    ? rotatePreviewBounds
    : isLayerScaling
      ? scalePreviewBounds
      : isLayerDragging && activeLayerBounds
        ? translateBounds(activeLayerBounds, layerDragOffset.x, layerDragOffset.y)
        : activeLayerBounds
  const shouldShowTransformBox = Boolean(
    !isAnimationPlaying &&
    selectedTool !== 'selection' &&
    (isMoveModifierPressed || isLayerDragging || isLayerScaling || isLayerRotating) &&
    previewBounds
  )
  const activeSelectionBounds = isSelecting ? selectionPreviewBounds : selectionBounds
  const startPanning = () => {
    if (isPanningRef.current) return
    isPanningRef.current = true
    setIsPanning(true)
  }

  const stopPanning = () => {
    if (!isPanningRef.current) return
    isPanningRef.current = false
    setIsPanning(false)
  }
  const invalidateRotationSessionCache = () => {
    rotationSessionCacheRef.current = null
  }
  const isCanvasPointInside = (canvasPoint: { x: number; y: number }) =>
    canvasPoint.x >= 0 &&
    canvasPoint.y >= 0 &&
    canvasPoint.x < canvasWidth &&
    canvasPoint.y < canvasHeight

  useEffect(() => {
    const cache = rotationSessionCacheRef.current
    if (!cache) return
    if (cache.layerId !== activeLayerId) {
      invalidateRotationSessionCache()
      return
    }
    if (cache.committedPixels && cache.committedPixels !== pixels) {
      invalidateRotationSessionCache()
    }
  }, [activeLayerId, pixels])

  const isTemporaryEyedropperActive =
    isAltEyedropperPressed && selectedTool !== 'selection' && !isLayerDragging && !isLayerScaling && !isLayerRotating
  const effectiveHoverTool = isTemporaryEyedropperActive ? 'eyedropper' : selectedTool

  const showEraserOutline = isPointerInsideCanvasArea && (selectedTool === 'eraser' || stylusEraserActive)
  const showBrushOutline =
    !isAnimationPlaying &&
    isPointerInsideCanvasArea &&
    selectedTool === 'pencil' &&
    !stylusEraserActive &&
    !isLayerDragging &&
    !isLayerScaling &&
    !isLayerRotating
  const showEyedropperOutline =
    !isAnimationPlaying &&
    isPointerInsideCanvasArea &&
    effectiveHoverTool === 'eyedropper' &&
    !stylusEraserActive &&
    !isLayerDragging &&
    !isLayerScaling &&
    !isLayerRotating

  const eraserOutlineKey = showEraserOutline ? `${mousePosition.x},${mousePosition.y}` : ''
  const brushOutlineKey = showBrushOutline ? `${mousePosition.x},${mousePosition.y},${selectedColor}` : ''
  const eyedropperOutlineKey = showEyedropperOutline ? `${mousePosition.x},${mousePosition.y}` : ''

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
    setReferenceOffset({ x: 0, y: 0 })
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

  const finishReferenceDrag = () => {
    referenceDragStartRef.current = null
    setIsReferenceDragging(false)
  }

  const handleReferencePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!referenceImageUrl || !isReferenceVisible || !isReferenceMoveMode) return

    event.preventDefault()
    event.stopPropagation()

    referenceDragStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: referenceOffset.x,
      offsetY: referenceOffset.y
    }

    setIsReferenceDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleReferencePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = referenceDragStartRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    event.preventDefault()
    event.stopPropagation()

    const safeZoom = Math.max(zoom, 0.01)
    setReferenceOffset({
      x: dragState.offsetX + (event.clientX - dragState.clientX) / safeZoom,
      y: dragState.offsetY + (event.clientY - dragState.clientY) / safeZoom
    })
  }

  const handleReferencePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = referenceDragStartRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    event.preventDefault()
    event.stopPropagation()
    finishReferenceDrag()
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

    const syncSpaceScrollAnchor = () => {
      spaceScrollAnchorRef.current = {
        x: window.scrollX,
        y: window.scrollY
      }
    }

    const handleDirectScrollPan = () => {
      const transform = transformRef.current
      if (!transform) return
      if (!spacePressedRef.current) {
        syncSpaceScrollAnchor()
        return
      }

      const deltaX = window.scrollX - spaceScrollAnchorRef.current.x
      const deltaY = window.scrollY - spaceScrollAnchorRef.current.y
      if (deltaX === 0 && deltaY === 0) return

      spacePanUsedRef.current = true
      startPanning()
      transform.setTransform(
        transform.state.positionX - deltaX,
        transform.state.positionY - deltaY,
        transform.state.scale,
        0
      )

      window.scrollTo(spaceScrollAnchorRef.current.x, spaceScrollAnchorRef.current.y)

      if (trackpadPanStopTimeoutRef.current !== null) {
        window.clearTimeout(trackpadPanStopTimeoutRef.current)
      }

      trackpadPanStopTimeoutRef.current = window.setTimeout(() => {
        stopPanning()
        trackpadPanStopTimeoutRef.current = null
      }, 80)
    }

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
    container.addEventListener('wheel', handleDirectTrackpadPan, { passive: false, capture: true })
    container.addEventListener('mousewheel', handleDirectTrackpadPan as EventListener, {
      passive: false,
      capture: true
    })
    window.addEventListener('wheel', handleDirectTrackpadPan, { passive: false, capture: true })
    window.addEventListener('mousewheel', handleDirectTrackpadPan as EventListener, {
      passive: false,
      capture: true
    })
    window.addEventListener('scroll', handleDirectScrollPan, { passive: true, capture: true })
    window.addEventListener('wheel', preventBrowserWheelZoom, { passive: false, capture: true })
    window.addEventListener('wheel', handleDirectWheelZoom, { passive: false, capture: true })

    return () => {
      container.removeEventListener('gesturestart', preventGestureZoom as EventListener)
      container.removeEventListener('gesturechange', preventGestureZoom as EventListener)
      container.removeEventListener('gestureend', preventGestureZoom as EventListener)
      container.removeEventListener('wheel', handleDirectTrackpadPan, true)
      container.removeEventListener('mousewheel', handleDirectTrackpadPan as EventListener, true)
      window.removeEventListener('wheel', handleDirectTrackpadPan, true)
      window.removeEventListener('mousewheel', handleDirectTrackpadPan as EventListener, true)
      window.removeEventListener('scroll', handleDirectScrollPan, true)
      window.removeEventListener('wheel', preventBrowserWheelZoom, true)
      window.removeEventListener('wheel', handleDirectWheelZoom, true)

      if (trackpadPanStopTimeoutRef.current !== null) {
        window.clearTimeout(trackpadPanStopTimeoutRef.current)
        trackpadPanStopTimeoutRef.current = null
      }
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

    if (zoom <= minZoom + 0.00001 && !isPanning) {
      if (minZoomCenterFrameRef.current !== null) {
        cancelAnimationFrame(minZoomCenterFrameRef.current)
      }

      if (minZoomCenterTimeoutRef.current !== null) {
        window.clearTimeout(minZoomCenterTimeoutRef.current)
      }

      minZoomCenterTimeoutRef.current = window.setTimeout(() => {
        minZoomCenterFrameRef.current = requestAnimationFrame(() => {
          const centeredX = (container.clientWidth - canvasWidth * minZoom) / 2
          const centeredY = (container.clientHeight - canvasHeight * minZoom) / 2
          transform.setTransform(centeredX, centeredY, minZoom, 180)
          minZoomCenterFrameRef.current = null
        })
        minZoomCenterTimeoutRef.current = null
      }, 240)
    }

    return () => {
      if (minZoomCenterFrameRef.current !== null) {
        cancelAnimationFrame(minZoomCenterFrameRef.current)
        minZoomCenterFrameRef.current = null
      }

      if (minZoomCenterTimeoutRef.current !== null) {
        window.clearTimeout(minZoomCenterTimeoutRef.current)
        minZoomCenterTimeoutRef.current = null
      }
    }
  }, [canvasHeight, canvasWidth, isPanning, minZoom, zoom])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isEditableElement(event.target)) {
        event.preventDefault()
      }

      if (event.code === 'Space' && !isEditableElement(document.activeElement)) {
        event.preventDefault()

        if (!spacePressedRef.current) {
          spacePanUsedRef.current = false
          spacePressedRef.current = true
          spacePointerPanPointRef.current = null
          spaceScrollAnchorRef.current = {
            x: window.scrollX,
            y: window.scrollY
          }
          setIsSpacePressed(true)
        }
      }

      if (eventMatchesHotkey(event, hotkeys.undo)) {
        event.preventDefault()
        undo()
        return
      }

      if (eventMatchesHotkey(event, hotkeys.copySelection) && !isEditableElement(event.target)) {
        event.preventDefault()
        copySelection()
        return
      }

      if (eventMatchesHotkey(event, hotkeys.cutSelection) && !isEditableElement(event.target)) {
        event.preventDefault()
        cutSelection()
        return
      }

      if (eventMatchesHotkey(event, hotkeys.flipLayerHorizontal) && !isEditableElement(event.target)) {
        event.preventDefault()
        if (activeLayerId) {
          flipLayerHorizontal(activeLayerId)
        }
        return
      }

      if (eventMatchesHotkey(event, hotkeys.flipLayerVertical) && !isEditableElement(event.target)) {
        event.preventDefault()
        if (activeLayerId) {
          flipLayerVertical(activeLayerId)
        }
        return
      }

      if (eventMatchesHotkey(event, hotkeys.cancel)) {
        clearPendingPastedImage()
        setSelectionBounds(null)
        setSelectionPreviewBounds(null)
        selectionStartRef.current = null
        setIsSelecting(false)
      }

      if (!isEditableElement(event.target) && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.key === 'ArrowLeft' && activeFrameIndex > 0) {
          event.preventDefault()
          setIsAnimationPlaying(false)
          setActiveFrameId(frames[activeFrameIndex - 1].id)
          return
        }

        if (event.key === 'ArrowRight' && activeFrameIndex < frames.length - 1) {
          event.preventDefault()
          setIsAnimationPlaying(false)
          setActiveFrameId(frames[activeFrameIndex + 1].id)
          return
        }
      }

      if (event.key === 'Control') {
        setIsMoveModifierPressed(true)
      }

      if (event.key === 'Alt' && !isEditableElement(event.target)) {
        setIsAltEyedropperPressed(true)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isEditableElement(event.target)) {
        event.preventDefault()
      }

      if (event.code === 'Space') {
        const shouldToggleAnimation =
          !spacePanUsedRef.current &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          !isEditableElement(event.target)

        setIsSpacePressed(false)
        stopPanning()
        spacePanUsedRef.current = false
        spacePressedRef.current = false
        spacePointerPanPointRef.current = null
        spaceScrollAnchorRef.current = {
          x: window.scrollX,
          y: window.scrollY
        }

        if (shouldToggleAnimation) {
          setIsAnimationPlaying((currentValue) => !currentValue)
        }
      }

      if (event.key === 'Control') {
        setIsMoveModifierPressed(false)
        setHoveredHandle(null)
      }

      if (event.key === 'Alt') {
        setIsAltEyedropperPressed(false)
      }
    }

    const handleWindowBlur = () => {
      setIsMoveModifierPressed(false)
      setIsAltEyedropperPressed(false)
      setHoveredHandle(null)
      setIsSpacePressed(false)
      stopPanning()
      spacePanUsedRef.current = false
      spacePressedRef.current = false
      spacePointerPanPointRef.current = null
      spaceScrollAnchorRef.current = {
        x: window.scrollX,
        y: window.scrollY
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [
    clearPendingPastedImage,
    copySelection,
    cutSelection,
    flipLayerHorizontal,
    flipLayerVertical,
    hotkeys.flipLayerHorizontal,
    hotkeys.flipLayerVertical,
    hotkeys.cancel,
    hotkeys.copySelection,
    hotkeys.cutSelection,
    hotkeys.undo,
    activeLayerId,
    activeFrameIndex,
    frames,
    setActiveFrameId,
    undo
  ])

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
    if (!isAnimationPlaying && isOnionSkinEnabled) {
      drawFrameGhost(ctx, previousOnionFrame, pixelDisplaySize, 0.18)
      drawFrameGhost(ctx, nextOnionFrame, pixelDisplaySize, 0.1)
    }

    displayedLayers
      .filter((layer) => layer.visible)
      .reverse()
      .forEach((layer) => {
        if (isAnimationPlaying) {
          drawPixels(ctx, layer.pixels, pixelDisplaySize)
          return
        }

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

  }, [
    activeLayerId,
    canvasRef,
    displayedLayers,
    isAnimationPlaying,
    isOnionSkinEnabled,
    isLayerDragging,
    isLayerRotating,
    isLayerScaling,
    layerDragOffset.x,
    layerDragOffset.y,
    nextOnionFrame,
    previousOnionFrame,
    rotatePreviewPixels,
    scalePreviewPixels,
  ])

  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current
    if (!overlayCanvas) return

    const ctx = overlayCanvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
    ctx.save()
    ctx.translate(transformOverlayPadding, transformOverlayPadding)

    if (shouldShowTransformBox && previewBounds) {
      drawTransformBox(
        ctx,
        previewBounds,
        pixelDisplaySize,
        isLayerRotating ? 'rotate' : isLayerScaling ? scaleHandleRef.current : hoveredHandle,
        zoom
      )

      if (isLayerRotating) {
        drawRotationAngleBadge(ctx, previewBounds, pixelDisplaySize, rotatePreviewAngle, zoom)
      }
    }

    if (activeSelectionBounds) {
      drawSelectionBox(ctx, activeSelectionBounds, pixelDisplaySize, zoom)
    }

    if (showEyedropperOutline) {
      drawEyedropperOutline(
        ctx,
        mousePosition.x,
        mousePosition.y,
        pixelDisplaySize,
        overlayCanvas.width,
        overlayCanvas.height
      )
    } else if (showEraserOutline) {
      const { ox, oy } = getBrushOrigin(mousePosition.x, mousePosition.y, brushSize)
      drawEraserOutline(ctx, ox, oy, brushSize, pixelDisplaySize, overlayCanvas.width, overlayCanvas.height)
    } else if (showBrushOutline) {
      const { ox, oy } = getBrushOrigin(mousePosition.x, mousePosition.y, brushSize)
      drawBrushOutline(
        ctx,
        ox,
        oy,
        brushSize,
        pixelDisplaySize,
        overlayCanvas.width,
        overlayCanvas.height,
        selectedColor
      )
    }

    ctx.restore()
  }, [
    activeSelectionBounds,
    brushOutlineKey,
    brushSize,
    eyedropperOutlineKey,
    eraserOutlineKey,
    hoveredHandle,
    isLayerRotating,
    isLayerScaling,
    mousePosition.x,
    mousePosition.y,
    overlayCanvasRef,
    pixelDisplaySize,
    previewBounds,
    rotatePreviewAngle,
    selectedColor,
    shouldShowTransformBox,
    showBrushOutline,
    showEyedropperOutline,
    showEraserOutline,
    transformOverlayPadding,
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
    renderPixelPreview(
      ctx,
      canvasSize,
      layers
        .filter((layer) => layer.visible)
        .slice()
        .reverse(),
      previewSize
    )
  }, [canvasSize.height, canvasSize.width, layers])

  useEffect(() => {
    if (frames.length === 0) {
      setAnimationFrameIndex(0)
      setIsAnimationPlaying(false)
      return
    }

    setAnimationFrameIndex((currentFrameIndex) => Math.min(currentFrameIndex, Math.max(frames.length - 1, 0)))
  }, [frames.length])

  useEffect(() => {
    if (isAnimationPlaying) return
    setAnimationFrameIndex(activeFrameIndex)
  }, [activeFrameIndex, isAnimationPlaying])

  useEffect(() => {
    if (!isAnimationPlaying) return
    if (frames.length <= 1) return

    const intervalId = window.setInterval(() => {
      setAnimationFrameIndex((currentFrameIndex) => (currentFrameIndex + 1) % frames.length)
    }, Math.max(1000 / animationFps, 50))

    return () => {
      window.clearInterval(intervalId)
    }
  }, [animationFps, frames.length, isAnimationPlaying])

  useEffect(() => {
    if (!isAnimationPlaying) return

    const frame = frames[animationFrameIndex]
    if (!frame || frame.id === activeFrameId) return

    setActiveFrameId(frame.id)
  }, [activeFrameId, animationFrameIndex, frames, isAnimationPlaying, setActiveFrameId])

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

  const drawFrameGhost = (
    ctx: CanvasRenderingContext2D,
    frame: typeof frames[number] | null,
    pixelSize: number,
    alpha: number
  ) => {
    if (!frame) return

    ctx.save()
    ctx.globalAlpha = alpha
    frame.layers
      .filter((layer) => layer.visible)
      .slice()
      .reverse()
      .forEach((layer) => {
        drawPixels(ctx, layer.pixels, pixelSize)
      })
    ctx.restore()
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
    activeRotateCornerRef.current = null
    rotateStartRef.current = null
    setLayerDragOffset({ x: 0, y: 0 })
    setHoveredRotateCorner(null)
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
    stopPanning()
  }

  const getSnappedRotationAngle = (angleDegrees: number, snapToFiveDegrees: boolean) => {
    if (!snapToFiveDegrees) {
      return angleDegrees
    }

    return Math.round(angleDegrees / 5) * 5
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
      invalidateRotationSessionCache()
      translateLayer(activeLayerId, x, y)
      resetLayerTransform()
      return
    }

    if (isLayerRotating && rotatePreviewPixels) {
      if (activeLayerId && rotateStartRef.current) {
        rotationSessionCacheRef.current = {
          layerId: activeLayerId,
          sourceBounds: rotateStartRef.current.bounds,
          sourcePixels: new Map(rotateStartRef.current.pixels),
          accumulatedAngle: rotatePreviewAngle,
          committedPixels: rotatePreviewPixels
        }
      }
      setPixels(rotatePreviewPixels)
      resetLayerTransform()
      return
    }

    if (isLayerScaling && scalePreviewPixels) {
      invalidateRotationSessionCache()
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

    const pointerTool =
      event.altKey && selectedTool !== 'selection'
        ? 'eyedropper'
        : selectedTool

    strokeToolRef.current = isStylusEraser(event) ? 'eraser' : pointerTool
    activePointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)

    const coords = getPixelCoordinates(event)
    const canvasPoint = getCanvasCoordinates(event)
    const isInsideCanvas = isCanvasPointInside(canvasPoint)
    setIsPointerInsideCanvasArea(isInsideCanvas)
    setMousePosition(coords)

    if (pointerTool === 'selection') {
      if (!isInsideCanvas) {
        activePointerIdRef.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
        return
      }

      const clampedCoords = clampPointToCanvas(coords.x, coords.y)
      selectionStartRef.current = clampedCoords
      const nextSelectionBounds = createBoundsFromPoints(clampedCoords.x, clampedCoords.y, clampedCoords.x, clampedCoords.y)
      setSelectionPreviewBounds(nextSelectionBounds)
      setSelectionBounds(nextSelectionBounds)
      setIsSelecting(true)
      setIsDrawing(false)
      return
    }

    if (pointerTool === 'eyedropper') {
      if (!isInsideCanvas) {
        activePointerIdRef.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
        return
      }

      const clampedCoords = clampPointToCanvas(coords.x, coords.y)
      const pickedColor = getVisibleLayerColorAtPoint(layers, clampedCoords.x, clampedCoords.y)
      setSelectedColor(pickedColor)
      setPickerColor(pickedColor)
      if (selectedTool === 'eyedropper') {
        setSelectedTool('pencil')
      }
      setIsDrawing(false)
      return
    }

    if (event.ctrlKey && activeLayer && activeLayerBounds) {
      pushHistory()
      const directHandle = getHandleAtCanvasPoint(canvasPoint.x, canvasPoint.y, activeLayerBounds, pixelDisplaySize, zoom)
      const rotateCorner = directHandle
        ? null
        : getCornerRotateHandleAtCanvasPoint(canvasPoint.x, canvasPoint.y, activeLayerBounds, pixelDisplaySize, zoom)
      const handle = directHandle ?? (rotateCorner ? 'rotate' : null)

      if (handle) {
        if (handle === 'rotate') {
          const cachedRotation =
            rotationSessionCacheRef.current?.layerId === activeLayer.id
              ? rotationSessionCacheRef.current
              : null
          activeRotateCornerRef.current = rotateCorner
          const sourceBounds = cachedRotation?.sourceBounds ?? activeLayerBounds
          const sourcePixels = cachedRotation?.sourcePixels ?? new Map(activeLayer.pixels)
          const baseAngle = cachedRotation?.accumulatedAngle ?? 0
          const center = getBoundsCenter(sourceBounds)
          const pointerX = canvasPoint.x / pixelDisplaySize
          const pointerY = canvasPoint.y / pixelDisplaySize

          rotateStartRef.current = {
            bounds: sourceBounds,
            center,
            pixels: new Map(sourcePixels),
            startAngle: Math.atan2(pointerY - center.y, pointerX - center.x),
            baseAngle
          }
          setRotatePreviewPixels(new Map(activeLayer.pixels))
          setRotatePreviewBounds(activeLayerBounds)
          setRotatePreviewAngle(baseAngle)
          setIsLayerRotating(true)
          setIsDrawing(false)
          return
        }

        invalidateRotationSessionCache()
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

      invalidateRotationSessionCache()
      dragStartRef.current = coords
      dragOffsetRef.current = { x: 0, y: 0 }
      setLayerDragOffset({ x: 0, y: 0 })
      setIsLayerDragging(true)
      setIsDrawing(false)
      return
    }

    if (!isInsideCanvas) {
      activePointerIdRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
      return
    }

    invalidateRotationSessionCache()
    pushHistory()
    setIsDrawing(true)
    if (strokeToolRef.current === 'rectangle' || strokeToolRef.current === 'ellipse') {
      shapeDragStartRef.current = coords
      shapeBasePixelsRef.current = new Map(pixels)
      drawShape(
        coords,
        coords,
        strokeToolRef.current,
        brushSize,
        shapeBasePixelsRef.current,
        event.shiftKey
      )
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

    if (spacePressedRef.current && activePointerIdRef.current === null && event.buttons === 0) {
      const transform = transformRef.current
      const previousPoint = spacePointerPanPointRef.current
      const nextPoint = { x: event.clientX, y: event.clientY }

      if (previousPoint && transform) {
        const deltaX = nextPoint.x - previousPoint.x
        const deltaY = nextPoint.y - previousPoint.y

        if (deltaX !== 0 || deltaY !== 0) {
          spacePanUsedRef.current = true
          startPanning()
          transform.setTransform(
            transform.state.positionX + deltaX,
            transform.state.positionY + deltaY,
            transform.state.scale,
            0
          )
        }
      }

      spacePointerPanPointRef.current = nextPoint
      return
    }

    spacePointerPanPointRef.current = null

    const coords = getPixelCoordinates(event)
    const canvasPoint = getCanvasCoordinates(event)
    const isInsideCanvas = isCanvasPointInside(canvasPoint)
    setIsPointerInsideCanvasArea(isInsideCanvas)
    setMousePosition(coords)
    setIsAltEyedropperPressed(event.altKey)

    const stylusEraser = isStylusEraser(event)
    setStylusEraserActive(stylusEraser)

    if (activePointerIdRef.current === null && selectedTool !== 'selection' && isMoveModifierPressed && activeLayerBounds) {
      const directHandle = getHandleAtCanvasPoint(canvasPoint.x, canvasPoint.y, activeLayerBounds, pixelDisplaySize, zoom)
      const rotateCorner = directHandle
        ? null
        : getCornerRotateHandleAtCanvasPoint(canvasPoint.x, canvasPoint.y, activeLayerBounds, pixelDisplaySize, zoom)
      setHoveredHandle(directHandle ?? (rotateCorner ? 'rotate' : null))
      setHoveredRotateCorner(rotateCorner)
    } else if (!isMoveModifierPressed && !isLayerScaling && !isLayerRotating) {
      setHoveredHandle(null)
      setHoveredRotateCorner(null)
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
      if (!isInsideCanvas) return

      drawShape(
        shapeDragStartRef.current,
        coords,
        strokeToolRef.current,
        brushSize,
        shapeBasePixelsRef.current,
        event.shiftKey
      )
      return
    }

    if (
      lineDragStartRef.current &&
      lineBasePixelsRef.current &&
      (strokeToolRef.current === 'pencil' || strokeToolRef.current === 'eraser')
    ) {
      if (!isInsideCanvas) return

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
      const rawAngle =
        Math.atan2(pointerY - rotateStartRef.current.center.y, pointerX - rotateStartRef.current.center.x) -
        rotateStartRef.current.startAngle
      const totalAngle = rotateStartRef.current.baseAngle + Number(((rawAngle * 180) / Math.PI).toFixed(1))
      const nextAngleDegrees = getSnappedRotationAngle(
        totalAngle,
        event.shiftKey
      )
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
      if (!isInsideCanvas) return

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
    spacePointerPanPointRef.current = null
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
    spacePointerPanPointRef.current = null
    setIsPointerInsideCanvasArea(false)

    if (event.pointerType === 'pen') {
      setStylusEraserActive(false)
    }

    setIsAltEyedropperPressed(false)

    if (!isLayerScaling && !isLayerRotating) {
      setHoveredHandle(null)
    }
  }

  const getCanvasCoordinates = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width - transformOverlayPadding
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height - transformOverlayPadding

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
    const targetColor = pixels.get(`${startX},${startY}`) ?? null
    if (targetColor === fillColor) return

    const stack: [number, number][] = [[startX, startY]]
    const nextPixels = new Map(pixels)

    while (stack.length > 0) {
      const [x, y] = stack.pop()!
      const key = `${x},${y}`

      if (x < 0 || x >= canvasSize.width || y < 0 || y >= canvasSize.height) continue
      if ((nextPixels.get(key) ?? null) !== targetColor) continue

      nextPixels.set(key, fillColor)

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

  const getConstrainedSquareEndPoint = (
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number }
  ) => {
    const deltaX = endPoint.x - startPoint.x
    const deltaY = endPoint.y - startPoint.y
    const side = Math.max(Math.abs(deltaX), Math.abs(deltaY))

    if (side === 0) {
      return endPoint
    }

    return {
      x: startPoint.x + (deltaX < 0 ? -side : side),
      y: startPoint.y + (deltaY < 0 ? -side : side)
    }
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
    basePixels = pixels,
    constrainProportions = false
  ) => {
    if (tool === 'rectangle') {
      drawRectangle(
        startPoint,
        constrainProportions ? getConstrainedSquareEndPoint(startPoint, endPoint) : endPoint,
        strokeBrushSize,
        basePixels
      )
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
    if (event.defaultPrevented || spacePressedRef.current) return
    if (event.ctrlKey || event.metaKey) return

    const looksLikeWheelDevice = event.deltaMode !== 0 || Math.abs(event.deltaY) >= 40
    if (!looksLikeWheelDevice) return

    event.preventDefault()

    const normalizedDelta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
    const zoomFactor = Math.exp(-normalizedDelta * 0.0018)
    const nextZoom = Math.min(4, Math.max(minZoom, transform.state.scale * zoomFactor))

    zoomCanvasAtClientPoint(event.clientX, event.clientY, nextZoom)
  }

  const handleDirectTrackpadPan = (event: WheelEvent) => {
    const container = containerRef.current
    const transform = transformRef.current
    if (!container || !transform) return

    if (!spacePressedRef.current || event.ctrlKey || event.metaKey) return

    event.preventDefault()
    event.stopPropagation()

    const nextPositionX = transform.state.positionX - event.deltaX
    const nextPositionY = transform.state.positionY - event.deltaY

    spacePanUsedRef.current = true
    startPanning()
    transform.setTransform(nextPositionX, nextPositionY, transform.state.scale, 0)

    if (trackpadPanStopTimeoutRef.current !== null) {
      window.clearTimeout(trackpadPanStopTimeoutRef.current)
    }

    trackpadPanStopTimeoutRef.current = window.setTimeout(() => {
      stopPanning()
      trackpadPanStopTimeoutRef.current = null
    }, 80)
  }

  const cursorValue =
    effectiveHoverTool === 'eyedropper'
      ? EYEDROPPER_CURSOR
      : isPanning
        ? 'grabbing'
        : isSpacePressed
          ? 'grab'
          : isLayerRotating
            ? getRotateCursorForCorner(rotatePreviewAngle, activeRotateCornerRef.current)
            : isLayerScaling && scaleHandleRef.current
              ? getCursorForHandle(scaleHandleRef.current, rotatePreviewAngle)
              : isLayerDragging
                ? 'grabbing'
                : hoveredHandle && isMoveModifierPressed
                  ? hoveredHandle === 'rotate'
                    ? getRotateCursorForCorner(rotatePreviewAngle, hoveredRotateCorner)
                    : getCursorForHandle(hoveredHandle, rotatePreviewAngle)
                  : isMoveModifierPressed && activeLayerBounds
                    ? 'grab'
                    : getCursorForTool(effectiveHoverTool)

  const handleMoveFrameLeft = () => {
    if (activeFrameIndex <= 0) return
    const targetFrame = frames[activeFrameIndex - 1]
    if (!targetFrame) return
    reorderFrame(activeFrameId, targetFrame.id, 'before')
  }

  const handleMoveFrameRight = () => {
    if (activeFrameIndex >= frames.length - 1) return
    const targetFrame = frames[activeFrameIndex + 1]
    if (!targetFrame) return
    reorderFrame(activeFrameId, targetFrame.id, 'after')
  }

  const handleFrameDragStart = (frameId: string) => {
    setDraggedFrameId(frameId)
    setDragOverFrameId(frameId)
  }

  const handleFrameDragOver = (frameId: string) => {
    if (!draggedFrameId || draggedFrameId === frameId) return
    setDragOverFrameId(frameId)
  }

  const handleFrameDrop = (targetFrameId: string) => {
    if (!draggedFrameId || draggedFrameId === targetFrameId) {
      setDraggedFrameId(null)
      setDragOverFrameId(null)
      return
    }

    const draggedIndex = frames.findIndex((frame) => frame.id === draggedFrameId)
    const targetIndex = frames.findIndex((frame) => frame.id === targetFrameId)
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedFrameId(null)
      setDragOverFrameId(null)
      return
    }

    reorderFrame(
      draggedFrameId,
      targetFrameId,
      draggedIndex < targetIndex ? 'after' : 'before'
    )
    setDraggedFrameId(null)
    setDragOverFrameId(null)
  }

  const handleFrameDragEnd = () => {
    setDraggedFrameId(null)
    setDragOverFrameId(null)
  }

  return (
    <motion.div
      className="glass-effect relative rounded-2xl p-5 flex h-full flex-col min-w-0 min-h-0"
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div
        ref={containerRef}
        className={`relative flex-1 min-w-0 min-h-0 overflow-hidden ${isPanning ? 'select-none' : ''}`}
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
          limitToBounds={false}
          centerOnInit
          centerZoomedOut={false}
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
              spacePanUsedRef.current = true
              startPanning()
            }
          }}
          onPanningStop={() => {
            stopPanning()
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
                <>
                  <div
                    className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
                    style={{
                      transform: `translate(${referenceOffset.x}px, ${referenceOffset.y}px)`
                    }}
                  >
                    <img
                      src={referenceImageUrl}
                      alt={t('canvas.pasteImage.previewAlt')}
                      className="rounded-lg object-contain"
                      style={{
                        opacity: referenceOpacity,
                        width: `${canvasWidth}px`,
                        height: `${canvasHeight}px`,
                        transform: `scale(${referenceScale})`,
                        transformOrigin: 'center center'
                      }}
                    />
                  </div>
                  <div
                    className={`absolute inset-0 ${
                      isReferenceMoveMode ? 'z-30' : 'z-[15]'
                    } ${
                      isReferenceMoveMode ? '' : 'pointer-events-none'
                    }`}
                    style={{
                      transform: `translate(${referenceOffset.x}px, ${referenceOffset.y}px)`
                    }}
                    onPointerDown={handleReferencePointerDown}
                    onPointerMove={handleReferencePointerMove}
                    onPointerUp={handleReferencePointerUp}
                    onPointerCancel={handleReferencePointerUp}
                    onLostPointerCapture={finishReferenceDrag}
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        cursor: isReferenceDragging ? 'grabbing' : 'grab'
                      }}
                    />
                  </div>
                </>
              ) : null}
              <motion.canvas
                ref={canvasRef as React.RefObject<HTMLCanvasElement>}
                width={canvasWidth}
                height={canvasHeight}
                className="relative z-0 rounded-lg border-2 border-gray-200 bg-white shadow-lg max-w-none h-auto shrink-0"
                style={{
                  width: `${canvasWidth}px`,
                  height: `${canvasHeight}px`
                }}
              />
              <motion.canvas
                ref={overlayCanvasRef}
                width={canvasWidth + transformOverlayPadding * 2}
                height={canvasHeight + transformOverlayPadding * 2}
                onPointerDown={isAnimationPlaying ? undefined : handlePointerDown}
                onPointerMove={isAnimationPlaying ? undefined : handlePointerMove}
                onPointerUp={isAnimationPlaying ? undefined : handlePointerUp}
                onPointerCancel={isAnimationPlaying ? undefined : handlePointerCancel}
                onLostPointerCapture={isAnimationPlaying ? undefined : handleLostPointerCapture}
                onPointerLeave={isAnimationPlaying ? undefined : handlePointerLeave}
                className="touch-none absolute inset-0 z-20 max-w-none h-auto shrink-0"
                style={{
                  cursor: isAnimationPlaying ? 'default' : cursorValue,
                  left: `${-transformOverlayPadding}px`,
                  top: `${-transformOverlayPadding}px`,
                  width: `${canvasWidth + transformOverlayPadding * 2}px`,
                  height: `${canvasHeight + transformOverlayPadding * 2}px`,
                  pointerEvents: isAnimationPlaying ? 'none' : 'auto'
                }}
              />
            </div>
          </TransformComponent>
        </TransformWrapper>
        <div className="pointer-events-none absolute right-4 top-4 z-40">
          <div className="pointer-events-auto flex w-44 flex-col gap-3 rounded-2xl border border-white/70 bg-white/92 p-3 shadow-xl backdrop-blur">
            <div className="self-center rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
              <canvas
                ref={previewCanvasRef}
                className="block h-20 w-20 rounded bg-white image-rendering-pixelated"
                style={{ imageRendering: 'pixelated' }}
                aria-label={t('canvas.preview.aria')}
              />
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
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
              aria-label={t('canvas.zoom.aria')}
            />
          </div>
        </div>
      </div>
      <motion.div
        className="pointer-events-none absolute inset-x-4 bottom-4 z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div
          className="pointer-events-auto flex shrink-0 flex-col gap-4 rounded-2xl border border-white/70 bg-white/92 px-4 py-3 shadow-xl backdrop-blur"
        >
            <div className="flex w-full flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsAnimationPanelCollapsed((currentValue) => !currentValue)}
                  className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-gray-700 transition hover:text-primary-700"
                  aria-expanded={!isAnimationPanelCollapsed}
                  aria-label={t('canvas.animation.title')}
                >
                  <Film className="h-4 w-4" />
                  {t('canvas.animation.title')}
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isAnimationPanelCollapsed ? '' : 'rotate-180'}`}
                  />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOnionSkinEnabled((currentValue) => !currentValue)}
                  disabled={frames.length <= 1 || isAnimationPlaying}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    isOnionSkinEnabled
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-primary-500 hover:text-primary-700'
                  }`}
                  title={t('canvas.animation.onionSkin')}
                  aria-label={t('canvas.animation.onionSkin')}
                >
                  <Layers2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={addFrame}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:border-primary-500 hover:text-primary-700"
                  title={t('canvas.animation.addFrame')}
                  aria-label={t('canvas.animation.addFrame')}
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => duplicateFrame(activeFrameId)}
                  disabled={frames.length === 0}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:border-primary-500 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
                  title={t('canvas.animation.duplicateFrame')}
                  aria-label={t('canvas.animation.duplicateFrame')}
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeFrame(activeFrameId)}
                  disabled={frames.length <= 1}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:border-red-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                  title={t('canvas.animation.deleteFrame')}
                  aria-label={t('canvas.animation.deleteFrame')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleMoveFrameLeft}
                  disabled={activeFrameIndex <= 0}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:border-primary-500 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
                  title={t('canvas.animation.moveFrameLeft')}
                  aria-label={t('canvas.animation.moveFrameLeft')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleMoveFrameRight}
                  disabled={activeFrameIndex >= frames.length - 1}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:border-primary-500 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
                  title={t('canvas.animation.moveFrameRight')}
                  aria-label={t('canvas.animation.moveFrameRight')}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (frames.length <= 1) {
                      setAnimationFrameIndex(0)
                    }
                    setIsAnimationPlaying((currentValue) => !currentValue)
                  }}
                  disabled={frames.length === 0}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:border-primary-500 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
                  title={isAnimationPlaying ? t('canvas.animation.pause') : t('canvas.animation.play')}
                  aria-label={isAnimationPlaying ? t('canvas.animation.pause') : t('canvas.animation.play')}
                >
                  {isAnimationPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
                </button>
              </div>
              <div className="flex w-full max-w-xs items-center gap-3 xl:justify-end">
                <span className="shrink-0 text-sm font-medium text-gray-700">{t('canvas.animation.fps')}</span>
                <input
                  type="range"
                  min="1"
                  max="24"
                  step="1"
                  value={animationFps}
                  onChange={(event) => setAnimationFps(Number(event.target.value))}
                  className="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
                  aria-label={t('canvas.animation.fps')}
                />
                <span className="min-w-[42px] text-right text-sm font-semibold text-gray-700">{animationFps}</span>
              </div>
            </div>
            <AnimatePresence initial={false}>
              {!isAnimationPanelCollapsed ? (
                <motion.div
                  key="animation-panel-content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="w-full overflow-x-auto pt-4">
                    <div className="flex min-w-max items-center gap-2 pb-1">
                      {frames.map((frame, index) => (
                        <FrameThumbnail
                          key={frame.id}
                          canvasSize={canvasSize}
                          layers={frame.layers}
                          frameId={frame.id}
                          index={index}
                          isActive={frame.id === activeFrameId}
                          isDragTarget={dragOverFrameId === frame.id && draggedFrameId !== frame.id}
                          onClick={() => {
                            setIsAnimationPlaying(false)
                            setActiveFrameId(frame.id)
                            setAnimationFrameIndex(index)
                          }}
                          onDragStart={handleFrameDragStart}
                          onDragOver={handleFrameDragOver}
                          onDrop={handleFrameDrop}
                          onDragEnd={handleFrameDragEnd}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
        </div>
      </motion.div>
      {pendingPastedImage ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-slate-950/35 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{t('canvas.pasteImage.title')}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {t('canvas.pasteImage.description')}
                </p>
              </div>
              <button
                type="button"
                onClick={clearPendingPastedImage}
                className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {t('common.cancel')}
              </button>
            </div>

            <div className="mt-4 flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <img
                src={pendingPastedImage.previewUrl}
                alt={t('canvas.pasteImage.previewAlt')}
                className="h-20 w-20 rounded-lg border border-slate-200 bg-white object-contain"
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900">
                  {pendingPastedImage.width > 0 && pendingPastedImage.height > 0
                    ? `${pendingPastedImage.width}x${pendingPastedImage.height}px`
                    : t('canvas.pasteImage.detectingSize')}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {t('canvas.pasteImage.layerHint')}
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
                {t('canvas.pasteImage.asLayer')}
              </button>
              <button
                type="button"
                onClick={insertPendingImageAsReference}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                {t('canvas.pasteImage.asReference')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  )
}
