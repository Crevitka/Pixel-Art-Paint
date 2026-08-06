import assert from 'node:assert/strict'
import test from 'node:test'
import type { AnimationFrame, CanvasSize, Layer } from '../src/shared/types'
import {
  addFrameToState,
  addLayerToFrame,
  addLayerWithPixelsToFrame,
  duplicateFrameInState,
  getActiveFrameSelectionState,
  removeFrameAndResolveSelection,
  removeLayerAndResolveSelection
} from '../src/features/canvas/model/canvasEditorOpsUtils'
import {
  applyUndoHistoryEntry,
  clearActiveLayerPixels,
  resizeFramesToCanvas,
  setActiveLayerPixels
} from '../src/features/canvas/model/canvasMutationUtils'
import {
  pushCanvasHistoryEntry,
  type CanvasHistoryEntry
} from '../src/features/canvas/model/canvasSessionUtils'

type EditorState = {
  canvasSize: CanvasSize
  frames: AnimationFrame[]
  activeFrameId: string
  selectedLayerIds: string[]
  selectionAnchorLayerId: string
  nextFrameNumber: number
}

function createLayer(id: string, pixels?: Array<[string, string]>): Layer {
  return {
    id,
    name: id,
    visible: true,
    pixels: new Map(pixels ?? [])
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

function createInitialEditorState(): EditorState {
  const baseFrame = createFrame('frame-1', 'layer-1', [
    createLayer('layer-1', [['0,0', '#111111']])
  ], 2)

  return {
    canvasSize: { width: 32, height: 32 },
    frames: [baseFrame],
    activeFrameId: 'frame-1',
    selectedLayerIds: ['layer-1'],
    selectionAnchorLayerId: 'layer-1',
    nextFrameNumber: 2
  }
}

function toHistoryEntry(state: EditorState): CanvasHistoryEntry {
  return {
    canvasSize: state.canvasSize,
    frames: state.frames,
    activeFrameId: state.activeFrameId,
    selectedLayerIds: state.selectedLayerIds,
    selectionAnchorLayerId: state.selectionAnchorLayerId,
    nextFrameNumber: state.nextFrameNumber
  }
}

function applyUndo(stateHistory: CanvasHistoryEntry[]) {
  return applyUndoHistoryEntry(stateHistory.pop())
}

test('undo restores frame insertion chain with active frame, selection and nextFrameNumber', () => {
  const getFrameLabel = (number: number) => `Frame ${number}`
  const getDefaultLayerName = (number: number) => `Layer ${number}`
  let state = createInitialEditorState()
  let history: CanvasHistoryEntry[] = []

  history = pushCanvasHistoryEntry(history, toHistoryEntry(state), 100)
  state = {
    ...state,
    ...addFrameToState({
      frames: state.frames,
      activeFrameId: state.activeFrameId,
      nextFrameNumber: state.nextFrameNumber,
      getFrameLabel,
      getDefaultLayerName
    })
  }

  history = pushCanvasHistoryEntry(history, toHistoryEntry(state), 100)
  const duplicatedState = duplicateFrameInState({
    frames: state.frames,
    frameId: state.activeFrameId,
    nextFrameNumber: state.nextFrameNumber
  })
  assert.ok(duplicatedState)
  state = {
    ...state,
    ...duplicatedState
  }

  assert.deepEqual(state.frames.map((frame) => frame.id), ['frame-1', 'frame-2', 'frame-3'])
  assert.equal(state.activeFrameId, 'frame-3')
  assert.deepEqual(state.selectedLayerIds, ['layer-1'])
  assert.equal(state.nextFrameNumber, 4)

  const undoDuplicate = applyUndo(history)
  assert.ok(undoDuplicate)
  assert.deepEqual(undoDuplicate.frames.map((frame) => frame.id), ['frame-1', 'frame-2'])
  assert.equal(undoDuplicate.activeFrameId, 'frame-2')
  assert.deepEqual(undoDuplicate.selectedLayerIds, ['layer-1'])
  assert.equal(undoDuplicate.selectionAnchorLayerId, 'layer-1')
  assert.equal(undoDuplicate.nextFrameNumber, 3)

  const undoAddFrame = applyUndo(history)
  assert.ok(undoAddFrame)
  assert.deepEqual(undoAddFrame.frames.map((frame) => frame.id), ['frame-1'])
  assert.equal(undoAddFrame.activeFrameId, 'frame-1')
  assert.deepEqual(undoAddFrame.selectedLayerIds, ['layer-1'])
  assert.equal(undoAddFrame.nextFrameNumber, 2)
})

test('undo restores layer insertion and layer removal selection state', () => {
  const getDefaultLayerName = (number: number) => `Layer ${number}`
  let state = createInitialEditorState()
  let history: CanvasHistoryEntry[] = []

  history = pushCanvasHistoryEntry(history, toHistoryEntry(state), 100)
  const addLayerState = addLayerToFrame({
    frame: state.frames[0],
    getDefaultLayerName
  })
  state = {
    ...state,
    frames: [addLayerState.frame],
    selectedLayerIds: addLayerState.selectedLayerIds,
    selectionAnchorLayerId: addLayerState.selectionAnchorLayerId
  }

  history = pushCanvasHistoryEntry(history, toHistoryEntry(state), 100)
  const removeLayerState = removeLayerAndResolveSelection({
    frame: state.frames[0],
    layerId: 'layer-2',
    selectedLayerIds: state.selectedLayerIds,
    selectionAnchorLayerId: state.selectionAnchorLayerId
  })
  assert.ok(removeLayerState)
  state = {
    ...state,
    frames: [removeLayerState.frame],
    selectedLayerIds: removeLayerState.selectedLayerIds,
    selectionAnchorLayerId: removeLayerState.selectionAnchorLayerId
  }

  assert.deepEqual(state.frames[0].layers.map((layer) => layer.id), ['layer-1'])
  assert.deepEqual(state.selectedLayerIds, ['layer-1'])

  const undoRemoveLayer = applyUndo(history)
  assert.ok(undoRemoveLayer)
  assert.deepEqual(undoRemoveLayer.frames[0].layers.map((layer) => layer.id), ['layer-2', 'layer-1'])
  assert.equal(undoRemoveLayer.frames[0].activeLayerId, 'layer-2')
  assert.deepEqual(undoRemoveLayer.selectedLayerIds, ['layer-2'])
  assert.equal(undoRemoveLayer.selectionAnchorLayerId, 'layer-2')

  const undoAddLayer = applyUndo(history)
  assert.ok(undoAddLayer)
  assert.deepEqual(undoAddLayer.frames[0].layers.map((layer) => layer.id), ['layer-1'])
  assert.equal(undoAddLayer.frames[0].activeLayerId, 'layer-1')
  assert.deepEqual(undoAddLayer.selectedLayerIds, ['layer-1'])
})

test('undo restores frame selection after removing the active frame', () => {
  const getFrameLabel = (number: number) => `Frame ${number}`
  const getDefaultLayerName = (number: number) => `Layer ${number}`
  let state = createInitialEditorState()
  let history: CanvasHistoryEntry[] = []

  state = {
    ...state,
    ...addFrameToState({
      frames: state.frames,
      activeFrameId: state.activeFrameId,
      nextFrameNumber: state.nextFrameNumber,
      getFrameLabel,
      getDefaultLayerName
    })
  }

  const selectedFrameState = getActiveFrameSelectionState(state.frames, 'frame-2')
  assert.ok(selectedFrameState)
  state = {
    ...state,
    activeFrameId: selectedFrameState.activeFrameId,
    selectedLayerIds: selectedFrameState.selectedLayerIds,
    selectionAnchorLayerId: selectedFrameState.selectionAnchorLayerId
  }

  history = pushCanvasHistoryEntry(history, toHistoryEntry(state), 100)
  const removeFrameState = removeFrameAndResolveSelection({
    frames: state.frames,
    activeFrameId: state.activeFrameId,
    frameId: 'frame-2',
    selectedLayerIds: state.selectedLayerIds,
    selectionAnchorLayerId: state.selectionAnchorLayerId
  })
  assert.ok(removeFrameState)
  state = {
    ...state,
    frames: removeFrameState.frames,
    activeFrameId: removeFrameState.activeFrameId,
    selectedLayerIds: removeFrameState.selectedLayerIds,
    selectionAnchorLayerId: removeFrameState.selectionAnchorLayerId
  }

  assert.equal(state.activeFrameId, 'frame-1')
  assert.deepEqual(state.selectedLayerIds, ['layer-1'])

  const undoRemoveFrame = applyUndo(history)
  assert.ok(undoRemoveFrame)
  assert.deepEqual(undoRemoveFrame.frames.map((frame) => frame.id), ['frame-1', 'frame-2'])
  assert.equal(undoRemoveFrame.activeFrameId, 'frame-2')
  assert.deepEqual(undoRemoveFrame.selectedLayerIds, ['layer-1'])
  assert.equal(undoRemoveFrame.selectionAnchorLayerId, 'layer-1')
})

test('undo restores pixel changes and canvas resize snapshots in order', () => {
  let state = createInitialEditorState()
  let history: CanvasHistoryEntry[] = []

  history = pushCanvasHistoryEntry(history, toHistoryEntry(state), 100)
  state = {
    ...state,
    frames: [setActiveLayerPixels(
      state.frames[0],
      new Map([
        ['0,0', '#111111'],
        ['10,10', '#aaaaaa'],
        ['31,31', '#bbbbbb']
      ])
    )]
  }

  history = pushCanvasHistoryEntry(history, toHistoryEntry(state), 100)
  state = {
    ...state,
    frames: resizeFramesToCanvas(state.frames, { width: 16, height: 16 }),
    canvasSize: { width: 16, height: 16 }
  }

  history = pushCanvasHistoryEntry(history, toHistoryEntry(state), 100)
  state = {
    ...state,
    frames: [clearActiveLayerPixels(state.frames[0])]
  }

  assert.equal(state.frames[0].layers[0].pixels.size, 0)
  assert.deepEqual(state.canvasSize, { width: 16, height: 16 })

  const undoClear = applyUndo(history)
  assert.ok(undoClear)
  assert.deepEqual([...undoClear.frames[0].layers[0].pixels.entries()].sort(), [
    ['0,0', '#111111'],
    ['10,10', '#aaaaaa']
  ])
  assert.deepEqual(undoClear.canvasSize, { width: 16, height: 16 })

  const undoResize = applyUndo(history)
  assert.ok(undoResize)
  assert.deepEqual([...undoResize.frames[0].layers[0].pixels.entries()].sort(), [
    ['0,0', '#111111'],
    ['10,10', '#aaaaaa'],
    ['31,31', '#bbbbbb']
  ])
  assert.deepEqual(undoResize.canvasSize, { width: 32, height: 32 })
})

test('undo restores imported layer insertion with pixels and selection', () => {
  const getDefaultLayerName = (number: number) => `Layer ${number}`
  let state = createInitialEditorState()
  let history: CanvasHistoryEntry[] = []

  history = pushCanvasHistoryEntry(history, toHistoryEntry(state), 100)
  const addImportedLayerState = addLayerWithPixelsToFrame({
    frame: state.frames[0],
    pixelsMap: new Map([
      ['2,2', '#222222'],
      ['3,3', '#333333']
    ]),
    name: ' Imported ',
    getDefaultLayerName
  })
  state = {
    ...state,
    frames: [addImportedLayerState.frame],
    selectedLayerIds: addImportedLayerState.selectedLayerIds,
    selectionAnchorLayerId: addImportedLayerState.selectionAnchorLayerId
  }

  assert.equal(state.frames[0].layers[0].name, 'Imported')
  assert.deepEqual(state.selectedLayerIds, ['layer-2'])

  const undoImportedLayer = applyUndo(history)
  assert.ok(undoImportedLayer)
  assert.deepEqual(undoImportedLayer.frames[0].layers.map((layer) => layer.id), ['layer-1'])
  assert.equal(undoImportedLayer.frames[0].activeLayerId, 'layer-1')
  assert.deepEqual(undoImportedLayer.selectedLayerIds, ['layer-1'])
})
