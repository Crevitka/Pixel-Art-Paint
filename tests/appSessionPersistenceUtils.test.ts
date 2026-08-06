import assert from 'node:assert/strict'
import test from 'node:test'
import {
  persistEditorSession,
  restoreEditorSession
} from '../src/app/model/appSessionPersistenceUtils'
import {
  serializeAnimationFrames,
  serializeLayers,
  type PixelArtProject,
  type SessionProjectState
} from '../src/shared/lib/project'
import { INITIAL_PANEL_BLOCKS } from '../src/app/model/sessionPersistence'

function createProject(name = 'Layer 1'): PixelArtProject {
  return {
    version: 1,
    canvas: {
      canvasSize: { width: 32, height: 32 },
      layers: serializeLayers([{
        id: 'layer-1',
        name,
        visible: true,
        pixels: new Map([['1,1', '#000000']])
      }]),
      activeLayerId: 'layer-1',
      referenceImageUrl: null,
      referenceOpacity: 0.45,
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
      fps: 8,
      nextFrameNumber: 2
    }
  }
}

test('restoreEditorSession restores draft project into editor state once', async () => {
  const project = createProject('Draft layer')
  const sessionState: SessionProjectState = {
    projectName: 'Draft project',
    pathname: '/editor',
    hasFileHandle: false,
    draftProject: project,
    panelBlocks: {
      left: ['tools', 'palette'],
      center: ['tools'],
      right: ['layers']
    },
    updatedAt: '2026-08-05T18:30:00.000Z'
  }

  const appliedProjects: Array<{ project: PixelArtProject; projectName: string | null }> = []
  let currentHandle: FileSystemFileHandle | null = undefined as unknown as FileSystemFileHandle | null
  let currentName: string | null = null
  let currentPanelBlocks = INITIAL_PANEL_BLOCKS

  const restored = await restoreEditorSession({
    getSessionProject: async () => sessionState,
    getSessionProjectHandle: async () => null,
    loadProjectFromFile: async () => {
      throw new Error('should not load file for draft session')
    },
    clearSessionProjectHandle: async () => undefined,
    applyProject: (nextProject, options) => {
      appliedProjects.push({
        project: nextProject,
        projectName: options?.projectName ?? null
      })
    },
    setCurrentProjectHandle: (handle) => {
      currentHandle = handle
    },
    setCurrentProjectName: (name) => {
      currentName = name
    },
    setPanelBlocks: (panelBlocks) => {
      currentPanelBlocks = panelBlocks
    }
  })

  assert.equal(restored, true)
  assert.equal(appliedProjects.length, 1)
  assert.deepEqual(appliedProjects[0]?.project, project)
  assert.equal(appliedProjects[0]?.projectName, 'Draft project')
  assert.equal(currentHandle, null)
  assert.equal(currentName, 'Draft project')
  assert.deepEqual(currentPanelBlocks, {
    left: ['tools', 'palette'],
    center: ['tools'],
    right: ['layers']
  })
})

test('restoreEditorSession loads file-handle project and clears broken handles', async () => {
  const project = createProject('Saved layer')
  const sessionState: SessionProjectState = {
    projectName: 'Saved project',
    pathname: '/editor',
    hasFileHandle: true,
    draftProject: null,
    panelBlocks: INITIAL_PANEL_BLOCKS,
    updatedAt: '2026-08-05T18:35:00.000Z'
  }

  const fileHandle = {
    getFile: async () => ({ name: 'saved-project.pap.json' } as File)
  } as FileSystemFileHandle

  const appliedProjects: PixelArtProject[] = []
  let clearHandleCalls = 0

  const restored = await restoreEditorSession({
    getSessionProject: async () => sessionState,
    getSessionProjectHandle: async () => fileHandle,
    loadProjectFromFile: async () => project,
    clearSessionProjectHandle: async () => {
      clearHandleCalls += 1
    },
    applyProject: (nextProject) => {
      appliedProjects.push(nextProject)
    },
    setCurrentProjectHandle: () => undefined,
    setCurrentProjectName: () => undefined,
    setPanelBlocks: () => undefined
  })

  assert.equal(restored, true)
  assert.equal(appliedProjects.length, 1)
  assert.deepEqual(appliedProjects[0], project)
  assert.equal(clearHandleCalls, 0)

  const restoredAfterBrokenHandle = await restoreEditorSession({
    getSessionProject: async () => sessionState,
    getSessionProjectHandle: async () => fileHandle,
    loadProjectFromFile: async () => {
      throw new Error('broken handle')
    },
    clearSessionProjectHandle: async () => {
      clearHandleCalls += 1
    },
    applyProject: () => {
      throw new Error('should not apply project after broken handle')
    },
    setCurrentProjectHandle: () => undefined,
    setCurrentProjectName: () => undefined,
    setPanelBlocks: () => undefined
  })

  assert.equal(restoredAfterBrokenHandle, false)
  assert.equal(clearHandleCalls, 1)
})

