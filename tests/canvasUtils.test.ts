import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clampBoundsToCanvas,
  copyPixelsInBounds,
  copyPixelsInSelectionKeys,
  createBoundsFromPoints,
  createSelectionKeysFromBounds,
  getBoundsCenter,
  getConnectedSelectionKeys,
  getLayerBounds,
  getPastedClipboardState,
  getSelectionBoundsFromKeys,
  pasteClipboardPixels,
  removePixelsInBounds,
  removePixelsInSelectionKeys,
  translateBounds
} from '../src/widgets/canvas/model/canvasUtils'

test('getLayerBounds returns null for empty pixel map', () => {
  assert.equal(getLayerBounds(new Map()), null)
})

test('getLayerBounds returns min and max coordinates for pixel map', () => {
  const pixels = new Map<string, string>([
    ['4,2', '#000000'],
    ['1,8', '#ffffff'],
    ['3,5', '#ff0000']
  ])

  assert.deepEqual(getLayerBounds(pixels), {
    minX: 1,
    minY: 2,
    maxX: 4,
    maxY: 8
  })
})

test('bounds helpers create, translate, clamp and center correctly', () => {
  const bounds = createBoundsFromPoints(8, 2, 3, 6)
  assert.deepEqual(bounds, {
    minX: 3,
    minY: 2,
    maxX: 8,
    maxY: 6
  })

  const translated = translateBounds(bounds, -2, 3)
  assert.deepEqual(translated, {
    minX: 1,
    minY: 5,
    maxX: 6,
    maxY: 9
  })

  const clamped = clampBoundsToCanvas(
    {
      minX: -4,
      minY: 2,
      maxX: 20,
      maxY: 15
    },
    { width: 10, height: 8 }
  )
  assert.deepEqual(clamped, {
    minX: 0,
    minY: 2,
    maxX: 9,
    maxY: 7
  })

  assert.deepEqual(getBoundsCenter(bounds), {
    x: 6,
    y: 4.5
  })
})

test('selection key helpers round-trip bounds', () => {
  const selectionKeys = createSelectionKeysFromBounds({
    minX: 2,
    minY: 1,
    maxX: 3,
    maxY: 2
  })

  assert.deepEqual([...selectionKeys].sort(), ['2,1', '2,2', '3,1', '3,2'])
  assert.deepEqual(getSelectionBoundsFromKeys(selectionKeys), {
    minX: 2,
    minY: 1,
    maxX: 3,
    maxY: 2
  })
})

test('getConnectedSelectionKeys returns only the contiguous island of the clicked color', () => {
  const pixels = new Map<string, string>([
    ['0,0', '#111111'],
    ['1,0', '#111111'],
    ['0,1', '#111111'],
    ['3,3', '#111111'],
    ['4,3', '#111111'],
    ['2,2', '#222222']
  ])

  const selectionKeys = getConnectedSelectionKeys(pixels, 0, 0, { width: 6, height: 6 })
  assert.ok(selectionKeys)
  assert.deepEqual([...selectionKeys].sort(), ['0,0', '0,1', '1,0'])
  assert.equal(getConnectedSelectionKeys(pixels, 5, 5, { width: 6, height: 6 }), null)
})

test('remove pixel helpers remove only requested pixels', () => {
  const pixels = new Map<string, string>([
    ['0,0', '#000000'],
    ['1,0', '#111111'],
    ['0,1', '#222222'],
    ['1,1', '#333333']
  ])

  const removedByBounds = removePixelsInBounds(pixels, {
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 1
  })
  assert.deepEqual([...removedByBounds.entries()].sort(), [
    ['1,0', '#111111'],
    ['1,1', '#333333']
  ])

  const removedBySelection = removePixelsInSelectionKeys(
    pixels,
    new Set(['1,0', '0,1'])
  )
  assert.deepEqual([...removedBySelection.entries()].sort(), [
    ['0,0', '#000000'],
    ['1,1', '#333333']
  ])
})

test('copy pixel helpers keep relative coordinates and selection bounds', () => {
  const pixels = new Map<string, string>([
    ['2,1', '#aaaaaa'],
    ['3,1', '#bbbbbb'],
    ['2,2', '#cccccc'],
    ['5,5', '#dddddd']
  ])

  const copiedBounds = copyPixelsInBounds(pixels, {
    minX: 2,
    minY: 1,
    maxX: 3,
    maxY: 2
  })
  assert.ok(copiedBounds)
  assert.equal(copiedBounds.width, 2)
  assert.equal(copiedBounds.height, 2)
  assert.deepEqual([...copiedBounds.pixels.entries()].sort(), [
    ['0,0', '#aaaaaa'],
    ['0,1', '#cccccc'],
    ['1,0', '#bbbbbb']
  ])

  const copiedSelection = copyPixelsInSelectionKeys(
    pixels,
    new Set(['2,1', '2,2', '5,5'])
  )
  assert.ok(copiedSelection)
  assert.equal(copiedSelection.width, 4)
  assert.equal(copiedSelection.height, 5)
  assert.deepEqual([...copiedSelection.pixels.entries()].sort(), [
    ['0,0', '#aaaaaa'],
    ['0,1', '#cccccc'],
    ['3,4', '#dddddd']
  ])
})

