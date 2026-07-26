import type { Layer, Tool } from '@/shared/types'
import type { AppLocale } from '@/features/i18n'

export type SerializableLayer = {
  id: string
  name: string
  visible: boolean
  pixels: Array<[string, string]>
}

export type PalettePreset = {
  id: string
  label: string
  colors: string[]
}

export type StartTemplate = {
  id: string
  title: string
  description: string
  size: {
    width: number
    height: number
  }
  paletteColors: string[]
  isBuiltIn?: boolean
}

export type PixelArtProject = {
  version: 1
  canvas: {
    canvasSize: {
      width: number
      height: number
    }
    layers: SerializableLayer[]
    activeLayerId: string
    referenceImageUrl: string | null
    referenceOpacity: number
    referenceScale: number
    referenceOffset: {
      x: number
      y: number
    }
    isReferenceVisible: boolean
    nextLayerNumber: number
  }
  colors: {
    selectedColor: string
    pickerColor: string
    paletteColors: string[]
    palettePresets: PalettePreset[]
    activePalettePresetId: string
  }
  tools: {
    selectedTool: Tool
    brushSize: number
  }
}

export type RecentProjectEntry = {
  id: string
  name: string
  updatedAt: string
  canvasSize: {
    width: number
    height: number
  }
}

const RECENT_PROJECTS_STORAGE_KEY = 'pixel-art-paint.recent-projects'
const RECENT_PROJECTS_EVENT = 'pixel-art-paint:recent-projects-updated'
const PROJECT_TEMPLATES_STORAGE_KEY = 'pixel-art-paint.project-templates'
const PROJECT_TEMPLATES_EVENT = 'pixel-art-paint:project-templates-updated'
const SESSION_PROJECT_STORAGE_KEY = 'pixel-art-paint.session-project'
const SESSION_DB_NAME = 'pixel-art-paint-session'
const SESSION_DB_VERSION = 2
const SESSION_HANDLES_STORE = 'handles'
const RECENT_PROJECTS_STORE = 'recent-projects'
const SESSION_PROJECT_HANDLE_KEY = 'current-project-handle'
const MAX_RECENT_PROJECTS = 8

export type SessionProjectState = {
  projectName: string | null
  pathname: '/' | '/editor'
  hasFileHandle: boolean
  draftProject: PixelArtProject | null
  panelBlocks?: {
    left: string[]
    center: string[]
    right: string[]
  }
  updatedAt: string
}

export function getDefaultPalettePresets(locale: AppLocale): PalettePreset[] {
  return [
    {
      id: 'basic',
      label: locale === 'ru' ? 'Basic' : 'Basic',
      colors: [
        '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
        '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080',
        '#008000', '#ffc0cb'
      ]
    },
    {
      id: 'gameboy',
      label: 'Game Boy',
      colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f']
    },
    {
      id: 'dawn',
      label: 'Dawn',
      colors: ['#1d1b2a', '#5b3558', '#b45a6f', '#f4b36a', '#f8f4e3']
    },
    {
      id: 'ocean',
      label: 'Ocean',
      colors: ['#041c32', '#04293a', '#064663', '#3b82f6', '#a5f3fc']
    }
  ]
}

export function getDefaultStartTemplates(locale: AppLocale): StartTemplate[] {
  const defaultPalettePresets = getDefaultPalettePresets(locale)

  return [
    {
      id: 'icon-16',
      title: locale === 'ru' ? 'Иконка 16x16' : 'Icon 16x16',
      description: locale === 'ru'
        ? 'Быстрый старт для очень маленьких пиксельных иконок.'
        : 'A quick start for very small pixel icons.',
      size: { width: 16, height: 16 },
      paletteColors: [...defaultPalettePresets[0].colors],
      isBuiltIn: true
    },
    {
      id: 'sprite-32',
      title: locale === 'ru' ? 'Спрайт 32x32' : 'Sprite 32x32',
      description: locale === 'ru'
        ? 'Подходит для персонажей, предметов и UI-элементов.'
        : 'Good for characters, items, and UI elements.',
      size: { width: 32, height: 32 },
      paletteColors: [...defaultPalettePresets[2].colors],
      isBuiltIn: true
    },
    {
      id: 'scene-64',
      title: locale === 'ru' ? 'Сцена 64x64' : 'Scene 64x64',
      description: locale === 'ru'
        ? 'Для более сложных объектов и небольших окружений.'
        : 'For more complex objects and small environments.',
      size: { width: 64, height: 64 },
      paletteColors: [...defaultPalettePresets[3].colors],
      isBuiltIn: true
    },
    {
      id: 'gameboy-32',
      title: 'Game Boy 32x32',
      description: locale === 'ru'
        ? 'Монохромный шаблон с палитрой под ретро-экран.'
        : 'A monochrome template with a retro display palette.',
      size: { width: 32, height: 32 },
      paletteColors: [...defaultPalettePresets[1].colors],
      isBuiltIn: true
    }
  ]
}

