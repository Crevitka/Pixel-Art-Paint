import assert from 'node:assert/strict'
import test from 'node:test'
import type { AnimationFrame, Layer } from '../src/shared/types'
import {
  cloneFrames,
  cloneLayers,
  pushCanvasHistoryEntry,
  restoreCanvasProjectState,
  type CanvasHistoryEntry
} from '../src/features/canvas/model/canvasSessionUtils'

function createLayer(id: string, pixels?: Array<[string, string]>): Layer {
  return {
    id,
    name: id,
    visible: true,
    pixels: new Map(pixels ?? [[`${id},0`, '#000000']])
  }
}

function createFrame(id: string, activeLayerId: string, layers: Layer[]): AnimationFrame {
  return {
    id,
    name: id,
    layers,
    activeLayerId,
    nextLayerNumber: layers.length + 1
  }
}

function createHistoryEntry(index: number): CanvasHistoryEntry {
  return {
    canvasSize: { width: 32 + index, height: 32 + index },
    frames: [createFrame(`frame-${index}`, `layer-${index}`, [createLayer(`layer-${index}`)])],
    activeFrameId: `frame-${index}`,
    selectedLayerIds: [`layer-${index}`],
    selectionAnchorLayerId: `layer-${index}`,
    nextFrameNumber: index + 1
  }
}

test('cloneLayers and cloneFrames create deep pixel-map copies', () => {
  const layers = [createLayer('layer-1', [['1,1', '#111111']])]
  const frames = [createFrame('frame-1', 'layer-1', layers)]

  const clonedLayers = cloneLayers(layers)
  const clonedFrames = cloneFrames(frames)

  clonedLayers[0].pixels.set('2,2', '#222222')
  clonedFrames[0].layers[0].pixels.set('3,3', '#333333')

  assert.equal(layers[0].pixels.has('2,2'), false)
  assert.equal(frames[0].layers[0].pixels.has('3,3'), false)
})

test('pushCanvasHistoryEntry clones snapshot data and keeps only the latest max entries', () => {
  let historyEntries: CanvasHistoryEntry[] = []

  for (let index = 1; index <= 102; index += 1) {
    historyEntries = pushCanvasHistoryEntry(historyEntries, createHistoryEntry(index), 100)
  }

  assert.equal(historyEntries.length, 100)
  assert.equal(historyEntries[0].activeFrameId, 'frame-3')
  assert.equal(historyEntries.at(-1)?.activeFrameId, 'frame-102')

  const sourceEntry = createHistoryEntry(200)
  const nextHistoryEntries = pushCanvasHistoryEntry([], sourceEntry, 100)
  sourceEntry.frames[0].layers[0].pixels.set('9,9', '#999999')
  sourceEntry.selectedLayerIds.push('layer-extra')
  sourceEntry.canvasSize.width = 999

  assert.equal(nextHistoryEntries[0].frames[0].layers[0].pixels.has('9,9'), false)
  assert.deepEqual(nextHistoryEntries[0].selectedLayerIds, ['layer-200'])
  assert.equal(nextHistoryEntries[0].canvasSize.width, 232)
})

test('restoreCanvasProjectState restores explicit frames and clamps project metadata', () => {
  const restoredState = restoreCanvasProjectState({
    canvasSize: { width: 48, height: 24 },
    layers: [createLayer('unused-layer')],
    activeLayerId: 'unused-layer',
    frames: [
      createFrame('frame-2', 'layer-2', [createLayer('layer-2', [['0,0', '#222222']])]),
      createFrame('frame-7', 'layer-7', [createLayer('layer-7', [['1,1', '#777777']])])
    ],
    activeFrameId: 'frame-missing',
    animationFps: 60,
    nextFrameNumber: 3,
    referenceImageUrl: 'ref://image',
    referenceOpacity: 0.65,
    referenceScale: 10,
    referenceOffset: { x: 12, y: -8 },
    isReferenceVisible: false,
    nextLayerNumber: 9
  }, (number) => `Frame ${number}`)

  assert.equal(restoredState.activeFrameId, 'frame-2')
  assert.deepEqual(restoredState.selectedLayerIds, ['layer-2'])
  assert.equal(restoredState.selectionAnchorLayerId, 'layer-2')
  assert.equal(restoredState.referenceScale, 4)
  assert.equal(restoredState.animationFps, 24)
  assert.deepEqual(restoredState.referenceOffset, { x: 12, y: -8 })
  assert.equal(restoredState.nextFrameNumber, 8)

  restoredState.frames[0].layers[0].pixels.set('5,5', '#555555')
  assert.equal(restoredState.frames[1].layers[0].pixels.has('5,5'), false)
})

test('restoreCanvasProjectState builds a fallback frame when animation frames are missing', () => {
  const restoredState = restoreCanvasProjectState({
    canvasSize: { width: 16, height: 16 },
    layers: [createLayer('layer-5', [['2,2', '#abcdef']])],
    activeLayerId: 'layer-5',
    referenceImageUrl: null,
    referenceOpacity: 0.4,
    referenceScale: 0.01,
    isReferenceVisible: true,
    nextLayerNumber: 1
  }, (number) => `Frame ${number}`)

  assert.equal(restoredState.frames.length, 1)
  assert.equal(restoredState.frames[0].id, 'frame-1')
  assert.equal(restoredState.frames[0].name, 'Frame 1')
  assert.equal(restoredState.frames[0].activeLayerId, 'layer-5')
  assert.equal(restoredState.frames[0].nextLayerNumber, 2)
  assert.equal(restoredState.activeFrameId, 'frame-1')
  assert.equal(restoredState.referenceScale, 0.1)
  assert.equal(restoredState.animationFps, 8)
  assert.deepEqual(restoredState.referenceOffset, { x: 0, y: 0 })
  assert.equal(restoredState.nextFrameNumber, 2)
})
