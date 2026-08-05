import {
  serializeAnimationFrames,
  serializeLayers,
  serializeReferenceImage,
  type PixelArtProject
} from '../../../shared/lib/project'
import type { AnimationFrame, Layer } from '../../../shared/types'
import { buildCanvasExportPixels, buildSpriteSheetPixels } from './exportUtils'

type BuildProjectInput = {
  canvasSize: PixelArtProject['canvas']['canvasSize']
  frames: AnimationFrame[]
  activeFrameId: string
  animationFps: number
  layers: Layer[]
  activeLayerId: string
  referenceImageUrl: string | null
  referenceOpacity: number
  referenceScale: number
  referenceOffset: {
    x: number
    y: number
  }
  isReferenceVisible: boolean
  selectedColor: string
  pickerColor: string
  paletteColors: string[]
  palettePresets: PixelArtProject['colors']['palettePresets']
  activePalettePresetId: string
  selectedTool: PixelArtProject['tools']['selectedTool']
  brushSize: number
  currentProjectName: string | null
  timestamp?: string
}

export type BuiltProjectFile = {
  suggestedName: string
  project: PixelArtProject
  projectText: string
}

function getNextLayerNumber(layers: Array<{ id: string }>) {
  const maxLayerNumber = layers.reduce((maxNumber, layer) => {
    const match = /^layer-(\d+)$/.exec(layer.id)
    if (!match) return maxNumber
    return Math.max(maxNumber, Number(match[1]))
  }, 1)

  return maxLayerNumber + 1
}

function getNextFrameNumber(frames: Array<{ id: string }>) {
  const maxFrameNumber = frames.reduce((maxNumber, frame) => {
    const match = /^frame-(\d+)$/.exec(frame.id)
    if (!match) return maxNumber
    return Math.max(maxNumber, Number(match[1]))
  }, 1)

  return maxFrameNumber + 1
}

export async function buildProjectFile(input: BuildProjectInput): Promise<BuiltProjectFile> {
  const timestamp = (input.timestamp ?? new Date().toISOString()).replace(/[:.]/g, '-')
  const suggestedName =
    input.currentProjectName ?? `pixel-art-project-${input.canvasSize.width}x${input.canvasSize.height}-${timestamp}.pap.json`

  const project: PixelArtProject = {
    version: 1,
    canvas: {
      canvasSize: input.canvasSize,
      layers: serializeLayers(input.layers),
      activeLayerId: input.activeLayerId,
      referenceImageUrl: await serializeReferenceImage(input.referenceImageUrl),
      referenceOpacity: input.referenceOpacity,
      referenceScale: input.referenceScale,
      referenceOffset: input.referenceOffset,
      isReferenceVisible: input.isReferenceVisible,
      nextLayerNumber: getNextLayerNumber(input.layers)
    },
    animation: {
      frames: serializeAnimationFrames(input.frames),
      activeFrameId: input.activeFrameId,
      fps: input.animationFps,
      nextFrameNumber: getNextFrameNumber(input.frames)
    },
    colors: {
      selectedColor: input.selectedColor,
      pickerColor: input.pickerColor,
      paletteColors: [...input.paletteColors],
      palettePresets: input.palettePresets.map((preset) => ({
        ...preset,
        colors: [...preset.colors]
      })),
      activePalettePresetId: input.activePalettePresetId
    },
    tools: {
      selectedTool: input.selectedTool,
      brushSize: input.brushSize
    }
  }

  return {
    suggestedName,
    project,
    projectText: JSON.stringify(project, null, 2)
  }
}

export async function writeProjectFile(
  handle: FileSystemFileHandle,
  builtProject: BuiltProjectFile
) {
  const projectBlob = new Blob([builtProject.projectText], { type: 'application/json' })
  const writable = await handle.createWritable()
  await writable.write(projectBlob)
  await writable.close()
}

export function buildCanvasExportArtifact(options: {
  layers: BuildProjectInput['layers']
  canvasSize: BuildProjectInput['canvasSize']
  timestamp?: string
}) {
  const timestamp = (options.timestamp ?? new Date().toISOString()).replace(/[:.]/g, '-')

  return {
    suggestedName: `pixel-art-${options.canvasSize.width}x${options.canvasSize.height}-${timestamp}.png`,
    width: options.canvasSize.width,
    height: options.canvasSize.height,
    pixels: buildCanvasExportPixels(options.layers)
  }
}

export function buildSpriteSheetExportArtifact(options: {
  frames: BuildProjectInput['frames']
  canvasSize: BuildProjectInput['canvasSize']
  timestamp?: string
}) {
  const timestamp = (options.timestamp ?? new Date().toISOString()).replace(/[:.]/g, '-')
  const spriteSheet = buildSpriteSheetPixels(options.frames, options.canvasSize)

  return {
    suggestedName: `pixel-art-sprite-sheet-${options.canvasSize.width}x${options.canvasSize.height}-${timestamp}.png`,
    width: spriteSheet.width,
    height: spriteSheet.height,
    pixels: spriteSheet.pixels
  }
}
