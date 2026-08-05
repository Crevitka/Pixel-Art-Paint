import type { AnimationFrame, Layer, Tool } from '@/shared/types'
import type { AppLocale } from '@/features/i18n/model/translations'
export {
  clearSessionProject,
  clearSessionProjectHandle,
  getProjectTemplates,
  getRecentProjectById,
  getRecentProjects,
  getSessionProject,
  getSessionProjectHandle,
  saveProjectTemplate,
  saveRecentProject,
  saveSessionProject,
  saveSessionProjectHandle,
  subscribeToProjectTemplates,
  subscribeToRecentProjects
} from './projectStorage'

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

export type SerializableAnimationFrame = {
  id: string
  name: string
  layers: SerializableLayer[]
  activeLayerId: string
  nextLayerNumber: number
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
  animation?: {
    frames: SerializableAnimationFrame[]
    activeFrameId: string
    fps: number
    nextFrameNumber: number
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
      title: locale === 'ru' ? 'Ð˜ÐºÐ¾Ð½ÐºÐ° 16x16' : 'Icon 16x16',
      description: locale === 'ru'
        ? 'Ð‘Ñ‹ÑÑ‚Ñ€Ñ‹Ð¹ ÑÑ‚Ð°Ñ€Ñ‚ Ð´Ð»Ñ Ð¾Ñ‡ÐµÐ½ÑŒ Ð¼Ð°Ð»ÐµÐ½ÑŒÐºÐ¸Ñ… Ð¿Ð¸ÐºÑÐµÐ»ÑŒÐ½Ñ‹Ñ… Ð¸ÐºÐ¾Ð½Ð¾Ðº.'
        : 'A quick start for very small pixel icons.',
      size: { width: 16, height: 16 },
      paletteColors: [...defaultPalettePresets[0].colors],
      isBuiltIn: true
    },
    {
      id: 'sprite-32',
      title: locale === 'ru' ? 'Ð¡Ð¿Ñ€Ð°Ð¹Ñ‚ 32x32' : 'Sprite 32x32',
      description: locale === 'ru'
        ? 'ÐŸÐ¾Ð´Ñ…Ð¾Ð´Ð¸Ñ‚ Ð´Ð»Ñ Ð¿ÐµÑ€ÑÐ¾Ð½Ð°Ð¶ÐµÐ¹, Ð¿Ñ€ÐµÐ´Ð¼ÐµÑ‚Ð¾Ð² Ð¸ UI-ÑÐ»ÐµÐ¼ÐµÐ½Ñ‚Ð¾Ð².'
        : 'Good for characters, items, and UI elements.',
      size: { width: 32, height: 32 },
      paletteColors: [...defaultPalettePresets[2].colors],
      isBuiltIn: true
    },
    {
      id: 'scene-64',
      title: locale === 'ru' ? 'Ð¡Ñ†ÐµÐ½Ð° 64x64' : 'Scene 64x64',
      description: locale === 'ru'
        ? 'Ð”Ð»Ñ Ð±Ð¾Ð»ÐµÐµ ÑÐ»Ð¾Ð¶Ð½Ñ‹Ñ… Ð¾Ð±ÑŠÐµÐºÑ‚Ð¾Ð² Ð¸ Ð½ÐµÐ±Ð¾Ð»ÑŒÑˆÐ¸Ñ… Ð¾ÐºÑ€ÑƒÐ¶ÐµÐ½Ð¸Ð¹.'
        : 'For more complex objects and small environments.',
      size: { width: 64, height: 64 },
      paletteColors: [...defaultPalettePresets[3].colors],
      isBuiltIn: true
    },
    {
      id: 'gameboy-32',
      title: 'Game Boy 32x32',
      description: locale === 'ru'
        ? 'ÐœÐ¾Ð½Ð¾Ñ…Ñ€Ð¾Ð¼Ð½Ñ‹Ð¹ ÑˆÐ°Ð±Ð»Ð¾Ð½ Ñ Ð¿Ð°Ð»Ð¸Ñ‚Ñ€Ð¾Ð¹ Ð¿Ð¾Ð´ Ñ€ÐµÑ‚Ñ€Ð¾-ÑÐºÑ€Ð°Ð½.'
        : 'A monochrome template with a retro display palette.',
      size: { width: 32, height: 32 },
      paletteColors: [...defaultPalettePresets[1].colors],
      isBuiltIn: true
    }
  ]
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

export function serializeAnimationFrames(frames: AnimationFrame[]): SerializableAnimationFrame[] {
  return frames.map((frame) => ({
    id: frame.id,
    name: frame.name,
    layers: serializeLayers(frame.layers),
    activeLayerId: frame.activeLayerId,
    nextLayerNumber: frame.nextLayerNumber
  }))
}

export function deserializeAnimationFrames(frames: SerializableAnimationFrame[]): AnimationFrame[] {
  return frames.map((frame) => ({
    ...frame,
    layers: deserializeLayers(frame.layers)
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
