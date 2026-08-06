import { INITIAL_PANEL_BLOCKS, type PanelBlocks } from './sessionPersistence'
import type { PixelArtProject, StartTemplate } from '@/shared/lib/project'

type ProjectFileHandle = FileSystemFileHandle | null

export type ApplyProjectInputOptions = {
  recentName?: string
  projectHandle?: ProjectFileHandle
  projectName?: string | null
  panelBlocks?: PanelBlocks
  saveToRecent?: boolean
}

export function createProjectFromTemplate(template: StartTemplate, defaultLayerName: string): PixelArtProject {
  const templateColors = template.paletteColors.length > 0
    ? [...template.paletteColors]
    : ['#000000', '#ffffff']

  return {
    version: 1,
    canvas: {
      canvasSize: template.size,
      layers: [
        {
          id: 'layer-1',
          name: defaultLayerName,
          visible: true,
          pixels: []
        }
      ],
      activeLayerId: 'layer-1',
      referenceImageUrl: null,
      referenceOpacity: 0.45,
      referenceScale: 1,
      referenceOffset: { x: 0, y: 0 },
      isReferenceVisible: true,
      nextLayerNumber: 2
    },
    animation: {
      frames: [
        {
          id: 'frame-1',
          name: 'Frame 1',
          layers: [
            {
              id: 'layer-1',
              name: defaultLayerName,
              visible: true,
              pixels: []
            }
          ],
          activeLayerId: 'layer-1',
          nextLayerNumber: 2
        }
      ],
      activeFrameId: 'frame-1',
      fps: 8,
      nextFrameNumber: 2
    },
    colors: {
      selectedColor: templateColors[0],
      pickerColor: templateColors[0],
      paletteColors: templateColors,
      palettePresets: [
        {
          id: template.id,
          label: template.title,
          colors: templateColors
        }
      ],
      activePalettePresetId: template.id
    },
    tools: {
      selectedTool: 'pencil',
      brushSize: 1
    }
  }
}

export function createBlankProject(title: string, description: string, defaultLayerName: string) {
  return createProjectFromTemplate({
    id: 'blank-32',
    title,
    description,
    size: { width: 32, height: 32 },
    paletteColors: ['#000000', '#ffffff']
  }, defaultLayerName)
}

export function getNewProjectApplyOptions(recentName: string): ApplyProjectInputOptions {
  return {
    recentName,
    projectHandle: null,
    projectName: null,
    panelBlocks: INITIAL_PANEL_BLOCKS
  }
}

export function getLoadedProjectApplyOptions(
  fileName: string,
  projectHandle: ProjectFileHandle = null
): ApplyProjectInputOptions {
  return {
    recentName: fileName,
    projectHandle,
    projectName: fileName
  }
}

export function getRecentProjectApplyOptions(projectName: string): ApplyProjectInputOptions {
  return {
    recentName: projectName,
    projectHandle: null,
    projectName
  }
}
