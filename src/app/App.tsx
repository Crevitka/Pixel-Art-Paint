import { useCallback, useRef, type ChangeEvent } from 'react'
import { useCanvasContext } from '@/features/canvas'
import { useColorContext } from '@/features/colors'
import { useI18nContext } from '@/features/i18n'
import { useToolContext } from '@/features/tools'
import {
  getRecentProjectById,
  saveRecentProject,
  serializeAnimationFrames,
  serializeLayers,
  serializeReferenceImage,
  type PixelArtProject,
  type StartTemplate
} from '@/shared/lib/project'
import {
  applyProjectToEditor,
  loadProjectFromFile
} from '@/app/model/projectLifecycle'
import type { PanelBlocks } from '@/app/model/sessionPersistence'
import { useAppShell } from '@/app/model/useAppShell'
import { useAppSessionPersistence } from '@/app/model/useAppSessionPersistence'
import {
  createBlankProject,
  createProjectFromTemplate,
  getLoadedProjectApplyOptions,
  getNewProjectApplyOptions,
  getRecentProjectApplyOptions
} from '@/app/model/appProjectUtils'
import { EditorPage } from '@/pages/editor'
import { WelcomePage } from '@/pages/welcome'

type OpenFilePicker = (options?: {
  multiple?: boolean
  types?: Array<{
    description?: string
    accept: Record<string, string[]>
  }>
}) => Promise<FileSystemFileHandle[]>
type ProjectFileHandle = FileSystemFileHandle | null