test('pasteClipboardPixels pastes relative clipboard pixels at the requested offset', () => {
  const targetPixels = new Map<string, string>([['0,0', '#000000']])
  const clipboard = {
    width: 2,
    height: 2,
    pixels: new Map<string, string>([
      ['0,0', '#111111'],
      ['1,0', '#222222'],
      ['0,1', '#333333']
    ]),
    sourceBounds: {
      minX: 4,
      minY: 5,
      maxX: 5,
      maxY: 6
    }
  }

  const nextPixels = pasteClipboardPixels(targetPixels, clipboard, 3, 4, { width: 8, height: 8 })

  assert.deepEqual([...nextPixels.entries()].sort(), [
    ['0,0', '#000000'],
    ['3,4', '#111111'],
    ['3,5', '#333333'],
    ['4,4', '#222222']
  ])
})

test('getPastedClipboardState clamps pasted selection to the canvas and updates clipboard source bounds', () => {
  const clipboard = {
    width: 3,
    height: 2,
    pixels: new Map<string, string>([
      ['0,0', '#111111'],
      ['1,0', '#222222'],
      ['2,0', '#333333'],
      ['0,1', '#444444']
    ]),
    sourceBounds: {
      minX: 5,
      minY: 4,
      maxX: 7,
      maxY: 5
    }
  }

  const nextState = getPastedClipboardState(new Map(), clipboard, { width: 6, height: 5 })

  assert.deepEqual(nextState.nextSelectionBounds, {
    minX: 5,
    minY: 4,
    maxX: 5,
    maxY: 4
  })
  assert.deepEqual(nextState.nextClipboard.sourceBounds, nextState.nextSelectionBounds)
  assert.deepEqual([...nextState.nextPixels.entries()].sort(), [
    ['5,4', '#111111']
  ])
})

test('clipboard flow cuts a sparse selection and pastes it back with preserved relative offsets', () => {
  const originalPixels = new Map<string, string>([
    ['2,1', '#aaaaaa'],
    ['4,2', '#bbbbbb'],
    ['6,4', '#cccccc'],
    ['8,8', '#dddddd']
  ])
  const selectionKeys = new Set(['2,1', '4,2', '6,4'])

  const clipboard = copyPixelsInSelectionKeys(originalPixels, selectionKeys)
  assert.ok(clipboard)
  assert.deepEqual(clipboard.sourceBounds, {
    minX: 2,
    minY: 1,
    maxX: 6,
    maxY: 4
  })

  const cutPixels = removePixelsInSelectionKeys(originalPixels, selectionKeys)
  assert.deepEqual([...cutPixels.entries()].sort(), [
    ['8,8', '#dddddd']
  ])

  const pastedState = getPastedClipboardState(cutPixels, clipboard, { width: 12, height: 12 })
  assert.deepEqual([...pastedState.nextPixels.entries()].sort(), [
    ['2,1', '#aaaaaa'],
    ['4,2', '#bbbbbb'],
    ['6,4', '#cccccc'],
    ['8,8', '#dddddd']
  ])
  assert.deepEqual(pastedState.nextSelectionBounds, {
    minX: 2,
    minY: 1,
    maxX: 6,
    maxY: 4
  })
})

test('clipboard flow pastes a sparse selection at a new offset without collapsing the shape', () => {
  const sourcePixels = new Map<string, string>([
    ['5,5', '#111111'],
    ['7,6', '#222222'],
    ['6,8', '#333333']
  ])
  const selectionKeys = new Set(['5,5', '7,6', '6,8'])

  const clipboard = copyPixelsInSelectionKeys(sourcePixels, selectionKeys)
  assert.ok(clipboard)

  const pastedPixels = pasteClipboardPixels(new Map(), clipboard, 1, 2, { width: 12, height: 12 })
  assert.deepEqual([...pastedPixels.entries()].sort(), [
    ['1,2', '#111111'],
    ['2,5', '#333333'],
    ['3,3', '#222222']
  ])
})

test('clipboard flow keeps clamped paste bounds stable across repeated edge pastes', () => {
  const clipboard = {
    width: 3,
    height: 3,
    pixels: new Map<string, string>([
      ['0,0', '#111111'],
      ['2,2', '#222222']
    ]),
    sourceBounds: {
      minX: 10,
      minY: 10,
      maxX: 12,
      maxY: 12
    }
  }

  const firstPaste = getPastedClipboardState(new Map(), clipboard, { width: 2, height: 2 })
  assert.deepEqual(firstPaste.nextSelectionBounds, {
    minX: 1,
    minY: 1,
    maxX: 1,
    maxY: 1
  })
  assert.deepEqual([...firstPaste.nextPixels.entries()], [['1,1', '#111111']])

  const secondPaste = getPastedClipboardState(new Map(), firstPaste.nextClipboard, { width: 2, height: 2 })
  assert.deepEqual(secondPaste.nextSelectionBounds, firstPaste.nextSelectionBounds)
  assert.deepEqual([...secondPaste.nextPixels.entries()], [['1,1', '#111111']])
})
