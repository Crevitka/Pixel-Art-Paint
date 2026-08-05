import type { CanvasSize } from '@/shared/types'
import { clampBoundsToCanvas, getBoundsCenter, type LayerBounds } from './canvasUtils'

export type TransformHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | 'rotate'

function getBoundsSize(bounds: LayerBounds) {
  return {
    width: bounds.maxX - bounds.minX + 1,
    height: bounds.maxY - bounds.minY + 1
  }
}

export function getResizedBounds(
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

    if (handle.includes('w')) nextMinX = Math.min(x, bounds.maxX)
    if (handle.includes('e')) nextMaxX = Math.max(x, bounds.minX)
    if (handle.includes('n')) nextMinY = Math.min(y, bounds.maxY)
    if (handle.includes('s')) nextMaxY = Math.max(y, bounds.minY)

    return clampBoundsToCanvas(
      {
        minX: nextMinX,
        minY: nextMinY,
        maxX: nextMaxX,
        maxY: nextMaxY
      },
      canvasSize
    )
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

export function scalePixelsToBounds(
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

export function rotatePixels(
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
