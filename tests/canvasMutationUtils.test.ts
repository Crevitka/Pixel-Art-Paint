import assert from 'node:assert/strict'
import test from 'node:test'
import type { AnimationFrame, Layer } from '../src/shared/types'
import type { CanvasHistoryEntry } from '../src/features/canvas/model/canvasSessionUtils'
import {
  applyUndoHistoryEntry,
  clearActiveLayerPixels,
  flipLayerInFrame,
  resizeFramesToCanvas,
  setActiveLayerPixels,
  translateLayerInFrame
} from '../src/features/canvas/model/canvasMutationUtils'

function createLayer(id: string, pixels?: Array<[string, string]>): Layer {
  return {
    id,
    name: id,
    visible: true,
    pixels: new Map(pixels ?? [[`${id},0`, '#000000']])
  }
}

function createFrame(id: string, activeLayerId: string, layers: Layer[], nextLayerNumber = layers.length + 1): AnimationFrame {
  return {
    id,
    name: id,
    layers,
    activeLayerId,
    nextLayerNumber
  }
}

test('applyUndoHistoryEntry clones history snapshot into restorable canvas state', () => {
  const previousEntry: CanvasHistoryEntry = {
    canvasSize: { width: 48, height: 24 },
    frames: [createFrame('frame-2', 'layer-2', [createLayer('layer-2', [['1,1', '#222222']])])],
    activeFrameId: 'frame-2',
    selectedLayerIds: ['layer-2'],
    selectionAnchorLayerId: 'layer-2',
    nextFrameNumber: 7
  }

  const restoredState = applyUndoHistoryEntry(previousEntry)

  assert.ok(restoredState)
  assert.deepEqual(restoredState.canvasSize, { width: 48, height: 24 })
  assert.equal(restoredState.activeFrameId, 'frame-2')
  assert.deepEqual(restoredState.selectedLayerIds, ['layer-2'])
  assert.equal(restoredState.selectionAnchorLayerId, 'layer-2')
  assert.equal(restoredState.nextFrameNumber, 7)

  restoredState.frames[0].layers[0].pixels.set('9,9', '#999999')
  previousEntry.selectedLayerIds.push('layer-extra')
  previousEntry.canvasSize.width = 999

  assert.equal(previousEntry.frames[0].layers[0].pixels.has('9,9'), false)
  assert.deepEqual(restoredState.selectedLayerIds, ['layer-2'])
  assert.deepEqual(restoredState.canvasSize, { width: 48, height: 24 })
  assert.equal(applyUndoHistoryEntry(undefined), null)
})

test('setActiveLayerPixels replaces only the active layer pixel map', () => {
  const frame = createFrame('frame-1', 'layer-2', [
    createLayer('layer-1', [['0,0', '#111111']]),
    createLayer('layer-2', [['1,1', '#222222']])
  ])
  const nextPixels = new Map<string, string>([['4,4', '#444444']])

  const nextFrame = setActiveLayerPixels(frame, nextPixels)

  assert.deepEqual([...nextFrame.layers[0].pixels.entries()], [['0,0', '#111111']])
  assert.deepEqual([...nextFrame.layers[1].pixels.entries()], [['4,4', '#444444']])
})

test('clearActiveLayerPixels clears only the active layer', () => {
  const frame = createFrame('frame-1', 'layer-1', [
    createLayer('layer-1', [['0,0', '#111111']]),
    createLayer('layer-2', [['1,1', '#222222']])
  ])

  const nextFrame = clearActiveLayerPixels(frame)

  assert.equal(nextFrame.layers[0].pixels.size, 0)
  assert.deepEqual([...nextFrame.layers[1].pixels.entries()], [['1,1', '#222222']])
})

test('resizeFramesToCanvas clips pixels outside the new canvas bounds', () => {
  const frames = [
    createFrame('frame-1', 'layer-1', [
      createLayer('layer-1', [
        ['0,0', '#111111'],
        ['2,2', '#222222'],
        ['5,5', '#555555']
      ])
    ]),
    createFrame('frame-2', 'layer-2', [
      createLayer('layer-2', [
        ['1,1', '#aaaaaa'],
        ['4,0', '#bbbbbb']
      ])
    ])
  ]

  const nextFrames = resizeFramesToCanvas(frames, { width: 3, height: 3 })

  assert.deepEqual([...nextFrames[0].layers[0].pixels.entries()].sort(), [
    ['0,0', '#111111'],
    ['2,2', '#222222']
  ])
  assert.deepEqual([...nextFrames[1].layers[0].pixels.entries()], [['1,1', '#aaaaaa']])
})

test('translateLayerInFrame moves only the targeted layer and clips to canvas bounds', () => {
  const frame = createFrame('frame-1', 'layer-1', [
    createLayer('layer-1', [
      ['0,0', '#111111'],
      ['2,2', '#222222']
    ]),
    createLayer('layer-2', [['1,1', '#333333']])
  ])

  const nextFrame = translateLayerInFrame(frame, 'layer-1', 1, -1, { width: 3, height: 3 })

  assert.deepEqual([...nextFrame.layers[0].pixels.entries()], [])
  assert.deepEqual([...nextFrame.layers[1].pixels.entries()], [['1,1', '#333333']])
  assert.equal(translateLayerInFrame(frame, 'layer-1', 0, 0, { width: 3, height: 3 }), frame)
})

test('flipLayerInFrame mirrors only the targeted layer horizontally and vertically', () => {
  const frame = createFrame('frame-1', 'layer-1', [
    createLayer('layer-1', [
      ['2,3', '#111111'],
      ['4,3', '#222222'],
      ['3,4', '#333333']
    ]),
    createLayer('layer-2', [['8,8', '#888888']])
  ])

  const flippedHorizontally = flipLayerInFrame(frame, 'layer-1', 'horizontal')
  assert.deepEqual([...flippedHorizontally.layers[0].pixels.entries()].sort(), [
    ['2,3', '#222222'],
    ['3,4', '#333333'],
    ['4,3', '#111111']
  ])
  assert.deepEqual([...flippedHorizontally.layers[1].pixels.entries()], [['8,8', '#888888']])

  const flippedVertically = flipLayerInFrame(frame, 'layer-1', 'vertical')
  assert.deepEqual([...flippedVertically.layers[0].pixels.entries()].sort(), [
    ['2,4', '#111111'],
    ['3,3', '#333333'],
    ['4,4', '#222222']
  ])
})
