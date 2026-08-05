import type { AnimationFrame, CanvasSize, Layer } from '@/shared/types'

export type ExportPixelMap = Map<string, string>

export function flattenVisibleLayers(layers: Layer[]) {
  const mergedPixels: ExportPixelMap = new Map()

  layers
    .filter((layer) => layer.visible)
    .slice()
    .reverse()
    .forEach((layer) => {
      layer.pixels.forEach((color, key) => {
        mergedPixels.set(key, color)
      })
    })

  return mergedPixels
}

export function buildCanvasExportPixels(layers: Layer[]) {
  return flattenVisibleLayers(layers)
}

export function buildSpriteSheetPixels(frames: AnimationFrame[], canvasSize: CanvasSize) {
  const frameWidth = canvasSize.width
  const frameHeight = canvasSize.height
  const spriteSheetPixels: ExportPixelMap = new Map()

  frames.forEach((frame, frameIndex) => {
    const frameOffsetX = frameIndex * frameWidth
    const framePixels = flattenVisibleLayers(frame.layers)

    framePixels.forEach((color, key) => {
      const [x, y] = key.split(',').map(Number)
      spriteSheetPixels.set(`${frameOffsetX + x},${y}`, color)
    })
  })

  return {
    width: Math.max(frameWidth, frameWidth * frames.length),
    height: frameHeight,
    pixels: spriteSheetPixels
  }
}