export function App() {
  const { locale, t } = useI18nContext()
  const {
    canvasSize,
    frames,
    activeFrameId,
    animationFps,
    layers,
    activeLayerId,
    referenceImageUrl,
    referenceOpacity,
    referenceScale,
    referenceOffset,
    isReferenceVisible,
    loadCanvasProjectState
  } = useCanvasContext()
  const {
    selectedColor,
    pickerColor,
    paletteColors,
    palettePresets,
    activePalettePresetId,
    loadColorProjectState
  } = useColorContext()
  const { selectedTool, brushSize, loadToolProjectState } = useToolContext()
  const openProjectInputRef = useRef<HTMLInputElement>(null)
  const appShell = useAppShell({ locale })
  const {
    pathname,
    navigateTo,
    recentProjects,
    projectTemplates,
    currentProjectHandle,
    currentProjectName,
    setCurrentProjectHandle,
    setCurrentProjectName,
    panelBlocks,
    setPanelBlocks,
    draggingBlockId,
    setDraggingBlockId,
    dragOverTarget,
    setDragOverTarget,
    handleBlockDragStart,
    handleBlockDragEnd,
    handleBlockDragOver,
    handleBlockDrop,
    handleSaveTemplate
  } = appShell

  const applyProject = useCallback((
    project: PixelArtProject,
    options?: {
      recentName?: string
      projectHandle?: ProjectFileHandle
      projectName?: string | null
      panelBlocks?: PanelBlocks
      saveToRecent?: boolean
    }
  ) => {
    applyProjectToEditor(project, {
      loadCanvasProjectState,
      loadColorProjectState,
      loadToolProjectState,
      setCurrentProjectHandle,
      setCurrentProjectName,
      setPanelBlocks,
      setDraggingBlockId,
      setDragOverTarget,
      navigateToEditor: () => navigateTo('/editor'),
      saveRecentProject
    }, options)
  }, [
    loadCanvasProjectState,
    loadColorProjectState,
    loadToolProjectState,
    navigateTo,
    setCurrentProjectHandle,
    setCurrentProjectName,
    setDragOverTarget,
    setDraggingBlockId,
    setPanelBlocks
  ])

  const buildCurrentProject = useCallback(async (): Promise<PixelArtProject> => ({
    version: 1,
    canvas: {
      canvasSize,
      layers: serializeLayers(layers),
      activeLayerId,
      referenceImageUrl: await serializeReferenceImage(referenceImageUrl),
      referenceOpacity,
      referenceScale,
      referenceOffset,
      isReferenceVisible,
      nextLayerNumber:
        layers.reduce((maxLayerNumber, layer) => {
          const match = /^layer-(\d+)$/.exec(layer.id)
          if (!match) return maxLayerNumber
          return Math.max(maxLayerNumber, Number(match[1]))
        }, 1) + 1
    },
    animation: {
      frames: serializeAnimationFrames(frames),
      activeFrameId,
      fps: animationFps,
      nextFrameNumber:
        frames.reduce((maxFrameNumber, frame) => {
          const match = /^frame-(\d+)$/.exec(frame.id)
          if (!match) return maxFrameNumber
          return Math.max(maxFrameNumber, Number(match[1]))
        }, 1) + 1
    },
    colors: {
      selectedColor,
      pickerColor,
      paletteColors: [...paletteColors],
      palettePresets: palettePresets.map((preset) => ({
        ...preset,
        colors: [...preset.colors]
      })),
      activePalettePresetId
    },
    tools: {
      selectedTool,
      brushSize
    }
  }), [
    activeFrameId,
    activeLayerId,
    activePalettePresetId,
    animationFps,
    brushSize,
    canvasSize,
    frames,
    isReferenceVisible,
    layers,
    paletteColors,
    palettePresets,
    pickerColor,
    referenceImageUrl,
    referenceOpacity,
    referenceScale,
    referenceOffset,
    selectedColor,
    selectedTool
  ])

  const { isSessionReady } = useAppSessionPersistence({
    pathname,
    currentProjectHandle,
    currentProjectName,
    panelBlocks,
    setCurrentProjectHandle,
    setCurrentProjectName,
    setPanelBlocks,
    applyProject,
    buildCurrentProject
  })

  const loadProjectFile = useCallback(async (
    file: File,
    projectHandle: ProjectFileHandle = null
  ) => {
    const project = await loadProjectFromFile(file)
    applyProject(project, getLoadedProjectApplyOptions(file.name, projectHandle))
  }, [applyProject])

  const handleOpenProject = async () => {
    const filePicker = (window as Window & {
      showOpenFilePicker?: OpenFilePicker
    }).showOpenFilePicker

    if (filePicker) {
      try {
        const [handle] = await filePicker({
          multiple: false,
          types: [
            {
              description: 'Pixel Art Paint project',
              accept: {
                'application/json': ['.pap.json', '.json']
              }
            }
          ]
        })

        if (!handle) return
        const file = await handle.getFile()
        await loadProjectFile(file, handle)
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
      }
    }

    openProjectInputRef.current?.click()
  }

  const handleOpenProjectInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await loadProjectFile(file)
  }

  const handleCreateProject = () => {
    applyProject(
      createBlankProject(
        t('project.blankTitle'),
        t('project.blankDescription'),
        t('project.defaultLayer', { number: 1 })
      ),
      getNewProjectApplyOptions(t('project.newProjectName'))
    )
  }

  const handleCreateFromTemplate = (template: StartTemplate) => {
    applyProject(
      createProjectFromTemplate(template, t('project.defaultLayer', { number: 1 })),
      getNewProjectApplyOptions(template.title)
    )
  }

  const handleOpenRecentProject = async (recentProject: { id: string; name: string }) => {
    const project = await getRecentProjectById(recentProject.id)
    if (!project) return

    applyProject(project, getRecentProjectApplyOptions(recentProject.name))
  }

  if (!isSessionReady && pathname === '/editor') {
    return null
  }

  if (pathname !== '/editor') {
    return (
      <>
        <input
          ref={openProjectInputRef}
          type="file"
          accept=".pap.json,.json,application/json"
          onChange={handleOpenProjectInput}
          className="hidden"
        />
        <WelcomePage
          templates={projectTemplates}
          recentProjects={recentProjects}
          onOpenProject={handleOpenProject}
          onOpenRecentProject={handleOpenRecentProject}
          onCreateProject={handleCreateProject}
          onCreateFromTemplate={handleCreateFromTemplate}
          onSaveTemplate={handleSaveTemplate}
        />
      </>
    )
  }

  return (
    <EditorPage
      currentProjectHandle={currentProjectHandle}
      currentProjectName={currentProjectName}
      onProjectFileChange={(handle, name) => {
        setCurrentProjectHandle(handle)
        setCurrentProjectName(name)
      }}
      panelBlocks={panelBlocks}
      draggingBlockId={draggingBlockId}
      dragOverTarget={dragOverTarget}
      onBlockDragStart={handleBlockDragStart}
      onBlockDragEnd={handleBlockDragEnd}
      onBlockDragOver={handleBlockDragOver}
      onBlockDrop={handleBlockDrop}
    />
  )
}
