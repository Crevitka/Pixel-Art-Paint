import {
  deserializeAnimationFrames,
  deserializeLayers,
  readProjectFile,
  type PixelArtProject
} from '../../shared/lib/project'
import type { PanelBlocks, ToolbarBlockId, ToolbarPanelId } from './sessionPersistence'
import { INITIAL_PANEL_BLOCKS } from './sessionPersistence'

type ProjectFileHandle = FileSystemFileHandle | null

export type ApplyProjectCallbacks = {
  loadCanvasProjectState: (state: {
    canvasSize: PixelArtProject['canvas']['canvasSize']
    layers: ReturnType<typeof deserializeLayers>
    activeLayerId: string
    frames?: ReturnType<typeof deserializeAnimationFrames>
    activeFrameId?: string
    animationFps?: number
    nextFrameNumber?: number
    referenceImageUrl: string | null
    referenceOpacity: number
    referenceScale: number
    referenceOffset: {
      x: number
      y: number
    }
    isReferenceVisible: boolean
    nextLayerNumber: number
  }) => void
  loadColorProjectState: (state: PixelArtProject['colors']) => void
  loadToolProjectState: (state: PixelArtProject['tools']) => void
  setCurrentProjectHandle: (handle: ProjectFileHandle) => void
  setCurrentProjectName: (name: string | null) => void
  setPanelBlocks: (panelBlocks: PanelBlocks) => void
  setDraggingBlockId: (blockId: ToolbarBlockId | null) => void
  setDragOverTarget: (target: { panelId: ToolbarPanelId; blockId: ToolbarBlockId | null } | null) => void
  navigateToEditor: () => void
  saveRecentProject: (entry: { name: string; project: PixelArtProject }) => Promise<void>
}

export type ApplyProjectOptions = {
  recentName?: string
  projectHandle?: ProjectFileHandle
  projectName?: string | null
  panelBlocks?: PanelBlocks
  saveToRecent?: boolean
}

export function applyProjectToEditor(
  project: PixelArtProject,
  callbacks: ApplyProjectCallbacks,
  options?: ApplyProjectOptions
) {
  callbacks.loadCanvasProjectState({
    canvasSize: project.canvas.canvasSize,
    layers: deserializeLayers(project.canvas.layers),
    activeLayerId: project.canvas.activeLayerId,
    frames: project.animation?.frames ? deserializeAnimationFrames(project.animation.frames) : undefined,
    activeFrameId: project.animation?.activeFrameId,
    animationFps: project.animation?.fps,
    nextFrameNumber: project.animation?.nextFrameNumber,
    referenceImageUrl: project.canvas.referenceImageUrl,
    referenceOpacity: project.canvas.referenceOpacity,
    referenceScale: project.canvas.referenceScale,
    referenceOffset: project.canvas.referenceOffset ?? { x: 0, y: 0 },
    isReferenceVisible: project.canvas.isReferenceVisible,
    nextLayerNumber: project.canvas.nextLayerNumber
  })

  callbacks.loadColorProjectState(project.colors)
  callbacks.loadToolProjectState(project.tools)
  callbacks.setCurrentProjectHandle(options?.projectHandle ?? null)
  callbacks.setCurrentProjectName(options?.projectName ?? options?.recentName ?? null)
  callbacks.setPanelBlocks(options?.panelBlocks ?? INITIAL_PANEL_BLOCKS)
  callbacks.setDraggingBlockId(null)
  callbacks.setDragOverTarget(null)

  if (options?.recentName && options?.saveToRecent !== false) {
    void callbacks.saveRecentProject({
      name: options.recentName,
      project
    })
  }

  callbacks.navigateToEditor()
}

export async function loadProjectFromFile(file: File) {
  const project = await readProjectFile(file)
  if (project.version !== 1) {
    throw new Error('Unsupported project version')
  }

  return project
}
