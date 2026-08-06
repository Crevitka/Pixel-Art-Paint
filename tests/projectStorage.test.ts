import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearSessionProject,
  getProjectTemplates,
  getRecentProjectById,
  getRecentProjects,
  getSessionProject,
  saveProjectTemplate,
  saveRecentProject,
  saveSessionProject,
  subscribeToProjectTemplates,
  subscribeToRecentProjects
} from '../src/shared/lib/projectStorage'
import {
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

type IndexedDbStoreState = {
  keyPath?: string
  records: Map<string, unknown>
}

type IndexedDbState = {
  stores: Map<string, IndexedDbStoreState>
  version: number
}

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

function createIndexedDbMock() {
  const state: IndexedDbState = {
    stores: new Map<string, IndexedDbStoreState>(),
    version: 0
  }

  const schedule = (callback: () => void) => {
    setTimeout(callback, 0)
  }

  const indexedDB = {
    open: (_name: string, version?: number) => {
      const request = {
        result: undefined as IDBDatabase | undefined,
        error: null as DOMException | null,
        onsuccess: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
        onerror: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
        onupgradeneeded: null as ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown) | null
      }

      schedule(() => {
        const shouldUpgrade = state.version === 0 || (version ?? 0) > state.version
        state.version = Math.max(state.version, version ?? 0)

        const createDb = () => {
          const db = {
            get objectStoreNames() {
              return {
                contains: (storeName: string) => state.stores.has(storeName)
              } as DOMStringList
            },
            createObjectStore: (storeName: string, options?: { keyPath?: string }) => {
              state.stores.set(storeName, {
                keyPath: options?.keyPath,
                records: new Map<string, unknown>()
              })
              return {} as IDBObjectStore
            },
            transaction: (storeName: string, _mode: IDBTransactionMode) => {
              const storeState = state.stores.get(storeName)
              if (!storeState) {
                throw new Error(`Missing store: ${storeName}`)
              }

              let pendingOperations = 0
              let transactionCompleted = false
              const transaction = {
                error: null as DOMException | null,
                oncomplete: null as ((this: IDBTransaction, ev: Event) => unknown) | null,
                onerror: null as ((this: IDBTransaction, ev: Event) => unknown) | null,
                objectStore: () => {
                  const finishOperation = () => {
                    pendingOperations -= 1
                    if (pendingOperations === 0 && !transactionCompleted) {
                      transactionCompleted = true
                      schedule(() => {
                        transaction.oncomplete?.call(transaction as unknown as IDBTransaction, new Event('complete'))
                      })
                    }
                  }

                  const makeRequest = <T,>(resultFactory: () => T) => {
                    pendingOperations += 1
                    const storeRequest = {
                      result: undefined as T | undefined,
                      error: null as DOMException | null,
                      onsuccess: null as ((this: IDBRequest<T>, ev: Event) => unknown) | null,
                      onerror: null as ((this: IDBRequest<T>, ev: Event) => unknown) | null
                    }

                    schedule(() => {
                      storeRequest.result = resultFactory()
                      storeRequest.onsuccess?.call(storeRequest as unknown as IDBRequest<T>, new Event('success'))
                      finishOperation()
                    })

                    return storeRequest
                  }

                  return {
                    getAll: () => makeRequest(() => [...storeState.records.values()] as unknown[]),
                    get: (key: string) => makeRequest(() => storeState.records.get(key)),
                    put: (value: unknown, key?: string) => makeRequest(() => {
                      const recordKey = key ?? (
                        storeState.keyPath && typeof value === 'object' && value !== null
                          ? String((value as Record<string, unknown>)[storeState.keyPath])
                          : ''
                      )
                      storeState.records.set(recordKey, value)
                      return value
                    }),
                    delete: (key: string) => makeRequest(() => {
                      storeState.records.delete(key)
                      return undefined
                    })
                  } as IDBObjectStore
                }
              }

              return transaction as unknown as IDBTransaction
            },
            close: () => undefined
          }

          return db as unknown as IDBDatabase
        }

        request.result = createDb()

        if (shouldUpgrade) {
          request.onupgradeneeded?.call(
            request as unknown as IDBOpenDBRequest,
            new Event('upgradeneeded') as IDBVersionChangeEvent
          )
        }

        request.onsuccess?.call(
          request as unknown as IDBOpenDBRequest,
          new Event('success')
        )
      })

      return request as unknown as IDBOpenDBRequest
    }
  }

  return { indexedDB, state }
}