test('restoreEditorSession falls back to draft project when file handle is broken but draft exists', async () => {
  const fallbackProject = createProject('Fallback draft')
  const sessionState: SessionProjectState = {
    projectName: 'Recovered project',
    pathname: '/editor',
    hasFileHandle: true,
    draftProject: fallbackProject,
    panelBlocks: {
      left: ['tools', 'palette'],
      center: ['tools'],
      right: ['layers']
    },
    updatedAt: '2026-08-06T10:00:00.000Z'
  }

  let clearHandleCalls = 0
  let appliedProject: PixelArtProject | null = null
  let appliedName: string | null = null
  let currentHandle: FileSystemFileHandle | null = {} as FileSystemFileHandle
  let currentName: string | null = null

  const restored = await restoreEditorSession({
    getSessionProject: async () => sessionState,
    getSessionProjectHandle: async () => ({
      getFile: async () => ({ name: 'broken-project.pap.json' } as File)
    } as FileSystemFileHandle),
    loadProjectFromFile: async () => {
      throw new Error('broken handle')
    },
    clearSessionProjectHandle: async () => {
      clearHandleCalls += 1
    },
    applyProject: (nextProject, options) => {
      appliedProject = nextProject
      appliedName = options?.projectName ?? null
    },
    setCurrentProjectHandle: (handle) => {
      currentHandle = handle
    },
    setCurrentProjectName: (name) => {
      currentName = name
    },
    setPanelBlocks: () => undefined
  })

  assert.equal(restored, true)
  assert.equal(clearHandleCalls, 1)
  assert.deepEqual(appliedProject, fallbackProject)
  assert.equal(appliedName, 'Recovered project')
  assert.equal(currentHandle, null)
  assert.equal(currentName, 'Recovered project')
})

test('persistEditorSession saves draft payload and handle metadata in the right mode', async () => {
  const project = createProject('Persisted layer')
  const savedStates: SessionProjectState[] = []
  const savedHandles: FileSystemFileHandle[] = []
  let clearedHandleCount = 0

  await persistEditorSession({
    currentProjectName: 'Draft project',
    currentProjectHandle: null,
    panelBlocks: {
      left: ['tools'],
      center: ['tools'],
      right: ['layers']
    },
    buildCurrentProject: async () => project,
    saveSessionProject: async (state) => {
      savedStates.push(state)
    },
    saveSessionProjectHandle: async (handle) => {
      savedHandles.push(handle)
    },
    clearSessionProjectHandle: async () => {
      clearedHandleCount += 1
    }
  })

  assert.equal(savedStates.length, 1)
  assert.equal(savedStates[0]?.hasFileHandle, false)
  assert.deepEqual(savedStates[0]?.draftProject, project)
  assert.equal(savedHandles.length, 0)
  assert.equal(clearedHandleCount, 1)

  const fileHandle = {} as FileSystemFileHandle

  await persistEditorSession({
    currentProjectName: 'Saved project',
    currentProjectHandle: fileHandle,
    panelBlocks: INITIAL_PANEL_BLOCKS,
    buildCurrentProject: async () => project,
    saveSessionProject: async (state) => {
      savedStates.push(state)
    },
    saveSessionProjectHandle: async (handle) => {
      savedHandles.push(handle)
    },
    clearSessionProjectHandle: async () => {
      clearedHandleCount += 1
    }
  })

  assert.equal(savedStates.length, 2)
  assert.equal(savedStates[1]?.hasFileHandle, true)
  assert.equal(savedStates[1]?.draftProject, null)
  assert.equal(savedHandles.length, 1)
  assert.equal(savedHandles[0], fileHandle)
  assert.equal(clearedHandleCount, 1)
})

test('persistEditorSession always builds the current project before persisting session metadata', async () => {
  const project = createProject('Build first')
  const callOrder: string[] = []

  await persistEditorSession({
    currentProjectName: 'Saved project',
    currentProjectHandle: {} as FileSystemFileHandle,
    panelBlocks: INITIAL_PANEL_BLOCKS,
    buildCurrentProject: async () => {
      callOrder.push('build')
      return project
    },
    saveSessionProject: async (state) => {
      callOrder.push(`save:${state.hasFileHandle ? 'handle' : 'draft'}`)
      assert.equal(state.draftProject, null)
    },
    saveSessionProjectHandle: async () => {
      callOrder.push('save-handle')
    },
    clearSessionProjectHandle: async () => {
      callOrder.push('clear-handle')
    }
  })

  assert.deepEqual(callOrder, ['build', 'save:handle', 'save-handle'])
})
