import assert from 'node:assert/strict'
import test from 'node:test'
import type { AnimationFrame, Layer } from '../src/shared/types'
import {
  clearSessionProject,
  deserializeAnimationFrames,
  deserializeLayers,
  getDefaultPalettePresets,
  getDefaultStartTemplates,
  getProjectTemplates,
  getRecentProjects,
  getSessionProject,
  saveProjectTemplate,
  saveSessionProject,
  serializeAnimationFrames,
  serializeLayers,
  type PixelArtProject,
  type SessionProjectState
} from '../src/shared/lib/project'

type MockStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  clear: () => void
}

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

function createProject(): PixelArtProject {
  return {
    version: 1,
    canvas: {
      canvasSize: { width: 32, height: 32 },
      layers: serializeLayers([
        createLayer('layer-1', true, [['1,1', '#000000']])
      ]),
      activeLayerId: 'layer-1',
      referenceImageUrl: null,
      referenceOpacity: 0.5,
      referenceScale: 1,
      referenceOffset: { x: 0, y: 0 },
      isReferenceVisible: true,
      nextLayerNumber: 2
    },
    colors: {
      selectedColor: '#000000',
      pickerColor: '#000000',
      paletteColors: ['#000000', '#ffffff'],
      palettePresets: [{ id: 'basic', label: 'Basic', colors: ['#000000', '#ffffff'] }],
      activePalettePresetId: 'basic'
    },
    tools: {
      selectedTool: 'pencil',
      brushSize: 1
    },
    animation: {
      frames: serializeAnimationFrames([
        createFrame('frame-1', [createLayer('layer-1', true, [['1,1', '#000000']])])
      ]),
      activeFrameId: 'frame-1',
      fps: 8,
      nextFrameNumber: 2
    }
  }
}

function createWindowMock(options?: {
  failSetItemForKeys?: string[]
}) {
  const storage = new Map<string, string>()
  const listeners = new Map<string, Set<EventListener>>()

  const localStorage: MockStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => {
      if (options?.failSetItemForKeys?.includes(key)) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }
      storage.set(key, value)
    },
    removeItem: (key) => {
      storage.delete(key)
    },
    clear: () => {
      storage.clear()
    }
  }

  const windowMock = {
    localStorage,
    addEventListener: (type: string, listener: EventListener) => {
      const currentListeners = listeners.get(type) ?? new Set<EventListener>()
      currentListeners.add(listener)
      listeners.set(type, currentListeners)
    },
    removeEventListener: (type: string, listener: EventListener) => {
      listeners.get(type)?.delete(listener)
    },
    dispatchEvent: (event: Event) => {
      listeners.get(event.type)?.forEach((listener) => listener(event))
      return true
    }
  }

  return { windowMock, localStorage }
}

test('serializeLayers and deserializeLayers preserve layer structure and pixels', () => {
  const layers = [
    createLayer('layer-1', true, [['0,0', '#111111'], ['1,0', '#222222']]),
    createLayer('layer-2', false, [['2,2', '#333333']])
  ]

  const serialized = serializeLayers(layers)
  const deserialized = deserializeLayers(serialized)

  assert.deepEqual(serialized, [
    {
      id: 'layer-1',
      name: 'layer-1',
      visible: true,
      pixels: [['0,0', '#111111'], ['1,0', '#222222']]
    },
    {
      id: 'layer-2',
      name: 'layer-2',
      visible: false,
      pixels: [['2,2', '#333333']]
    }
  ])
  assert.deepEqual(
    deserialized.map((layer) => ({
      ...layer,
      pixels: [...layer.pixels.entries()]
    })),
    layers.map((layer) => ({
      ...layer,
      pixels: [...layer.pixels.entries()]
    }))
  )
})

test('serializeAnimationFrames and deserializeAnimationFrames preserve nested layers', () => {
  const frames = [
    createFrame('frame-1', [createLayer('layer-1', true, [['0,0', '#111111']])]),
    createFrame('frame-2', [createLayer('layer-2', true, [['1,1', '#222222']])])
  ]

  const serialized = serializeAnimationFrames(frames)
  const deserialized = deserializeAnimationFrames(serialized)

  assert.equal(serialized.length, 2)
  assert.deepEqual(
    deserialized.map((frame) => ({
      ...frame,
      layers: frame.layers.map((layer) => ({
        ...layer,
        pixels: [...layer.pixels.entries()]
      }))
    })),
    frames.map((frame) => ({
      ...frame,
      layers: frame.layers.map((layer) => ({
        ...layer,
        pixels: [...layer.pixels.entries()]
      }))
    }))
  )
})

test('default presets and templates differ by locale but keep expected structure', () => {
  const ruPresets = getDefaultPalettePresets('ru')
  const enTemplates = getDefaultStartTemplates('en')

  assert.equal(ruPresets.length, 4)
  assert.equal(enTemplates.length, 4)
  assert.ok(ruPresets.every((preset) => preset.colors.length > 0))
  assert.ok(enTemplates.every((template) => template.isBuiltIn === true))
})

