import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useCanvasContext } from '@/features/canvas'
import { useColorContext } from '@/features/colors'
import { useI18nContext } from '@/features/i18n'
import { useToolContext } from '@/features/tools'
import {
  clearSessionProjectHandle,
  getSessionProject,
  getSessionProjectHandle,
  getProjectTemplates,
  getRecentProjectById,
  getRecentProjects,
  saveSessionProject,
  saveSessionProjectHandle,
  saveProjectTemplate,
  saveRecentProject,
  serializeAnimationFrames,
  serializeLayers,
  serializeReferenceImage,
  subscribeToProjectTemplates,
  subscribeToRecentProjects,
  type PixelArtProject,
  type RecentProjectEntry,
  type StartTemplate
} from '@/shared/lib/project'
import {
  applyProjectToEditor,
  loadProjectFromFile
} from '@/app/model/projectLifecycle'
import {
  buildSessionPayload,
  INITIAL_PANEL_BLOCKS,
  normalizePanelBlocks,
  PANEL_ACCEPTED_BLOCKS
} from '@/app/model/sessionPersistence'
import type { PanelBlocks, ToolbarBlockId, ToolbarPanelId } from '@/app/model/sessionPersistence'
import { EditorPage } from '@/pages/editor'
import { WelcomePage } from '@/pages/welcome'

type DragOverTarget = {
  panelId: ToolbarPanelId
  blockId: ToolbarBlockId | null
} | null

type ProjectFileHandle = FileSystemFileHandle | null

type OpenFilePicker = (options?: {
  multiple?: boolean
  types?: Array<{
    description?: string
    accept: Record<string, string[]>
  }>
}) => Promise<FileSystemFileHandle[]>