function getStoredCustomTemplates() {
  if (typeof window === 'undefined') return [] as StartTemplate[]

  try {
    const rawValue = window.localStorage.getItem(PROJECT_TEMPLATES_STORAGE_KEY)
    const customTemplates = rawValue ? (JSON.parse(rawValue) as StartTemplate[]) : []
    return Array.isArray(customTemplates) ? customTemplates.filter((template) => !template.isBuiltIn) : []
  } catch {
    return []
  }
}

export function serializeLayers(layers: Layer[]): SerializableLayer[] {
  return layers.map((layer) => ({
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    pixels: Array.from(layer.pixels.entries())
  }))
}

export function deserializeLayers(layers: SerializableLayer[]): Layer[] {
  return layers.map((layer) => ({
    ...layer,
    pixels: new Map(layer.pixels)
  }))
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function serializeReferenceImage(referenceImageUrl: string | null) {
  if (!referenceImageUrl) return null
  if (referenceImageUrl.startsWith('data:')) return referenceImageUrl

  const response = await fetch(referenceImageUrl)
  const blob = await response.blob()
  return blobToDataUrl(blob)
}

export function readProjectFile(file: File) {
  return new Promise<PixelArtProject>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)) as PixelArtProject)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export function getRecentProjects() {
  if (typeof window === 'undefined') return [] as RecentProjectEntry[]

  try {
    const rawValue = window.localStorage.getItem(RECENT_PROJECTS_STORAGE_KEY)
    if (!rawValue) return []

    const parsed = JSON.parse(rawValue) as Array<
      RecentProjectEntry | (RecentProjectEntry & { project?: PixelArtProject })
    >
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
        canvasSize
      }]
    })
  } catch {
    return []
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

export function getProjectTemplates(locale: AppLocale) {
  return [
    ...getDefaultStartTemplates(locale),
    ...getStoredCustomTemplates()
  ]
}

export function subscribeToProjectTemplates(listener: () => void) {
  if (typeof window === 'undefined') return () => {}

  window.addEventListener(PROJECT_TEMPLATES_EVENT, listener)
  return () => {
    window.removeEventListener(PROJECT_TEMPLATES_EVENT, listener)
  }
}

export function saveProjectTemplate(template: Omit<StartTemplate, 'id' | 'isBuiltIn'>) {
  if (typeof window === 'undefined') return

  const customTemplates = getStoredCustomTemplates()
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

  window.localStorage.setItem(PROJECT_TEMPLATES_STORAGE_KEY, JSON.stringify(nextTemplates))
  emitProjectTemplatesUpdated()
}

async function saveRecentProjectRecord(id: string, project: PixelArtProject) {
  const db = await openSessionDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(RECENT_PROJECTS_STORE, 'readwrite')
    const store = transaction.objectStore(RECENT_PROJECTS_STORE)
    store.put({ id, project })
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}

async function deleteRecentProjectRecord(id: string) {
  const db = await openSessionDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(RECENT_PROJECTS_STORE, 'readwrite')
    const store = transaction.objectStore(RECENT_PROJECTS_STORE)
    store.delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}

export async function getRecentProjectById(id: string) {
  if (typeof window === 'undefined') return null as PixelArtProject | null

  const db = await openSessionDb()
  const project = await new Promise<PixelArtProject | null>((resolve, reject) => {
    const transaction = db.transaction(RECENT_PROJECTS_STORE, 'readonly')
    const store = transaction.objectStore(RECENT_PROJECTS_STORE)
    const request = store.get(id)
    request.onsuccess = () => {
      const result = request.result as { id: string; project: PixelArtProject } | undefined
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
  if (typeof window === 'undefined') return

  const previousProjects = getRecentProjects()
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

  window.localStorage.setItem(RECENT_PROJECTS_STORAGE_KEY, JSON.stringify(nextProjects))

  await saveRecentProjectRecord(nextEntry.id, entry.project)

  const staleIds = [
    ...(replacedEntry ? [replacedEntry.id] : []),
    ...previousProjects
      .filter((project) => !nextProjects.some((nextProject) => nextProject.id === project.id))
      .map((project) => project.id)
  ]

  await Promise.all(staleIds.map((id) => deleteRecentProjectRecord(id)))
  emitRecentProjectsUpdated()
}

export function getSessionProject() {
  if (typeof window === 'undefined') return null as SessionProjectState | null

  try {
    const rawValue = window.localStorage.getItem(SESSION_PROJECT_STORAGE_KEY)
    if (!rawValue) return null

    const parsed = JSON.parse(rawValue) as SessionProjectState
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function saveSessionProject(state: SessionProjectState) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SESSION_PROJECT_STORAGE_KEY, JSON.stringify(state))
}

export function clearSessionProject() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SESSION_PROJECT_STORAGE_KEY)
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
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
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
