import assert from 'node:assert/strict'
import test from 'node:test'
import type { AnimationFrame, Layer } from '../src/shared/types'
import {
  flipLayerPixelsHorizontally,
  flipLayerPixelsVertically,
  removeFrameFromState,
  removeLayerFromFrameState,
  reorderFramesInState,
  reorderLayersInFrame,
  translateLayerPixels,
  toggleLayerVisibilityInFrame
} from '../src/features/canvas/model/canvasStateUtils'

function createLayer(id: string, visible = true): Layer {
  return {
    id,
    name: id,
    visible,
    pixels: new Map([[`${id},0`, '#000000']])
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

test('toggleLayerVisibilityInFrame flips only the targeted layer visibility', () => {
  const frame = createFrame('frame-1', 'layer-1', [
    createLayer('layer-1', true),
    createLayer('layer-2', false)
  ])

  const nextFrame = toggleLayerVisibilityInFrame(frame, 'layer-1')

  assert.equal(nextFrame.layers[0]?.visible, false)
  assert.equal(nextFrame.layers[1]?.visible, false)
  assert.equal(frame.layers[0]?.visible, true)
})

test('removeLayerFromFrameState promotes fallback active layer and selection', () => {
  const frame = createFrame('frame-1', 'layer-2', [
    createLayer('layer-1'),
    createLayer('layer-2'),
    createLayer('layer-3')
  ])

  const nextState = removeLayerFromFrameState({
    frame,
    layerId: 'layer-2',
    selectedLayerIds: ['layer-2'],
    selectionAnchorLayerId: 'layer-2'
  })

  assert.ok(nextState)
  assert.deepEqual(nextState.frame.layers.map((layer) => layer.id), ['layer-1', 'layer-3'])
  assert.equal(nextState.frame.activeLayerId, 'layer-1')
  assert.deepEqual(nextState.selectedLayerIds, ['layer-1'])
  assert.equal(nextState.selectionAnchorLayerId, 'layer-1')
})

test('removeLayerFromFrameState preserves active layer when another layer is removed', () => {
  const frame = createFrame('frame-1', 'layer-3', [
    createLayer('layer-1'),
    createLayer('layer-2'),
    createLayer('layer-3')
  ])

  const nextState = removeLayerFromFrameState({
    frame,
    layerId: 'layer-1',
    selectedLayerIds: ['layer-1', 'layer-3'],
    selectionAnchorLayerId: 'layer-3'
  })

  assert.ok(nextState)
  assert.equal(nextState.frame.activeLayerId, 'layer-3')
  assert.deepEqual(nextState.selectedLayerIds, ['layer-3'])
  assert.equal(nextState.selectionAnchorLayerId, 'layer-3')
})

test('reorderLayersInFrame moves a layer before or after the target', () => {
  const frame = createFrame('frame-1', 'layer-2', [
    createLayer('layer-1'),
    createLayer('layer-2'),
    createLayer('layer-3')
  ])

  const movedBefore = reorderLayersInFrame(frame, 'layer-3', 'layer-1', 'before')
  assert.deepEqual(movedBefore.layers.map((layer) => layer.id), ['layer-3', 'layer-1', 'layer-2'])

  const movedAfter = reorderLayersInFrame(frame, 'layer-1', 'layer-3', 'after')
  assert.deepEqual(movedAfter.layers.map((layer) => layer.id), ['layer-2', 'layer-3', 'layer-1'])
})

test('removeFrameFromState promotes fallback frame when active frame is removed', () => {
  const frames = [
    createFrame('frame-1', 'layer-1', [createLayer('layer-1')]),
    createFrame('frame-2', 'layer-2', [createLayer('layer-2')]),
    createFrame('frame-3', 'layer-3', [createLayer('layer-3')])
  ]

  const nextState = removeFrameFromState({
    frames,
    activeFrameId: 'frame-2',
    frameId: 'frame-2'
  })

  assert.ok(nextState)
  assert.deepEqual(nextState.frames.map((frame) => frame.id), ['frame-1', 'frame-3'])
  assert.equal(nextState.activeFrameId, 'frame-1')
  assert.equal(nextState.activeLayerId, 'layer-1')
})

test('removeFrameFromState keeps current active frame when another frame is removed', () => {
  const frames = [
    createFrame('frame-1', 'layer-1', [createLayer('layer-1')]),
    createFrame('frame-2', 'layer-2', [createLayer('layer-2')]),
    createFrame('frame-3', 'layer-3', [createLayer('layer-3')])
  ]

  const nextState = removeFrameFromState({
    frames,
    activeFrameId: 'frame-3',
    frameId: 'frame-1'
  })

  assert.ok(nextState)
  assert.equal(nextState.activeFrameId, 'frame-3')
  assert.equal(nextState.activeLayerId, null)
})

test('reorderFramesInState moves frames before and after target positions', () => {
  const frames = [
    createFrame('frame-1', 'layer-1', [createLayer('layer-1')]),
    createFrame('frame-2', 'layer-2', [createLayer('layer-2')]),
    createFrame('frame-3', 'layer-3', [createLayer('layer-3')])
  ]

  const movedBefore = reorderFramesInState(frames, 'frame-3', 'frame-1', 'before')
  assert.deepEqual(movedBefore.map((frame) => frame.id), ['frame-3', 'frame-1', 'frame-2'])

  const movedAfter = reorderFramesInState(frames, 'frame-1', 'frame-2', 'after')
  assert.deepEqual(movedAfter.map((frame) => frame.id), ['frame-2', 'frame-1', 'frame-3'])
})

test('translateLayerPixels moves pixels and clips anything outside canvas bounds', () => {
  const pixels = new Map<string, string>([
    ['0,0', '#111111'],
    ['1,1', '#222222'],
    ['3,2', '#333333']
  ])

  const translated = translateLayerPixels(pixels, 1, -1, 4, 3)

  assert.deepEqual([...translated.entries()].sort(), [
    ['2,0', '#222222']
  ])
})

test('flipLayerPixelsHorizontally mirrors pixels around the occupied layer bounds', () => {
  const pixels = new Map<string, string>([
    ['2,3', '#111111'],
    ['4,3', '#222222'],
    ['3,4', '#333333']
  ])

  const flipped = flipLayerPixelsHorizontally(pixels)

  assert.deepEqual([...flipped.entries()].sort(), [
    ['2,3', '#222222'],
    ['3,4', '#333333'],
    ['4,3', '#111111']
  ])
})

test('flipLayerPixelsVertically mirrors pixels around the occupied layer bounds', () => {
  const pixels = new Map<string, string>([
    ['2,3', '#111111'],
    ['2,5', '#222222'],
    ['3,4', '#333333']
  ])

  const flipped = flipLayerPixelsVertically(pixels)

  assert.deepEqual([...flipped.entries()].sort(), [
    ['2,3', '#222222'],
    ['2,5', '#111111'],
    ['3,4', '#333333']
  ])
})
