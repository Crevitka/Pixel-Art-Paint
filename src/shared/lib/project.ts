import type { Layer, Tool } from '@/shared/types'

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
  project: PixelArtProject
}

const RECENT_PROJECTS_STORAGE_KEY = 'pixel-art-paint.recent-projects'
const RECENT_PROJECTS_EVENT = 'pixel-art-paint:recent-projects-updated'
const PROJECT_TEMPLATES_STORAGE_KEY = 'pixel-art-paint.project-templates'
const PROJECT_TEMPLATES_EVENT = 'pixel-art-paint:project-templates-updated'
const MAX_RECENT_PROJECTS = 8

export const DEFAULT_PALETTE_PRESETS: PalettePreset[] = [
  {
    id: 'basic',
    label: 'Basic',
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

export const DEFAULT_START_TEMPLATES: StartTemplate[] = [
  {
    id: 'icon-16',
    title: 'Иконка 16x16',
    description: 'Быстрый старт для очень маленьких пиксельных иконок.',
    size: { width: 16, height: 16 },
    paletteColors: [...DEFAULT_PALETTE_PRESETS[0].colors],
    isBuiltIn: true
  },
  {
    id: 'sprite-32',
    title: 'Спрайт 32x32',
    description: 'Подходит для персонажей, предметов и UI-элементов.',
    size: { width: 32, height: 32 },
    paletteColors: [...DEFAULT_PALETTE_PRESETS[2].colors],
    isBuiltIn: true
  },
  {
    id: 'scene-64',
    title: 'Сцена 64x64',
    description: 'Для более сложных объектов и небольших окружений.',
    size: { width: 64, height: 64 },
    paletteColors: [...DEFAULT_PALETTE_PRESETS[3].colors],
    isBuiltIn: true
  },
  {
    id: 'gameboy-32',
    title: 'Game Boy 32x32',
    description: 'Монохромный шаблон с палитрой под ретро-экран.',
    size: { width: 32, height: 32 },
    paletteColors: [...DEFAULT_PALETTE_PRESETS[1].colors],
    isBuiltIn: true
  }
]

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

    const parsed = JSON.parse(rawValue) as RecentProjectEntry[]
    if (!Array.isArray(parsed)) return []
    return parsed
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

export function getProjectTemplates() {
  if (typeof window === 'undefined') return [...DEFAULT_START_TEMPLATES]

  try {
    const rawValue = window.localStorage.getItem(PROJECT_TEMPLATES_STORAGE_KEY)
    const customTemplates = rawValue ? (JSON.parse(rawValue) as StartTemplate[]) : []
    if (!Array.isArray(customTemplates)) return [...DEFAULT_START_TEMPLATES]

    return [
      ...DEFAULT_START_TEMPLATES,
      ...customTemplates.filter((template) => !template.isBuiltIn)
    ]
  } catch {
    return [...DEFAULT_START_TEMPLATES]
  }
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

  const customTemplates = getProjectTemplates().filter((item) => !item.isBuiltIn)
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

export function saveRecentProject(entry: {
  name: string
  project: PixelArtProject
}) {
  if (typeof window === 'undefined') return

  const nextEntry: RecentProjectEntry = {
    id: `${entry.name}-${Date.now()}`,
    name: entry.name,
    updatedAt: new Date().toISOString(),
    project: entry.project
  }

  const nextProjects = [
    nextEntry,
    ...getRecentProjects().filter((project) => project.name !== entry.name)
  ].slice(0, MAX_RECENT_PROJECTS)

  window.localStorage.setItem(RECENT_PROJECTS_STORAGE_KEY, JSON.stringify(nextProjects))
  emitRecentProjectsUpdated()
}
