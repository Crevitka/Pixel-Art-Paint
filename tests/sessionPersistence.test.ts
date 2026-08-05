import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSessionPayload,
  INITIAL_PANEL_BLOCKS,
  normalizePanelBlocks,
  resolveRestoredSessionState
} from '../src/app/model/sessionPersistence'
import {
  clearSessionProject,
  getSessionProject,
  saveSessionProject,
  serializeAnimationFrames,
  serializeLayers,
  type PixelArtProject
} from '../src/shared/lib/project'

type MockStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

type IndexedDbStoreState = {
  keyPath?: string
  records: Map<string, unknown>
}

function createProject(): PixelArtProject {
  return {
    version: 1,
    canvas: {
      canvasSize: { width: 32, height: 32 },
      layers: serializeLayers([{
        id: 'layer-1',
        name: 'Layer 1',
        visible: true,
        pixels: new Map([['1,1', '#000000']])
      }]),
      activeLayerId: 'layer-1',
      referenceImageUrl: null,
      referenceOpacity: 0.4,
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
          name: 'Layer 1',
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
  const stores = new Map<string, IndexedDbStoreState>()
  let version = 0

  const indexedDB = {
    open: (_name: string, nextVersion?: number) => {
      const request = {
        result: undefined as IDBDatabase | undefined,
        error: null as DOMException | null,
        onsuccess: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
        onerror: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
        onupgradeneeded: null as ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown) | null
      }

      setTimeout(() => {
        const shouldUpgrade = version === 0 || (nextVersion ?? 0) > version
        version = Math.max(version, nextVersion ?? 0)

        const db = {
          get objectStoreNames() {
            return {
              contains: (storeName: string) => stores.has(storeName)
            } as DOMStringList
          },
          createObjectStore: (storeName: string, options?: { keyPath?: string }) => {
            stores.set(storeName, {
              keyPath: options?.keyPath,
              records: new Map<string, unknown>()
            })
            return {} as IDBObjectStore
          },
          transaction: (storeName: string, _mode: IDBTransactionMode) => {
            const storeState = stores.get(storeName)
            if (!storeState) {
              throw new Error(`Missing store: ${storeName}`)
            }

            let pending = 0
            let completed = false
            const transaction = {
              error: null as DOMException | null,
              oncomplete: null as ((this: IDBTransaction, ev: Event) => unknown) | null,
              onerror: null as ((this: IDBTransaction, ev: Event) => unknown) | null,
              objectStore: () => {
                const finish = () => {
                  pending -= 1
                  if (pending === 0 && !completed) {
                    completed = true
                    setTimeout(() => {
                      transaction.oncomplete?.call(transaction as unknown as IDBTransaction, new Event('complete'))
                    }, 0)
                  }
                }

                const requestFor = <T,>(factory: () => T) => {
                  pending += 1
                  const innerRequest = {
                    result: undefined as T | undefined,
                    error: null as DOMException | null,
                    onsuccess: null as ((this: IDBRequest<T>, ev: Event) => unknown) | null,
                    onerror: null as ((this: IDBRequest<T>, ev: Event) => unknown) | null
                  }

                  setTimeout(() => {
                    innerRequest.result = factory()
                    innerRequest.onsuccess?.call(innerRequest as unknown as IDBRequest<T>, new Event('success'))
                    finish()
                  }, 0)

                  return innerRequest
                }

                return {
                  get: (key: string) => requestFor(() => storeState.records.get(key)),
                  put: (value: unknown, key?: string) => requestFor(() => {
                    const recordKey = key ?? (
                      storeState.keyPath && typeof value === 'object' && value !== null
                        ? String((value as Record<string, unknown>)[storeState.keyPath])
                        : ''
                    )
                    storeState.records.set(recordKey, value)
                    return value
                  }),
                  delete: (key: string) => requestFor(() => {
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

        request.result = db as unknown as IDBDatabase

        if (shouldUpgrade) {
          request.onupgradeneeded?.call(
            request as unknown as IDBOpenDBRequest,
            new Event('upgradeneeded') as IDBVersionChangeEvent
          )
        }

        request.onsuccess?.call(request as unknown as IDBOpenDBRequest, new Event('success'))
      }, 0)

      return request as unknown as IDBOpenDBRequest
    }
  }

  return { indexedDB }
}

function createWindowMock() {
  const storage = new Map<string, string>()
  const { indexedDB } = createIndexedDbMock()

  const localStorage: MockStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => {
      storage.set(key, value)
    },
    removeItem: (key) => {
      storage.delete(key)
    }
  }

  return {
    windowMock: {
      indexedDB,
      localStorage,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true
    },
    localStorage
  }
}

test('sessionPersistence normalizes invalid panel blocks and keeps expected defaults', () => {
  const normalized = normalizePanelBlocks({
    left: ['tools', 'unknown-block', 'palette'],
    center: ['tools', 'layers'],
    right: ['layers', 'invalid']
  })

  assert.deepEqual(normalized, {
    left: ['tools', 'palette'],
    center: ['tools'],
    right: ['layers']
  })
  assert.deepEqual(INITIAL_PANEL_BLOCKS.center, [])
})

test('sessionPersistence builds session payload for draft projects and restores it end-to-end', async () => {
  const { windowMock } = createWindowMock()
  const previousWindow = globalThis.window

  Object.defineProperty(globalThis, 'window', {
    value: windowMock,
    configurable: true,
    writable: true
  })

  try {
    const project = createProject()
    const payload = buildSessionPayload({
      currentProjectName: 'Draft Project',
      currentProjectHandle: null,
      draftProject: project,
      panelBlocks: {
        left: ['tools', 'palette'],
        center: ['tools'],
        right: ['layers']
      },
      updatedAt: '2026-08-05T15:30:00.000Z'
    })

    await saveSessionProject(payload)
    const storedPayload = await getSessionProject()
    assert.deepEqual(storedPayload, payload)

    const restoredState = resolveRestoredSessionState(storedPayload)
    assert.deepEqual(restoredState, {
      kind: 'draft-project',
      projectName: 'Draft Project',
      panelBlocks: {
        left: ['tools', 'palette'],
        center: ['tools'],
        right: ['layers']
      },
      draftProject: project
    })

    await clearSessionProject()
    assert.equal(await getSessionProject(), null)
    assert.deepEqual(resolveRestoredSessionState(null), { kind: 'empty' })
  } finally {
    Object.defineProperty(globalThis, 'window', {
      value: previousWindow,
      configurable: true,
      writable: true
    })
  }
})

test('sessionPersistence builds file-handle payload without draft project and restores file mode', () => {
  const payload = buildSessionPayload({
    currentProjectName: 'Saved Project',
    currentProjectHandle: {} as FileSystemFileHandle,
    draftProject: createProject(),
    panelBlocks: INITIAL_PANEL_BLOCKS,
    updatedAt: '2026-08-05T16:00:00.000Z'
  })

  assert.equal(payload.hasFileHandle, true)
  assert.equal(payload.draftProject, null)

  const restoredState = resolveRestoredSessionState(payload)
  assert.deepEqual(restoredState, {
    kind: 'file-handle',
    projectName: 'Saved Project',
    panelBlocks: INITIAL_PANEL_BLOCKS
  })
})