test('getRecentProjects reads both current and legacy localStorage shapes', async () => {
  const { windowMock, localStorage } = createWindowMock()
  const previousWindow = globalThis.window

  Object.defineProperty(globalThis, 'window', {
    value: windowMock,
    configurable: true,
    writable: true
  })

  try {
    localStorage.setItem(
      'pixel-art-paint.recent-projects',
      JSON.stringify([
        {
          id: 'new-shape',
          name: 'Current',
          updatedAt: '2026-07-28T10:00:00.000Z',
          canvasSize: { width: 32, height: 32 }
        },
        {
          id: 'legacy-shape',
          name: 'Legacy',
          updatedAt: '2026-07-27T10:00:00.000Z',
          project: {
            canvas: {
              canvasSize: { width: 16, height: 16 }
            }
          }
        },
        {
          id: 'broken-entry',
          name: 'Broken',
          updatedAt: '2026-07-26T10:00:00.000Z'
        }
      ])
    )

    assert.deepEqual(await getRecentProjects(), [
      {
        id: 'new-shape',
        name: 'Current',
        updatedAt: '2026-07-28T10:00:00.000Z',
        canvasSize: { width: 32, height: 32 }
      },
      {
        id: 'legacy-shape',
        name: 'Legacy',
        updatedAt: '2026-07-27T10:00:00.000Z',
        canvasSize: { width: 16, height: 16 }
      }
    ])
  } finally {
    Object.defineProperty(globalThis, 'window', {
      value: previousWindow,
      configurable: true,
      writable: true
    })
  }
})

test('session project helpers save, read and clear state through localStorage', async () => {
  const { windowMock } = createWindowMock()
  const previousWindow = globalThis.window

  Object.defineProperty(globalThis, 'window', {
    value: windowMock,
    configurable: true,
    writable: true
  })

  try {
    const sessionState: SessionProjectState = {
      projectName: 'Session Test',
      pathname: '/editor',
      hasFileHandle: false,
      draftProject: createProject(),
      panelBlocks: {
        left: ['tools'],
        center: [],
        right: ['layers']
      },
      updatedAt: '2026-07-28T12:00:00.000Z'
    }

    await saveSessionProject(sessionState)
    assert.deepEqual(await getSessionProject(), sessionState)

    await clearSessionProject()
    assert.equal(await getSessionProject(), null)
  } finally {
    Object.defineProperty(globalThis, 'window', {
      value: previousWindow,
      configurable: true,
      writable: true
    })
  }
})

test('custom templates are added ahead of built-ins and remain non-built-in', async () => {
  const { windowMock } = createWindowMock()
  const previousWindow = globalThis.window

  Object.defineProperty(globalThis, 'window', {
    value: windowMock,
    configurable: true,
    writable: true
  })

  try {
    await saveProjectTemplate({
      title: 'My Template',
      description: 'Custom preset',
      size: { width: 48, height: 48 },
      paletteColors: ['#101010', '#f0f0f0']
    })

    const templates = await getProjectTemplates('en')
    const customTemplate = templates.find((template) => template.title === 'My Template')

    assert.ok(customTemplate)
    assert.equal(customTemplate?.isBuiltIn, false)
    assert.deepEqual(customTemplate?.paletteColors, ['#101010', '#f0f0f0'])
  } finally {
    Object.defineProperty(globalThis, 'window', {
      value: previousWindow,
      configurable: true,
      writable: true
    })
  }
})

test('saveSessionProject falls back to metadata-only session when localStorage quota is exceeded', async () => {
  const { windowMock } = createWindowMock({
    failSetItemForKeys: ['pixel-art-paint.session-project']
  })
  const previousWindow = globalThis.window

  Object.defineProperty(globalThis, 'window', {
    value: windowMock,
    configurable: true,
    writable: true
  })

  try {
    const sessionState: SessionProjectState = {
      projectName: 'Quota Test',
      pathname: '/editor',
      hasFileHandle: false,
      draftProject: createProject(),
      panelBlocks: {
        left: ['tools'],
        center: [],
        right: []
      },
      updatedAt: '2026-07-28T13:00:00.000Z'
    }

    await assert.doesNotReject(async () => {
      await saveSessionProject(sessionState)
    })
    assert.equal(await getSessionProject(), null)
  } finally {
    Object.defineProperty(globalThis, 'window', {
      value: previousWindow,
      configurable: true,
      writable: true
    })
  }
})

test('saveProjectTemplate ignores localStorage quota errors', async () => {
  const { windowMock } = createWindowMock({
    failSetItemForKeys: ['pixel-art-paint.project-templates']
  })
  const previousWindow = globalThis.window

  Object.defineProperty(globalThis, 'window', {
    value: windowMock,
    configurable: true,
    writable: true
  })

  try {
    await assert.doesNotReject(async () => {
      await saveProjectTemplate({
        title: 'Quota Template',
        description: 'Will not persist',
        size: { width: 16, height: 16 },
        paletteColors: ['#000000']
      })
    })

    const templates = await getProjectTemplates('en')
    assert.equal(
      templates.some((template) => template.title === 'Quota Template'),
      false
    )
  } finally {
    Object.defineProperty(globalThis, 'window', {
      value: previousWindow,
      configurable: true,
      writable: true
    })
  }
})
