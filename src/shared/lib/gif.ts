import type { AnimationFrame, CanvasSize } from '@/shared/types'

type RgbColor = {
  r: number
  g: number
  b: number
}

function hexToRgb(hex: string): RgbColor {
  const normalized = hex.trim().replace(/^#/, '').toLowerCase()
  const safeValue = /^[0-9a-f]{6}$/.test(normalized) ? normalized : 'ffffff'

  return {
    r: parseInt(safeValue.slice(0, 2), 16),
    g: parseInt(safeValue.slice(2, 4), 16),
    b: parseInt(safeValue.slice(4, 6), 16)
  }
}

function pushByte(target: number[], value: number) {
  target.push(value & 0xff)
}

function pushBytes(target: number[], values: number[]) {
  values.forEach((value) => pushByte(target, value))
}

function pushWord(target: number[], value: number) {
  pushByte(target, value)
  pushByte(target, value >> 8)
}

function pushAscii(target: number[], value: string) {
  for (let index = 0; index < value.length; index++) {
    pushByte(target, value.charCodeAt(index))
  }
}

function getPaletteTableSize(colorCount: number) {
  let size = 2

  while (size < colorCount) {
    size *= 2
  }

  return Math.max(2, Math.min(256, size))
}

function buildGlobalPalette(frames: AnimationFrame[]) {
  const colors = ['#ffffff']
  const colorSet = new Set(colors)

  frames.forEach((frame) => {
    frame.layers
      .filter((layer) => layer.visible)
      .forEach((layer) => {
        layer.pixels.forEach((color) => {
          const normalizedColor = color.trim().toLowerCase()
          if (colorSet.has(normalizedColor)) return
          colorSet.add(normalizedColor)
          colors.push(normalizedColor)
        })
      })
  })

  if (colors.length > 256) {
    throw new Error('GIF palette exceeds 256 colors')
  }

  const paletteMap = new Map<string, number>()
  colors.forEach((color, index) => {
    paletteMap.set(color, index)
  })

  return { colors, paletteMap }
}

function renderFrameIndexes(
  frame: AnimationFrame,
  canvasSize: CanvasSize,
  exportScale: number,
  paletteMap: Map<string, number>
) {
  const width = canvasSize.width * exportScale
  const height = canvasSize.height * exportScale
  const pixels = new Uint8Array(width * height)

  frame.layers
    .filter((layer) => layer.visible)
    .slice()
    .reverse()
    .forEach((layer) => {
      layer.pixels.forEach((color, key) => {
        const paletteIndex = paletteMap.get(color.trim().toLowerCase()) ?? 0
        const [x, y] = key.split(',').map(Number)
        const startX = x * exportScale
        const startY = y * exportScale

        for (let offsetY = 0; offsetY < exportScale; offsetY++) {
          const rowOffset = (startY + offsetY) * width

          for (let offsetX = 0; offsetX < exportScale; offsetX++) {
            pixels[rowOffset + startX + offsetX] = paletteIndex
          }
        }
      })
    })

  return pixels
}

function packSubBlocks(bytes: number[]) {
  const packed: number[] = []

  for (let offset = 0; offset < bytes.length; offset += 255) {
    const block = bytes.slice(offset, offset + 255)
    pushByte(packed, block.length)
    pushBytes(packed, block)
  }

  pushByte(packed, 0)
  return packed
}

function lzwEncode(indexes: Uint8Array, minCodeSize: number) {
  const clearCode = 1 << minCodeSize
  const endCode = clearCode + 1
  const dictionary = new Map<string, number>()
  let nextCode = endCode + 1
  let codeSize = minCodeSize + 1
  const outputCodes: number[] = [clearCode]

  for (let index = 0; index < clearCode; index++) {
    dictionary.set(String(index), index)
  }

  let current = String(indexes[0] ?? 0)

  for (let index = 1; index < indexes.length; index++) {
    const nextValue = String(indexes[index])
    const combined = `${current},${nextValue}`

    if (dictionary.has(combined)) {
      current = combined
      continue
    }

    outputCodes.push(dictionary.get(current) ?? 0)

    if (nextCode < 4096) {
      dictionary.set(combined, nextCode)
      nextCode += 1

      if (nextCode === 1 << codeSize && codeSize < 12) {
        codeSize += 1
      }
    } else {
      outputCodes.push(clearCode)
      dictionary.clear()

      for (let dictionaryIndex = 0; dictionaryIndex < clearCode; dictionaryIndex++) {
        dictionary.set(String(dictionaryIndex), dictionaryIndex)
      }

      nextCode = endCode + 1
      codeSize = minCodeSize + 1
    }

    current = nextValue
  }

  outputCodes.push(dictionary.get(current) ?? 0)
  outputCodes.push(endCode)

  const dataBytes: number[] = []
  let bitBuffer = 0
  let bitCount = 0
  let emittedCodeSize = minCodeSize + 1
  nextCode = endCode + 1

  const resetDictionary = () => {
    emittedCodeSize = minCodeSize + 1
    nextCode = endCode + 1
  }

  resetDictionary()

  outputCodes.forEach((code, index) => {
    bitBuffer |= code << bitCount
    bitCount += emittedCodeSize

    while (bitCount >= 8) {
      dataBytes.push(bitBuffer & 0xff)
      bitBuffer >>= 8
      bitCount -= 8
    }

    if (code === clearCode) {
      resetDictionary()
      return
    }

    if (code === endCode) {
      return
    }

    if (index === 0) {
      return
    }

    nextCode += 1

    if (nextCode === 1 << emittedCodeSize && emittedCodeSize < 12) {
      emittedCodeSize += 1
    }
  })

  if (bitCount > 0) {
    dataBytes.push(bitBuffer & 0xff)
  }

  return dataBytes
}

export function createAnimatedGifBlob(
  frames: AnimationFrame[],
  canvasSize: CanvasSize,
  fps: number,
  exportScale = 16
) {
  if (frames.length === 0) {
    throw new Error('Animation has no frames')
  }

  const width = canvasSize.width * exportScale
  const height = canvasSize.height * exportScale
  const { colors, paletteMap } = buildGlobalPalette(frames)
  const paletteSize = getPaletteTableSize(colors.length)
  const colorTableSizeBits = Math.max(0, Math.log2(paletteSize) - 1)
  const minCodeSize = Math.max(2, Math.ceil(Math.log2(Math.max(colors.length, 2))))
  const gifBytes: number[] = []

  pushAscii(gifBytes, 'GIF89a')
  pushWord(gifBytes, width)
  pushWord(gifBytes, height)
  pushByte(gifBytes, 0x80 | 0x70 | colorTableSizeBits)
  pushByte(gifBytes, 0)
  pushByte(gifBytes, 0)

  for (let index = 0; index < paletteSize; index++) {
    const color = colors[index] ?? '#ffffff'
    const rgb = hexToRgb(color)
    pushBytes(gifBytes, [rgb.r, rgb.g, rgb.b])
  }

  pushBytes(gifBytes, [
    0x21, 0xff, 0x0b,
    0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30,
    0x03, 0x01, 0x00, 0x00, 0x00
  ])

  const frameDelay = Math.max(2, Math.round(100 / Math.max(fps, 1)))

  frames.forEach((frame) => {
    const frameIndexes = renderFrameIndexes(frame, canvasSize, exportScale, paletteMap)
    const lzwData = lzwEncode(frameIndexes, minCodeSize)

    pushBytes(gifBytes, [0x21, 0xf9, 0x04, 0x00])
    pushWord(gifBytes, frameDelay)
    pushByte(gifBytes, 0)
    pushByte(gifBytes, 0)

    pushByte(gifBytes, 0x2c)
    pushWord(gifBytes, 0)
    pushWord(gifBytes, 0)
    pushWord(gifBytes, width)
    pushWord(gifBytes, height)
    pushByte(gifBytes, 0x00)
    pushByte(gifBytes, minCodeSize)
    pushBytes(gifBytes, packSubBlocks(lzwData))
  })

  pushByte(gifBytes, 0x3b)

  return new Blob([new Uint8Array(gifBytes)], { type: 'image/gif' })
}
