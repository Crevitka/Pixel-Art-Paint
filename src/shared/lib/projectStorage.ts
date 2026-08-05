import type { AppLocale } from '@/features/i18n/model/translations'
import type {
  PixelArtProject,
  RecentProjectEntry,
  SessionProjectState,
  StartTemplate
} from './project'
import { getDefaultStartTemplates } from './project'

type LegacyRecentProjectEntry =
  | RecentProjectEntry
  | (RecentProjectEntry & { project?: PixelArtProject })

type RecentProjectRecord = RecentProjectEntry & {
  project: PixelArtProject | null
}

type TemplateRecord = StartTemplate

type SessionProjectRecord = {
  id: 'current-session'
  state: SessionProjectState
}

const RECENT_PROJECTS_STORAGE_KEY = 'pixel-art-paint.recent-projects'
const RECENT_PROJECTS_EVENT = 'pixel-art-paint:recent-projects-updated'
const PROJECT_TEMPLATES_STORAGE_KEY = 'pixel-art-paint.project-templates'
const PROJECT_TEMPLATES_EVENT = 'pixel-art-paint:project-templates-updated'
const SESSION_PROJECT_STORAGE_KEY = 'pixel-art-paint.session-project'
const SESSION_DB_NAME = 'pixel-art-paint-session'
const SESSION_DB_VERSION = 3
const SESSION_HANDLES_STORE = 'handles'
const RECENT_PROJECTS_STORE = 'recent-projects'
const PROJECT_TEMPLATES_STORE = 'project-templates'
const SESSION_PROJECT_STORE = 'session-project'
const SESSION_PROJECT_HANDLE_KEY = 'current-project-handle'
const SESSION_PROJECT_RECORD_KEY = 'current-session'
const MAX_RECENT_PROJECTS = 8

let recentProjectsMigrationPromise: Promise<void> | null = null
let projectTemplatesMigrationPromise: Promise<void> | null = null
let sessionProjectMigrationPromise: Promise<void> | null = null

function safeLocalStorageSetItem(key: string, value: string) {
  if (typeof window === 'undefined') return false

  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function safeLocalStorageRemoveItem(key: string) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage cleanup failures.
  }
}

function parseLegacyRecentProjects(rawValue: string | null) {
  if (!rawValue) return [] as LegacyRecentProjectEntry[]

  try {
    const parsed = JSON.parse(rawValue) as LegacyRecentProjectEntry[]
    if (!Array.isArray(parsed)) return []

    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []

      const canvasSize =
        'canvasSize' in entry && entry.canvasSize
          ? entry.canvasSize
          : 'project' in entry && entry.project
            ? entry.project.canvas.canvasSize
            : null

      if (
        !canvasSize ||
        typeof canvasSize.width !== 'number' ||
        typeof canvasSize.height !== 'number'
      ) {
        return []
      }

      return [{
        id: entry.id,
        name: entry.name,
        updatedAt: entry.updatedAt,
        canvasSize,
        project: 'project' in entry ? entry.project ?? null : null
      }]
    })
  } catch {
    return []
  }
}

function getLegacyRecentProjects() {
  if (typeof window === 'undefined') return [] as LegacyRecentProjectEntry[]
  return parseLegacyRecentProjects(window.localStorage.getItem(RECENT_PROJECTS_STORAGE_KEY))
}

function getLegacyEntryProject(entry: LegacyRecentProjectEntry) {
  return 'project' in entry ? entry.project ?? null : null
}

function toRecentProjectEntry(entry: LegacyRecentProjectEntry) {
  return {
    id: entry.id,
    name: entry.name,
    updatedAt: entry.updatedAt,
    canvasSize: entry.canvasSize
  } satisfies RecentProjectEntry
}

function parseLegacyProjectTemplates(rawValue: string | null) {
  if (!rawValue) return [] as StartTemplate[]

  try {
    const parsed = JSON.parse(rawValue) as StartTemplate[]
    return Array.isArray(parsed) ? parsed.filter((template) => !template.isBuiltIn) : []
  } catch {
    return []
  }
}

