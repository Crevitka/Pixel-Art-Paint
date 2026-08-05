import assert from 'node:assert/strict'
import test from 'node:test'
import type { AnimationFrame, Layer } from '../src/shared/types'
import { buildCanvasExportPixels, buildSpriteSheetPixels, flattenVisibleLayers } from '../src/widgets/header/model/exportUtils'

function createLayer(id: string, visible: boolean, pixels: Array<[string, string]>): Layer {
  return {
    id,
    name: id,
    visible,
    pixels: new Map(pixels)
  }
}

function createFrame(id: string, layers: Layer[]): AnimationFrame {
  return {
    id,
    name: id,
    layers,
    activeLayerId: layers[0]?.id ?? 'layer-1',
    nextLayerNumber: layers.length + 1
  }
}

test('flattenVisibleLayers merges only visible layers in render order', () => {
  const layers = [
    createLayer('top', true, [['1,0', '#abcdef']]),
    createLayer('hidden', false, [['0,0', '#999999']]),
    createLayer('bottom', true, [['0,0', '#111111'], ['1,0', '#222222']])
  ]

  const flattened = flattenVisibleLayers(layers)

  assert.deepEqual([...flattened.entries()].sort(), [
    ['0,0', '#111111'],
    ['1,0', '#abcdef']
  ])
})

test('buildCanvasExportPixels matches flattened visible layers', () => {
  const layers = [
    createLayer('overlay', true, [['2,2', '#ff0000'], ['3,2', '#00ff00']]),
    createLayer('base', true, [['2,2', '#444444']])
  ]

  assert.deepEqual([...buildCanvasExportPixels(layers).entries()].sort(), [
    ['2,2', '#ff0000'],
    ['3,2', '#00ff00']
  ])
})

test('buildSpriteSheetPixels lays out frames horizontally', () => {
  const frames = [
    createFrame('frame-1', [
      createLayer('layer-1', true, [['0,0', '#111111'], ['1,0', '#222222']])
    ]),
    createFrame('frame-2', [
      createLayer('layer-1', true, [['0,0', '#333333'], ['1,1', '#444444']])
    ])
  ]

  const spriteSheet = buildSpriteSheetPixels(frames, { width: 2, height: 2 })

  assert.equal(spriteSheet.width, 4)
  assert.equal(spriteSheet.height, 2)
  assert.deepEqual([...spriteSheet.pixels.entries()].sort(), [
    ['0,0', '#111111'],
    ['1,0', '#222222'],
    ['2,0', '#333333'],
    ['3,1', '#444444']
  ])
})

test('buildSpriteSheetPixels respects layer visibility and top-over-bottom composition per frame', () => {
  const frames = [
    createFrame('frame-1', [
      createLayer('top', true, [['0,0', '#abcdef']]),
      createLayer('hidden', false, [['0,0', '#999999']]),
      createLayer('bottom', true, [['0,0', '#123456']])
    ])
  ]

  const spriteSheet = buildSpriteSheetPixels(frames, { width: 1, height: 1 })

  assert.deepEqual([...spriteSheet.pixels.entries()], [['0,0', '#abcdef']])
})