function createProjectFromTemplate(template: StartTemplate, defaultLayerName: string): PixelArtProject {
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

function createBlankProject(title: string, description: string, defaultLayerName: string) {
  return createProjectFromTemplate({
    id: 'blank-32',
    title,
    description,
    size: { width: 32, height: 32 },
    paletteColors: ['#000000', '#ffffff']
  }, defaultLayerName)
}

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

  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [recentProjects, setRecentProjects] = useState<RecentProjectEntry[]>([])
  const [projectTemplates, setProjectTemplates] = useState<StartTemplate[]>([])
  const [currentProjectHandle, setCurrentProjectHandle] = useState<ProjectFileHandle>(null)
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null)
  const [panelBlocks, setPanelBlocks] = useState<PanelBlocks>(INITIAL_PANEL_BLOCKS)
  const [draggingBlockId, setDraggingBlockId] = useState<ToolbarBlockId | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<DragOverTarget>(null)
  const [isSessionReady, setIsSessionReady] = useState(false)
  const openProjectInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    const loadRecentProjects = async () => {
      setRecentProjects(await getRecentProjects())
    }

    void loadRecentProjects()

    return subscribeToRecentProjects(() => {
      void loadRecentProjects()
    })
  }, [])

  useEffect(() => {
    const loadProjectTemplates = async () => {
      setProjectTemplates(await getProjectTemplates(locale))
    }

    void loadProjectTemplates()

    return subscribeToProjectTemplates(() => {
      void loadProjectTemplates()
    })
  }, [locale])

  const navigateTo = (nextPathname: '/' | '/editor') => {
    if (window.location.pathname !== nextPathname) {
      window.history.pushState({}, '', nextPathname)
    }
    setPathname(nextPathname)
  }

  const blockPanelMap = useMemo(() => {
    const map = new Map<ToolbarBlockId, ToolbarPanelId>()
    panelBlocks.left.forEach((blockId) => map.set(blockId, 'left'))
    panelBlocks.center.forEach((blockId) => map.set(blockId, 'center'))
    panelBlocks.right.forEach((blockId) => map.set(blockId, 'right'))
    return map
  }, [panelBlocks])

  const applyProject = (
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
  }

  const loadProjectFile = async (file: File, projectHandle: ProjectFileHandle = null) => {
    const project = await loadProjectFromFile(file)
    applyProject(project, {
      recentName: file.name,
      projectHandle,
      projectName: file.name
    })
  }

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
    applyProject(createBlankProject(t('project.blankTitle'), t('project.blankDescription'), t('project.defaultLayer', { number: 1 })), {
      recentName: t('project.newProjectName'),
      projectHandle: null,
      projectName: null
    })
  }

  const handleCreateFromTemplate = (template: StartTemplate) => {
    applyProject(createProjectFromTemplate(template, t('project.defaultLayer', { number: 1 })), {
      recentName: template.title,
      projectHandle: null,
      projectName: null
    })
  }

  const handleSaveTemplate = (template: Omit<StartTemplate, 'id' | 'isBuiltIn'>) => {
    void saveProjectTemplate(template)
  }

  const handleOpenRecentProject = async (recentProject: { id: string; name: string }) => {
    const project = await getRecentProjectById(recentProject.id)
    if (!project) return

    applyProject(project, {
      recentName: recentProject.name,
      projectHandle: null,
      projectName: recentProject.name
    })
  }

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

  useEffect(() => {
    let cancelled = false

    const restoreSession = async () => {
      const sessionProject = await getSessionProject()
      if (!sessionProject || sessionProject.pathname !== '/editor') {
        setIsSessionReady(true)
        return
      }

      const restoredPanelBlocks = normalizePanelBlocks(sessionProject.panelBlocks)

      if (sessionProject.hasFileHandle) {
        try {
          const handle = await getSessionProjectHandle()
          if (handle) {
            const file = await handle.getFile()
            const project = await loadProjectFromFile(file)
            if (!cancelled) {
              applyProject(project, {
                projectHandle: handle,
                projectName: sessionProject.projectName ?? file.name,
                panelBlocks: restoredPanelBlocks,
                saveToRecent: false
              })
              setIsSessionReady(true)
              return
            }
          }
        } catch {
          await clearSessionProjectHandle()
        }
      }

      if (sessionProject.draftProject && !cancelled) {
        applyProject(sessionProject.draftProject, {
          projectHandle: null,
          projectName: sessionProject.projectName,
          panelBlocks: restoredPanelBlocks,
          saveToRecent: false
        })
      }

      setIsSessionReady(true)
    }

    void restoreSession()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isSessionReady) return
    if (pathname !== '/editor') return

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const sessionPayload = buildSessionPayload({
          currentProjectName,
          currentProjectHandle,
          draftProject: await buildCurrentProject(),
          panelBlocks
        })

        await saveSessionProject(sessionPayload)

        if (currentProjectHandle) {
          await saveSessionProjectHandle(currentProjectHandle)
        } else {
          await clearSessionProjectHandle()
        }
      })()
    }, 700)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    activeLayerId,
    activePalettePresetId,
    brushSize,
    buildCurrentProject,
    canvasSize,
    currentProjectHandle,
    currentProjectName,
    isReferenceVisible,
    layers,
    paletteColors,
    palettePresets,
    panelBlocks,
    pathname,
    pickerColor,
    referenceImageUrl,
    referenceOpacity,
    referenceScale,
    isSessionReady,
    selectedColor,
    selectedTool
  ])

  const moveBlock = (blockId: ToolbarBlockId, targetPanelId: ToolbarPanelId, targetBlockId: ToolbarBlockId | null) => {
    const sourcePanelId = blockPanelMap.get(blockId)
    if (!sourcePanelId) return
    if (!PANEL_ACCEPTED_BLOCKS[targetPanelId].includes(blockId)) return

    setPanelBlocks((currentPanels) => {
      const sourcePanelBlocks = currentPanels[sourcePanelId]
      const sourceIndex = sourcePanelBlocks.indexOf(blockId)
      const nextPanels: PanelBlocks = {
        left: currentPanels.left.filter((id) => id !== blockId),
        center: currentPanels.center.filter((id) => id !== blockId),
        right: currentPanels.right.filter((id) => id !== blockId)
      }

      const targetPanelBlocks = [...nextPanels[targetPanelId]]
      const rawTargetIndex = targetBlockId ? targetPanelBlocks.indexOf(targetBlockId) : -1

      let targetIndex = rawTargetIndex
      if (
        sourcePanelId === targetPanelId &&
        targetBlockId &&
        sourceIndex !== -1 &&
        rawTargetIndex !== -1 &&
        sourceIndex < currentPanels[targetPanelId].indexOf(targetBlockId)
      ) {
        targetIndex = rawTargetIndex + 1
      }

      if (targetIndex === -1) {
        targetPanelBlocks.push(blockId)
      } else {
        targetPanelBlocks.splice(targetIndex, 0, blockId)
      }

      nextPanels[targetPanelId] = targetPanelBlocks
      return nextPanels
    })
  }

  const handleBlockDragStart = (blockId: ToolbarBlockId) => {
    setDraggingBlockId(blockId)
  }

  const handleBlockDragEnd = () => {
    setDraggingBlockId(null)
    setDragOverTarget(null)
  }

  const handleBlockDragOver = (panelId: ToolbarPanelId, blockId: ToolbarBlockId | null) => {
    setDragOverTarget({ panelId, blockId })
  }

  const handleBlockDrop = (panelId: ToolbarPanelId, blockId: ToolbarBlockId | null) => {
    if (!draggingBlockId) return

    moveBlock(draggingBlockId, panelId, blockId)
    setDraggingBlockId(null)
    setDragOverTarget(null)
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