function getLegacyProjectTemplates() {
  if (typeof window === 'undefined') return [] as StartTemplate[]
  return parseLegacyProjectTemplates(window.localStorage.getItem(PROJECT_TEMPLATES_STORAGE_KEY))
}

function parseLegacySessionProject(rawValue: string | null) {
  if (!rawValue) return null as SessionProjectState | null

  try {
    const parsed = JSON.parse(rawValue) as SessionProjectState
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function getLegacySessionProject() {
  if (typeof window === 'undefined') return null as SessionProjectState | null
  return parseLegacySessionProject(window.localStorage.getItem(SESSION_PROJECT_STORAGE_KEY))
}

function openSessionDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(SESSION_DB_NAME, SESSION_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SESSION_HANDLES_STORE)) {
        db.createObjectStore(SESSION_HANDLES_STORE)
      }
      if (!db.objectStoreNames.contains(RECENT_PROJECTS_STORE)) {
        db.createObjectStore(RECENT_PROJECTS_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(PROJECT_TEMPLATES_STORE)) {
        db.createObjectStore(PROJECT_TEMPLATES_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(SESSION_PROJECT_STORE)) {
        db.createObjectStore(SESSION_PROJECT_STORE, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readRecentProjectRecords() {
  if (typeof window === 'undefined' || !window.indexedDB) return [] as RecentProjectRecord[]

  const db = await openSessionDb()
  const records = await new Promise<RecentProjectRecord[]>((resolve, reject) => {
    const transaction = db.transaction(RECENT_PROJECTS_STORE, 'readonly')
    const store = transaction.objectStore(RECENT_PROJECTS_STORE)
    const request = store.getAll()
    request.onsuccess = () => {
      resolve((request.result as RecentProjectRecord[] | undefined) ?? [])
    }
    request.onerror = () => reject(request.error)
  })
  db.close()

  return records
    .filter((record) => (
      record &&
      typeof record.id === 'string' &&
      typeof record.name === 'string' &&
      typeof record.updatedAt === 'string' &&
      typeof record.canvasSize?.width === 'number' &&
      typeof record.canvasSize?.height === 'number'
    ))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

async function readProjectTemplateRecords() {
  if (typeof window === 'undefined' || !window.indexedDB) return [] as TemplateRecord[]

  const db = await openSessionDb()
  const records = await new Promise<TemplateRecord[]>((resolve, reject) => {
    const transaction = db.transaction(PROJECT_TEMPLATES_STORE, 'readonly')
    const store = transaction.objectStore(PROJECT_TEMPLATES_STORE)
    const request = store.getAll()
    request.onsuccess = () => resolve((request.result as TemplateRecord[] | undefined) ?? [])
    request.onerror = () => reject(request.error)
  })
  db.close()

  return records.filter((template) => (
    template &&
    typeof template.id === 'string' &&
    typeof template.title === 'string' &&
    typeof template.description === 'string' &&
    typeof template.size?.width === 'number' &&
    typeof template.size?.height === 'number' &&
    Array.isArray(template.paletteColors) &&
    template.isBuiltIn !== true
  ))
}

async function migrateLegacyRecentProjectsToIndexedDb() {
  if (typeof window === 'undefined' || !window.indexedDB) return

  if (recentProjectsMigrationPromise) {
    await recentProjectsMigrationPromise
    return
  }

  recentProjectsMigrationPromise = (async () => {
    const legacyProjects = getLegacyRecentProjects()
    if (legacyProjects.length === 0) return

    const db = await openSessionDb()
    const existingRecords = await new Promise<RecentProjectRecord[]>((resolve, reject) => {
      const transaction = db.transaction(RECENT_PROJECTS_STORE, 'readonly')
      const store = transaction.objectStore(RECENT_PROJECTS_STORE)
      const request = store.getAll()
      request.onsuccess = () => {
        resolve((request.result as RecentProjectRecord[] | undefined) ?? [])
      }
      request.onerror = () => reject(request.error)
    })

    const existingRecordMap = new Map(existingRecords.map((record) => [record.id, record]))

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(RECENT_PROJECTS_STORE, 'readwrite')
      const store = transaction.objectStore(RECENT_PROJECTS_STORE)

      legacyProjects.forEach((entry) => {
        const existingRecord = existingRecordMap.get(entry.id)
        const nextRecord: RecentProjectRecord = {
          id: entry.id,
          name: entry.name,
          updatedAt: entry.updatedAt,
          canvasSize: entry.canvasSize,
          project: existingRecord?.project ?? getLegacyEntryProject(entry)
        }

        store.put(nextRecord)
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })

    db.close()
    safeLocalStorageRemoveItem(RECENT_PROJECTS_STORAGE_KEY)
  })()

  try {
    await recentProjectsMigrationPromise
  } finally {
    recentProjectsMigrationPromise = null
  }
}

async function migrateLegacyProjectTemplatesToIndexedDb() {
  if (typeof window === 'undefined' || !window.indexedDB) return

  if (projectTemplatesMigrationPromise) {
    await projectTemplatesMigrationPromise
    return
  }

  projectTemplatesMigrationPromise = (async () => {
    const legacyTemplates = getLegacyProjectTemplates()
    if (legacyTemplates.length === 0) return

    const db = await openSessionDb()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(PROJECT_TEMPLATES_STORE, 'readwrite')
      const store = transaction.objectStore(PROJECT_TEMPLATES_STORE)

      legacyTemplates.forEach((template) => {
        store.put({
          ...template,
          isBuiltIn: false
        } satisfies TemplateRecord)
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
    safeLocalStorageRemoveItem(PROJECT_TEMPLATES_STORAGE_KEY)
  })()

  try {
    await projectTemplatesMigrationPromise
  } finally {
    projectTemplatesMigrationPromise = null
  }
}

async function migrateLegacySessionProjectToIndexedDb() {
  if (typeof window === 'undefined' || !window.indexedDB) return

  if (sessionProjectMigrationPromise) {
    await sessionProjectMigrationPromise
    return
  }

  sessionProjectMigrationPromise = (async () => {
    const legacyState = getLegacySessionProject()
    if (!legacyState) return

    const db = await openSessionDb()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(SESSION_PROJECT_STORE, 'readwrite')
      const store = transaction.objectStore(SESSION_PROJECT_STORE)
      store.put({
        id: SESSION_PROJECT_RECORD_KEY,
        state: legacyState
      } satisfies SessionProjectRecord)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
    safeLocalStorageRemoveItem(SESSION_PROJECT_STORAGE_KEY)
  })()

  try {
    await sessionProjectMigrationPromise
  } finally {
    sessionProjectMigrationPromise = null
  }
}

function emitRecentProjectsUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(RECENT_PROJECTS_EVENT))
}

function emitProjectTemplatesUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PROJECT_TEMPLATES_EVENT))
}

export function subscribeToRecentProjects(listener: () => void) {
  if (typeof window === 'undefined') return () => {}

  window.addEventListener(RECENT_PROJECTS_EVENT, listener)
  return () => {
    window.removeEventListener(RECENT_PROJECTS_EVENT, listener)
  }
}

export function subscribeToProjectTemplates(listener: () => void) {
  if (typeof window === 'undefined') return () => {}

  window.addEventListener(PROJECT_TEMPLATES_EVENT, listener)
  return () => {
    window.removeEventListener(PROJECT_TEMPLATES_EVENT, listener)
  }
}

export async function getRecentProjects() {
  if (typeof window === 'undefined') return [] as RecentProjectEntry[]

  if (!window.indexedDB) {
    return getLegacyRecentProjects().map(toRecentProjectEntry)
  }

  try {
    await migrateLegacyRecentProjectsToIndexedDb()
    const records = await readRecentProjectRecords()
    return records.map(({ project: _project, ...entry }) => entry)
  } catch {
    return getLegacyRecentProjects().map(toRecentProjectEntry)
  }
}

export async function getRecentProjectById(id: string) {
  if (typeof window === 'undefined') return null as PixelArtProject | null

  if (!window.indexedDB) {
    const legacyEntry = getLegacyRecentProjects().find((entry) => entry.id === id)
    return legacyEntry ? getLegacyEntryProject(legacyEntry) : null
  }

  await migrateLegacyRecentProjectsToIndexedDb()
  const db = await openSessionDb()
  const project = await new Promise<PixelArtProject | null>((resolve, reject) => {
    const transaction = db.transaction(RECENT_PROJECTS_STORE, 'readonly')
    const store = transaction.objectStore(RECENT_PROJECTS_STORE)
    const request = store.get(id)
    request.onsuccess = () => {
      const result = request.result as RecentProjectRecord | undefined
      resolve(result?.project ?? null)
    }
    request.onerror = () => reject(request.error)
  })
  db.close()
  return project
}

export async function saveRecentProject(entry: {
  name: string
  project: PixelArtProject
}) {
  if (typeof window === 'undefined' || !window.indexedDB) return

  await migrateLegacyRecentProjectsToIndexedDb()
  const previousProjects = await getRecentProjects()
  const previousRecords = await readRecentProjectRecords()
  const previousRecordMap = new Map(previousRecords.map((record) => [record.id, record]))
  const replacedEntry = previousProjects.find((project) => project.name === entry.name) ?? null
  const nextEntry: RecentProjectEntry = {
    id: `${entry.name}-${Date.now()}`,
    name: entry.name,
    updatedAt: new Date().toISOString(),
    canvasSize: entry.project.canvas.canvasSize
  }

  const nextProjects = [
    nextEntry,
    ...previousProjects.filter((project) => project.name !== entry.name)
  ].slice(0, MAX_RECENT_PROJECTS)

  const db = await openSessionDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(RECENT_PROJECTS_STORE, 'readwrite')
    const store = transaction.objectStore(RECENT_PROJECTS_STORE)

    nextProjects.forEach((projectEntry) => {
      store.put({
        ...projectEntry,
        project: projectEntry.id === nextEntry.id
          ? entry.project
          : previousRecordMap.get(projectEntry.id)?.project ?? null
      } satisfies RecentProjectRecord)
    })

    const staleIds = [
      ...(replacedEntry ? [replacedEntry.id] : []),
      ...previousProjects
        .filter((project) => !nextProjects.some((nextProject) => nextProject.id === project.id))
        .map((project) => project.id)
    ]

    staleIds.forEach((id) => {
      store.delete(id)
    })

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()

  emitRecentProjectsUpdated()
}

export async function getProjectTemplates(locale: AppLocale) {
  const customTemplates = typeof window === 'undefined'
    ? [] as StartTemplate[]
    : !window.indexedDB
      ? getLegacyProjectTemplates()
      : await (async () => {
          try {
            await migrateLegacyProjectTemplatesToIndexedDb()
            return await readProjectTemplateRecords()
          } catch {
            return getLegacyProjectTemplates()
          }
        })()

  return [
    ...getDefaultStartTemplates(locale),
    ...customTemplates
  ]
}

export async function saveProjectTemplate(template: Omit<StartTemplate, 'id' | 'isBuiltIn'>) {
  if (typeof window === 'undefined') return

  const customTemplates = window.indexedDB
    ? await (async () => {
        try {
          await migrateLegacyProjectTemplatesToIndexedDb()
          return await readProjectTemplateRecords()
        } catch {
          return getLegacyProjectTemplates()
        }
      })()
    : getLegacyProjectTemplates()

  const nextTemplate: StartTemplate = {
    ...template,
    id: `custom-template-${Date.now()}`,
    paletteColors: [...template.paletteColors],
    isBuiltIn: false
  }

  const nextTemplates = [
    nextTemplate,
    ...customTemplates.filter((item) => item.title !== template.title)
  ]

  if (window.indexedDB) {
    const db = await openSessionDb()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(PROJECT_TEMPLATES_STORE, 'readwrite')
      const store = transaction.objectStore(PROJECT_TEMPLATES_STORE)

      nextTemplates.forEach((item) => {
        store.put({
          ...item,
          isBuiltIn: false
        } satisfies TemplateRecord)
      })

      customTemplates
        .filter((item) => !nextTemplates.some((nextTemplateItem) => nextTemplateItem.id === item.id))
        .forEach((item) => {
          store.delete(item.id)
        })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
  } else {
    const didSave = safeLocalStorageSetItem(
      PROJECT_TEMPLATES_STORAGE_KEY,
      JSON.stringify(nextTemplates)
    )

    if (!didSave) return
  }

  emitProjectTemplatesUpdated()
}

export async function getSessionProject() {
  if (typeof window === 'undefined') return null as SessionProjectState | null

  if (!window.indexedDB) {
    return getLegacySessionProject()
  }

  try {
    await migrateLegacySessionProjectToIndexedDb()
    const db = await openSessionDb()
    const sessionProject = await new Promise<SessionProjectState | null>((resolve, reject) => {
      const transaction = db.transaction(SESSION_PROJECT_STORE, 'readonly')
      const store = transaction.objectStore(SESSION_PROJECT_STORE)
      const request = store.get(SESSION_PROJECT_RECORD_KEY)
      request.onsuccess = () => {
        const result = request.result as SessionProjectRecord | undefined
        resolve(result?.state ?? null)
      }
      request.onerror = () => reject(request.error)
    })
    db.close()
    return sessionProject
  } catch {
    return getLegacySessionProject()
  }
}

export async function saveSessionProject(state: SessionProjectState) {
  if (typeof window === 'undefined') return

  if (window.indexedDB) {
    await migrateLegacySessionProjectToIndexedDb()
    const db = await openSessionDb()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(SESSION_PROJECT_STORE, 'readwrite')
      const store = transaction.objectStore(SESSION_PROJECT_STORE)
      store.put({
        id: SESSION_PROJECT_RECORD_KEY,
        state
      } satisfies SessionProjectRecord)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
    return
  }

  const fullState = JSON.stringify(state)
  if (safeLocalStorageSetItem(SESSION_PROJECT_STORAGE_KEY, fullState)) return

  if (!state.draftProject) return

  const fallbackState: SessionProjectState = {
    ...state,
    draftProject: null,
    hasFileHandle: false
  }

  safeLocalStorageSetItem(SESSION_PROJECT_STORAGE_KEY, JSON.stringify(fallbackState))
}

export async function clearSessionProject() {
  if (typeof window === 'undefined') return

  if (window.indexedDB) {
    const db = await openSessionDb()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(SESSION_PROJECT_STORE, 'readwrite')
      const store = transaction.objectStore(SESSION_PROJECT_STORE)
      store.delete(SESSION_PROJECT_RECORD_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
  }

  safeLocalStorageRemoveItem(SESSION_PROJECT_STORAGE_KEY)
}

export async function saveSessionProjectHandle(handle: FileSystemFileHandle) {
  if (typeof window === 'undefined') return

  const db = await openSessionDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SESSION_HANDLES_STORE, 'readwrite')
    const store = transaction.objectStore(SESSION_HANDLES_STORE)
    store.put(handle, SESSION_PROJECT_HANDLE_KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}

export async function getSessionProjectHandle() {
  if (typeof window === 'undefined') return null as FileSystemFileHandle | null

  const db = await openSessionDb()
  const handle = await new Promise<FileSystemFileHandle | null>((resolve, reject) => {
    const transaction = db.transaction(SESSION_HANDLES_STORE, 'readonly')
    const store = transaction.objectStore(SESSION_HANDLES_STORE)
    const request = store.get(SESSION_PROJECT_HANDLE_KEY)
    request.onsuccess = () => resolve((request.result as FileSystemFileHandle | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return handle
}

export async function clearSessionProjectHandle() {
  if (typeof window === 'undefined') return

  const db = await openSessionDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SESSION_HANDLES_STORE, 'readwrite')
    const store = transaction.objectStore(SESSION_HANDLES_STORE)
    store.delete(SESSION_PROJECT_HANDLE_KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}