function createWindowMock() {
  const storage = new Map<string, string>()
  const listeners = new Map<string, Set<EventListener>>()
  const { indexedDB, state } = createIndexedDbMock()

  const localStorage: MockStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => {
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
    indexedDB,
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

  return { windowMock, localStorage, state }
}

test('projectStorage migrates recent projects into indexedDB and loads project payload by id', async () => {
  const { windowMock, localStorage, state } = createWindowMock()
  const previousWindow = globalThis.window

  Object.defineProperty(globalThis, 'window', {
    value: windowMock,
    configurable: true,
    writable: true
  })

  try {
    const legacyProject = createProject('Legacy', 24, 24)

    localStorage.setItem(
      'pixel-art-paint.recent-projects',
      JSON.stringify([
        {
          id: 'legacy-1',
          name: 'Legacy project',
          updatedAt: '2026-08-05T10:00:00.000Z',
          project: legacyProject
        }
      ])
    )

    const recentProjects = await getRecentProjects()
    assert.deepEqual(recentProjects, [{
      id: 'legacy-1',
      name: 'Legacy project',
      updatedAt: '2026-08-05T10:00:00.000Z',
      canvasSize: { width: 24, height: 24 }
    }])
    assert.equal(localStorage.getItem('pixel-art-paint.recent-projects'), null)

    const recentStore = state.stores.get('recent-projects')
    assert.equal(recentStore?.records.size, 1)

    const projectById = await getRecentProjectById('legacy-1')
    assert.deepEqual(projectById, legacyProject)
  } finally {
    Object.defineProperty(globalThis, 'window', {
      value: previousWindow,
      configurable: true,
      writable: true
    })
  }
})

test('projectStorage saveRecentProject updates indexedDB records and emits change event', async () => {
  const { windowMock } = createWindowMock()
  const previousWindow = globalThis.window
  let updateEvents = 0

  Object.defineProperty(globalThis, 'window', {
    value: windowMock,
    configurable: true,
    writable: true
  })

  try {
    const unsubscribe = subscribeToRecentProjects(() => {
      updateEvents += 1
    })

    const alphaProject = createProject('Alpha', 16, 16)
    const betaProject = createProject('Beta', 48, 48)

    await saveRecentProject({ name: 'alpha.pap.json', project: alphaProject })
    await saveRecentProject({ name: 'beta.pap.json', project: betaProject })

    const recentProjects = await getRecentProjects()
    assert.equal(recentProjects.length, 2)
    assert.equal(recentProjects[0]?.name, 'beta.pap.json')
    assert.equal(recentProjects[1]?.name, 'alpha.pap.json')

    const loadedProject = await getRecentProjectById(recentProjects[0]!.id)
    assert.deepEqual(loadedProject, betaProject)
    assert.equal(updateEvents, 2)

    unsubscribe()
  } finally {
    Object.defineProperty(globalThis, 'window', {
      value: previousWindow,
      configurable: true,
      writable: true
    })
  }
})

test('projectStorage migrates and updates custom templates in indexedDB', async () => {
  const { windowMock, localStorage, state } = createWindowMock()
  const previousWindow = globalThis.window
  let templateEvents = 0

  Object.defineProperty(globalThis, 'window', {
    value: windowMock,
    configurable: true,
    writable: true
  })

  try {
    localStorage.setItem(
      'pixel-art-paint.project-templates',
      JSON.stringify([
        {
          id: 'legacy-template',
          title: 'Legacy Template',
          description: 'Legacy desc',
          size: { width: 20, height: 20 },
          paletteColors: ['#101010'],
          isBuiltIn: false
        }
      ])
    )

    const unsubscribe = subscribeToProjectTemplates(() => {
      templateEvents += 1
    })

    const templatesBeforeSave = await getProjectTemplates('en')
    assert.ok(templatesBeforeSave.some((template) => template.title === 'Legacy Template'))
    assert.equal(localStorage.getItem('pixel-art-paint.project-templates'), null)

    await saveProjectTemplate({
      title: 'Custom Template',
      description: 'Custom desc',
      size: { width: 40, height: 24 },
      paletteColors: ['#ff00ff', '#00ffff']
    })

    const templatesAfterSave = await getProjectTemplates('en')
    const customTemplate = templatesAfterSave.find((template) => template.title === 'Custom Template')
    assert.ok(customTemplate)
    assert.deepEqual(customTemplate?.paletteColors, ['#ff00ff', '#00ffff'])
    assert.equal(templateEvents, 1)

    const templateStore = state.stores.get('project-templates')
    assert.ok(templateStore?.records.size)

    unsubscribe()
  } finally {
    Object.defineProperty(globalThis, 'window', {
      value: previousWindow,
      configurable: true,
      writable: true
    })
  }
})

test('projectStorage migrates session draft into indexedDB and clears it correctly', async () => {
  const { windowMock, localStorage, state } = createWindowMock()
  const previousWindow = globalThis.window

  Object.defineProperty(globalThis, 'window', {
    value: windowMock,
    configurable: true,
    writable: true
  })

  try {
    const sessionState: SessionProjectState = {
      projectName: 'Migrated session',
      pathname: '/editor',
      hasFileHandle: false,
      draftProject: createProject('Draft', 64, 32),
      panelBlocks: {
        left: ['tools', 'palette'],
        center: [],
        right: ['layers']
      },
      updatedAt: '2026-08-05T12:00:00.000Z'
    }

    localStorage.setItem('pixel-art-paint.session-project', JSON.stringify(sessionState))

    const migratedState = await getSessionProject()
    assert.deepEqual(migratedState, sessionState)
    assert.equal(localStorage.getItem('pixel-art-paint.session-project'), null)

    const updatedState: SessionProjectState = {
      ...sessionState,
      projectName: 'Updated session',
      updatedAt: '2026-08-05T12:30:00.000Z'
    }

    await saveSessionProject(updatedState)
    assert.deepEqual(await getSessionProject(), updatedState)

    await clearSessionProject()
    assert.equal(await getSessionProject(), null)

    const sessionStore = state.stores.get('session-project')
    assert.equal(sessionStore?.records.size, 0)
  } finally {
    Object.defineProperty(globalThis, 'window', {
      value: previousWindow,
      configurable: true,
      writable: true
    })
  }
})

test('projectStorage upgrades an existing indexedDB schema that is missing the session store', async () => {
  const { windowMock, state } = createWindowMock()
  const previousWindow = globalThis.window

  Object.defineProperty(globalThis, 'window', {
    value: windowMock,
    configurable: true,
    writable: true
  })

  try {
    state.version = 3
    state.stores.set('handles', {
      records: new Map<string, unknown>()
    })
    state.stores.set('recent-projects', {
      keyPath: 'id',
      records: new Map<string, unknown>()
    })
    state.stores.set('project-templates', {
      keyPath: 'id',
      records: new Map<string, unknown>()
    })

    const sessionState: SessionProjectState = {
      projectName: 'Schema upgrade session',
      pathname: '/editor',
      hasFileHandle: false,
      draftProject: createProject('Upgrade draft', 48, 48),
      panelBlocks: {
        left: ['tools', 'palette'],
        center: [],
        right: ['layers']
      },
      updatedAt: '2026-08-05T18:00:00.000Z'
    }

    await saveSessionProject(sessionState)

    assert.equal(state.version, 4)
    assert.ok(state.stores.has('session-project'))
    assert.deepEqual(await getSessionProject(), sessionState)
  } finally {
    Object.defineProperty(globalThis, 'window', {
      value: previousWindow,
      configurable: true,
      writable: true
    })
  }
})
