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
  getSelectionBoundsFromKeys,
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
