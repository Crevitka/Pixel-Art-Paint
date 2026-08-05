import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyProjectToEditor,
  loadProjectFromFile,
  type ApplyProjectCallbacks
} from '../src/app/model/projectLifecycle'
import {
  serializeAnimationFrames,
  serializeLayers,
  type PixelArtProject
} from '../src/shared/lib/project'

function createProject(name: string, width = 32, height = 32): PixelArtProject {
  return {
    version: 1,
    canvas: {
      canvasSize: { width, height },
      layers: serializeLayers([{
        id: 'layer-1',
        name,
        visible: true,
        pixels: new Map([['1,1', '#000000']])
      }]),
      activeLayerId: 'layer-1',
      referenceImageUrl: null,
      referenceOpacity: 0.35,
      referenceScale: 1.25,
      referenceOffset: { x: 2, y: 3 },
      isReferenceVisible: true,
      nextLayerNumber: 2
    },
    colors: {
      selectedColor: '#112233',
      pickerColor: '#112233',
      paletteColors: ['#112233', '#ffffff'],
      palettePresets: [{ id: 'basic', label: 'Basic', colors: ['#112233', '#ffffff'] }],
      activePalettePresetId: 'basic'
    },
    tools: {
      selectedTool: 'pencil',
      brushSize: 2
    },
    animation: {
      frames: serializeAnimationFrames([{
        id: 'frame-1',
        name: 'Frame 1',
        layers: [{
          id: 'layer-1',
          name,
          visible: true,
          pixels: new Map([['1,1', '#000000']])
        }],
        activeLayerId: 'layer-1',
        nextLayerNumber: 2
      }]),
      activeFrameId: 'frame-1',
      fps: 12,
      nextFrameNumber: 2
    }
  }
}

function createFileReaderMock() {
  class MockFileReader {
    result: string | null = null
    error: DOMException | null = null
    onload: (() => void) | null = null
    onerror: (() => void) | null = null

    readAsText(file: Blob) {
      void file.text().then((text) => {
        this.result = text
        this.onload?.()
      }).catch((error) => {
        this.error = error instanceof DOMException ? error : new DOMException(String(error))
        this.onerror?.()
      })
    }

    readAsDataURL() {
      throw new Error('readAsDataURL is not used in this test')
    }
  }

  return MockFileReader
}

function createCallbacks() {
  const calls = {
    canvas: null as Parameters<ApplyProjectCallbacks['loadCanvasProjectState']>[0] | null,
    colors: null as PixelArtProject['colors'] | null,
    tools: null as PixelArtProject['tools'] | null,
    handle: undefined as FileSystemFileHandle | null | undefined,
    projectName: undefined as string | null | undefined,
    panelBlocks: null as unknown,
    draggingBlockId: 'initial' as string | null,
    dragOverTarget: { panelId: 'left', blockId: 'tools' } as { panelId: string; blockId: string | null } | null,
    navigateCount: 0,
    recentSaves: [] as Array<{ name: string; project: PixelArtProject }>
  }

  const callbacks: ApplyProjectCallbacks = {
    loadCanvasProjectState: (state) => {
      calls.canvas = state
    },
    loadColorProjectState: (state) => {
      calls.colors = state
    },
    loadToolProjectState: (state) => {
      calls.tools = state
    },
    setCurrentProjectHandle: (handle) => {
      calls.handle = handle
    },
    setCurrentProjectName: (name) => {
      calls.projectName = name
    },
    setPanelBlocks: (panelBlocks) => {
      calls.panelBlocks = panelBlocks
    },
    setDraggingBlockId: (blockId) => {
      calls.draggingBlockId = blockId
    },
    setDragOverTarget: (target) => {
      calls.dragOverTarget = target
    },
    navigateToEditor: () => {
      calls.navigateCount += 1
    },
    saveRecentProject: async (entry) => {
      calls.recentSaves.push(entry)
    }
  }

  return { callbacks, calls }
}

test('loadProjectFromFile parses supported project file', async () => {
  const previousFileReader = globalThis.FileReader
  Object.defineProperty(globalThis, 'FileReader', {
    value: createFileReaderMock(),
    configurable: true,
    writable: true
  })

  try {
    const project = createProject('Loaded Project', 48, 24)
    const file = new File([JSON.stringify(project)], 'loaded.pap.json', {
      type: 'application/json'
    })

    const loadedProject = await loadProjectFromFile(file)
    assert.deepEqual(loadedProject, project)
  } finally {
    Object.defineProperty(globalThis, 'FileReader', {
      value: previousFileReader,
      configurable: true,
      writable: true
    })
  }
})

test('loadProjectFromFile rejects unsupported project version', async () => {
  const previousFileReader = globalThis.FileReader
  Object.defineProperty(globalThis, 'FileReader', {
    value: createFileReaderMock(),
    configurable: true,
    writable: true
  })

  try {
    const file = new File([JSON.stringify({ version: 2 })], 'unsupported.pap.json', {
      type: 'application/json'
    })

    await assert.rejects(() => loadProjectFromFile(file), /Unsupported project version/)
  } finally {
    Object.defineProperty(globalThis, 'FileReader', {
      value: previousFileReader,
      configurable: true,
      writable: true
    })
  }
})

test('applyProjectToEditor loads all editor state and navigates to editor', async () => {
  const project = createProject('Applied Project', 64, 64)
  const { callbacks, calls } = createCallbacks()

  applyProjectToEditor(project, callbacks, {
    recentName: 'applied.pap.json',
    projectName: 'Applied Project',
    projectHandle: null,
    panelBlocks: {
      left: ['palette'],
      center: ['tools'],
      right: ['layers']
    }
  })

  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(calls.canvas?.canvasSize.width, 64)
  assert.equal(calls.canvas?.activeLayerId, 'layer-1')
  assert.deepEqual(calls.colors, project.colors)
  assert.deepEqual(calls.tools, project.tools)
  assert.equal(calls.handle, null)
  assert.equal(calls.projectName, 'Applied Project')
  assert.deepEqual(calls.panelBlocks, {
    left: ['palette'],
    center: ['tools'],
    right: ['layers']
  })
  assert.equal(calls.draggingBlockId, null)
  assert.equal(calls.dragOverTarget, null)
  assert.equal(calls.navigateCount, 1)
  assert.deepEqual(calls.recentSaves, [{
    name: 'applied.pap.json',
    project
  }])
})

test('applyProjectToEditor skips recent save when requested', async () => {
  const project = createProject('Recent Skipped')
  const { callbacks, calls } = createCallbacks()

  applyProjectToEditor(project, callbacks, {
    saveToRecent: false
  })

  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(calls.navigateCount, 1)
  assert.deepEqual(calls.recentSaves, [])
})
