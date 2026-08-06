import assert from 'node:assert/strict'
import test from 'node:test'
import type { AnimationFrame, Layer } from '../src/shared/types'
import {
  addFrameToState,
  addLayerToFrame,
  addLayerWithPixelsToFrame,
  duplicateFrameInState,
  getActiveFrameSelectionState,
  getNextLayerSelectionState,
  removeFrameAndResolveSelection,
  removeLayerAndResolveSelection,
  renameLayerInFrame
} from '../src/features/canvas/model/canvasEditorOpsUtils'

function createLayer(id: string, visible = true, pixels?: Array<[string, string]>): Layer {
  return {
    id,
    name: id,
    visible,
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

test('addFrameToState inserts a cloned frame after the active frame', () => {
  const frames = [
    createFrame('frame-1', 'layer-1', [createLayer('layer-1')], 2),
    createFrame('frame-2', 'layer-2', [createLayer('layer-2', true, [['2,2', '#222222']])], 3)
  ]

  const nextState = addFrameToState({
    frames,
    activeFrameId: 'frame-1',
    nextFrameNumber: 3,
    getFrameLabel: (number) => `Frame ${number}`,
    getDefaultLayerName: (number) => `Layer ${number}`
  })

  assert.deepEqual(nextState.frames.map((frame) => frame.id), ['frame-1', 'frame-3', 'frame-2'])
  assert.equal(nextState.activeFrameId, 'frame-3')
  assert.deepEqual(nextState.selectedLayerIds, ['layer-1'])
  assert.equal(nextState.selectionAnchorLayerId, 'layer-1')
  assert.equal(nextState.nextFrameNumber, 4)

  nextState.frames[1].layers[0].pixels.set('9,9', '#999999')
  assert.equal(frames[0].layers[0].pixels.has('9,9'), false)
})

test('addFrameToState falls back to a default frame when source frame is missing', () => {
  const nextState = addFrameToState({
    frames: [],
    activeFrameId: 'frame-missing',
    nextFrameNumber: 5,
    getFrameLabel: (number) => `Frame ${number}`,
    getDefaultLayerName: (number) => `Layer ${number}`
  })

  assert.deepEqual(nextState.frames.map((frame) => frame.id), ['frame-5'])
  assert.equal(nextState.frames[0].layers[0].name, 'Layer 1')
  assert.equal(nextState.frames[0].activeLayerId, 'layer-1')
  assert.equal(nextState.frames[0].nextLayerNumber, 2)
})

test('duplicateFrameInState inserts a deep copy after the source frame', () => {
  const frames = [
    createFrame('frame-1', 'layer-1', [createLayer('layer-1')], 2),
    createFrame('frame-2', 'layer-2', [createLayer('layer-2', true, [['2,2', '#222222']])], 3)
  ]

  const nextState = duplicateFrameInState({
    frames,
    frameId: 'frame-2',
    nextFrameNumber: 7
  })

  assert.ok(nextState)
  assert.deepEqual(nextState.frames.map((frame) => frame.id), ['frame-1', 'frame-2', 'frame-7'])
  assert.equal(nextState.frames[2].name, 'frame-2 copy')
  assert.equal(nextState.activeFrameId, 'frame-7')
  assert.equal(nextState.nextFrameNumber, 8)

  nextState.frames[2].layers[0].pixels.set('8,8', '#888888')
  assert.equal(frames[1].layers[0].pixels.has('8,8'), false)
})

test('removeFrameAndResolveSelection resets selection when active frame is removed', () => {
  const frames = [
    createFrame('frame-1', 'layer-1', [createLayer('layer-1')]),
    createFrame('frame-2', 'layer-2', [createLayer('layer-2')]),
    createFrame('frame-3', 'layer-3', [createLayer('layer-3')])
  ]

  const nextState = removeFrameAndResolveSelection({
    frames,
    activeFrameId: 'frame-2',
    frameId: 'frame-2',
    selectedLayerIds: ['layer-2'],
    selectionAnchorLayerId: 'layer-2'
  })

  assert.ok(nextState)
  assert.deepEqual(nextState.frames.map((frame) => frame.id), ['frame-1', 'frame-3'])
  assert.equal(nextState.activeFrameId, 'frame-1')
  assert.deepEqual(nextState.selectedLayerIds, ['layer-1'])
  assert.equal(nextState.selectionAnchorLayerId, 'layer-1')
})

test('removeFrameAndResolveSelection preserves selection when a different frame is removed', () => {
  const frames = [
    createFrame('frame-1', 'layer-1', [createLayer('layer-1')]),
    createFrame('frame-2', 'layer-2', [createLayer('layer-2')]),
    createFrame('frame-3', 'layer-3', [createLayer('layer-3')])
  ]

  const nextState = removeFrameAndResolveSelection({
    frames,
    activeFrameId: 'frame-3',
    frameId: 'frame-1',
    selectedLayerIds: ['layer-3'],
    selectionAnchorLayerId: 'layer-3'
  })

  assert.ok(nextState)
  assert.equal(nextState.activeFrameId, 'frame-3')
  assert.deepEqual(nextState.selectedLayerIds, ['layer-3'])
  assert.equal(nextState.selectionAnchorLayerId, 'layer-3')
})

test('addLayerToFrame prepends a new active layer and updates selection', () => {
  const frame = createFrame('frame-1', 'layer-1', [createLayer('layer-1')], 2)

  const nextState = addLayerToFrame({
    frame,
    getDefaultLayerName: (number) => `Layer ${number}`
  })

  assert.equal(nextState.frame.layers[0].id, 'layer-2')
  assert.equal(nextState.frame.layers[0].name, 'Layer 2')
  assert.equal(nextState.frame.activeLayerId, 'layer-2')
  assert.equal(nextState.frame.nextLayerNumber, 3)
  assert.deepEqual(nextState.selectedLayerIds, ['layer-2'])
  assert.equal(nextState.selectionAnchorLayerId, 'layer-2')
})

test('addLayerWithPixelsToFrame uses trimmed custom name and clones pixels', () => {
  const frame = createFrame('frame-1', 'layer-1', [createLayer('layer-1')], 2)
  const pixels = new Map<string, string>([['1,1', '#111111']])

  const nextState = addLayerWithPixelsToFrame({
    frame,
    pixelsMap: pixels,
    name: '  Imported  ',
    getDefaultLayerName: (number) => `Layer ${number}`
  })

  assert.equal(nextState.frame.layers[0].id, 'layer-2')
  assert.equal(nextState.frame.layers[0].name, 'Imported')
  assert.deepEqual([...nextState.frame.layers[0].pixels.entries()], [['1,1', '#111111']])

  pixels.set('2,2', '#222222')
  assert.equal(nextState.frame.layers[0].pixels.has('2,2'), false)
})

test('removeLayerAndResolveSelection returns fallback active layer when selection becomes empty', () => {
  const frame = createFrame('frame-1', 'layer-2', [
    createLayer('layer-1'),
    createLayer('layer-2')
  ], 3)

  const nextState = removeLayerAndResolveSelection({
    frame,
    layerId: 'layer-2',
    selectedLayerIds: ['layer-2'],
    selectionAnchorLayerId: 'layer-2'
  })

  assert.ok(nextState)
  assert.equal(nextState.frame.activeLayerId, 'layer-1')
  assert.deepEqual(nextState.selectedLayerIds, ['layer-1'])
  assert.equal(nextState.selectionAnchorLayerId, 'layer-1')
})

test('renameLayerInFrame trims names and ignores blank values', () => {
  const frame = createFrame('frame-1', 'layer-1', [
    createLayer('layer-1'),
    createLayer('layer-2')
  ])

  const renamedFrame = renameLayerInFrame(frame, 'layer-2', '  Sketch  ')
  assert.equal(renamedFrame.layers[1].name, 'Sketch')

  const unchangedFrame = renameLayerInFrame(frame, 'layer-2', '   ')
  assert.equal(unchangedFrame, frame)
})

test('getActiveFrameSelectionState returns active layer selection for an existing frame', () => {
  const frames = [
    createFrame('frame-1', 'layer-1', [createLayer('layer-1')]),
    createFrame('frame-2', 'layer-2', [createLayer('layer-2')])
  ]

  assert.deepEqual(getActiveFrameSelectionState(frames, 'frame-2'), {
    activeFrameId: 'frame-2',
    selectedLayerIds: ['layer-2'],
    selectionAnchorLayerId: 'layer-2'
  })
  assert.equal(getActiveFrameSelectionState(frames, 'frame-missing'), null)
})

test('getNextLayerSelectionState handles direct, range and toggle selection flows', () => {
  const layers = [
    createLayer('layer-1'),
    createLayer('layer-2'),
    createLayer('layer-3'),
    createLayer('layer-4')
  ]

  assert.deepEqual(getNextLayerSelectionState({
    layers,
    selectionAnchorLayerId: 'layer-2',
    currentSelectedLayerIds: ['layer-2'],
    layerId: 'layer-4',
    range: true,
    activeLayerId: 'layer-2'
  }), {
    activeLayerId: 'layer-4',
    selectedLayerIds: ['layer-2', 'layer-3', 'layer-4'],
    selectionAnchorLayerId: 'layer-2'
  })

  assert.deepEqual(getNextLayerSelectionState({
    layers,
    selectionAnchorLayerId: 'layer-1',
    currentSelectedLayerIds: ['layer-1', 'layer-3'],
    layerId: 'layer-3',
    toggle: true,
    activeLayerId: 'layer-3'
  }), {
    activeLayerId: 'layer-1',
    selectedLayerIds: ['layer-1'],
    selectionAnchorLayerId: 'layer-3'
  })

  assert.deepEqual(getNextLayerSelectionState({
    layers,
    selectionAnchorLayerId: 'layer-1',
    currentSelectedLayerIds: ['layer-1'],
    layerId: 'layer-2',
    toggle: true,
    activeLayerId: 'layer-1'
  }), {
    activeLayerId: 'layer-2',
    selectedLayerIds: ['layer-1', 'layer-2'],
    selectionAnchorLayerId: 'layer-2'
  })
})
