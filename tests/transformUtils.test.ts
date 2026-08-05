import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getResizedBounds,
  rotatePixels,
  scalePixelsToBounds
} from '../src/widgets/canvas/model/transformUtils'

test('getResizedBounds resizes a corner freely inside canvas bounds', () => {
  const nextBounds = getResizedBounds(
    {
      minX: 2,
      minY: 2,
      maxX: 4,
      maxY: 4
    },
    'se',
    6,
    7,
    { width: 16, height: 16 },
    false
  )

  assert.deepEqual(nextBounds, {
    minX: 2,
    minY: 2,
    maxX: 6,
    maxY: 7
  })
})

test('getResizedBounds preserves aspect ratio when requested', () => {
  const nextBounds = getResizedBounds(
    {
      minX: 1,
      minY: 1,
      maxX: 2,
      maxY: 2
    },
    'se',
    4,
    6,
    { width: 16, height: 16 },
    true
  )

  assert.deepEqual(nextBounds, {
    minX: 1,
    minY: 1,
    maxX: 6,
    maxY: 6
  })
})

test('scalePixelsToBounds expands source pixels into target bounds', () => {
  const pixels = new Map<string, string>([
    ['0,0', '#111111'],
    ['1,0', '#222222']
  ])

  const nextPixels = scalePixelsToBounds(
    pixels,
    {
      minX: 0,
      minY: 0,
      maxX: 1,
      maxY: 0
    },
    {
      minX: 0,
      minY: 0,
      maxX: 3,
      maxY: 1
    }
  )

  assert.deepEqual([...nextPixels.entries()].sort(), [
    ['0,0', '#111111'],
    ['0,1', '#111111'],
    ['1,0', '#111111'],
    ['1,1', '#111111'],
    ['2,0', '#222222'],
    ['2,1', '#222222'],
    ['3,0', '#222222'],
    ['3,1', '#222222']
  ])
})

test('rotatePixels keeps a single pixel stable at 90 degrees around its bounds', () => {
  const pixels = new Map<string, string>([['2,2', '#abcdef']])

  const rotatedPixels = rotatePixels(
    pixels,
    {
      minX: 2,
      minY: 2,
      maxX: 2,
      maxY: 2
    },
    90,
    { width: 8, height: 8 }
  )

  assert.deepEqual([...rotatedPixels.entries()], [['2,2', '#abcdef']])
})

test('rotatePixels keeps a filled 2x2 block stable at 90 degrees', () => {
  const pixels = new Map<string, string>([
    ['1,1', '#111111'],
    ['2,1', '#222222'],
    ['1,2', '#333333'],
    ['2,2', '#444444']
  ])

  const rotatedPixels = rotatePixels(
    pixels,
    {
      minX: 1,
      minY: 1,
      maxX: 2,
      maxY: 2
    },
    90,
    { width: 8, height: 8 }
  )

  assert.deepEqual([...rotatedPixels.entries()].sort(), [
    ['1,1', '#333333'],
    ['1,2', '#444444'],
    ['2,1', '#111111'],
    ['2,2', '#222222']
  ])
})
