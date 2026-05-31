import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useCanvasContext } from '@/features/canvas'
import { useColorContext } from '@/features/colors'
import { useToolContext } from '@/features/tools'
import {
  deserializeLayers,
  getProjectTemplates,
  getRecentProjects,
  readProjectFile,
  saveProjectTemplate,
  saveRecentProject,
  subscribeToProjectTemplates,
  subscribeToRecentProjects,
  type PixelArtProject,
  type StartTemplate
} from '@/shared/lib/project'
import { EditorPage } from '@/pages/editor'
import { WelcomePage } from '@/pages/welcome'
import type { ToolbarBlockId, ToolbarPanelId } from '@/widgets/toolbar'

type DragOverTarget = {
  panelId: ToolbarPanelId
  blockId: ToolbarBlockId | null
} | null

type PanelBlocks = Record<ToolbarPanelId, ToolbarBlockId[]>

type ProjectFileHandle = FileSystemFileHandle | null

type OpenFilePicker = (options?: {
  multiple?: boolean
  types?: Array<{
    description?: string
    accept: Record<string, string[]>
  }>
}) => Promise<FileSystemFileHandle[]>

const INITIAL_PANEL_BLOCKS: PanelBlocks = {
  left: ['tools', 'canvas', 'palette', 'brush', 'layers'],
  center: [],
  right: []
}

const PANEL_ACCEPTED_BLOCKS: Record<ToolbarPanelId, ToolbarBlockId[]> = {
  left: ['tools', 'canvas', 'palette', 'brush', 'layers'],
  center: ['tools'],
  right: ['tools', 'canvas', 'palette', 'brush', 'layers']
}

function createProjectFromTemplate(template: StartTemplate): PixelArtProject {
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
          name: 'Слой 1',
          visible: true,
          pixels: []
        }
      ],
      activeLayerId: 'layer-1',
      referenceImageUrl: null,
      referenceOpacity: 0.45,
      referenceScale: 1,
      isReferenceVisible: true,
      nextLayerNumber: 2
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

function createBlankProject() {
  return createProjectFromTemplate({
    id: 'blank-32',
    title: 'Пустой 32x32',
    description: 'Пустой холст для нового проекта.',
    size: { width: 32, height: 32 },
    paletteColors: ['#000000', '#ffffff']
  })
}

export function App() {
  const { loadCanvasProjectState } = useCanvasContext()
  const { loadColorProjectState } = useColorContext()
  const { loadToolProjectState } = useToolContext()

  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [recentProjects, setRecentProjects] = useState(() => getRecentProjects())
  const [projectTemplates, setProjectTemplates] = useState(() => getProjectTemplates())
  const [currentProjectHandle, setCurrentProjectHandle] = useState<ProjectFileHandle>(null)
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null)
  const [panelBlocks, setPanelBlocks] = useState<PanelBlocks>(INITIAL_PANEL_BLOCKS)
  const [draggingBlockId, setDraggingBlockId] = useState<ToolbarBlockId | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<DragOverTarget>(null)
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
    return subscribeToRecentProjects(() => {
      setRecentProjects(getRecentProjects())
    })
  }, [])

  useEffect(() => {
    return subscribeToProjectTemplates(() => {
      setProjectTemplates(getProjectTemplates())
    })
  }, [])

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
    }
  ) => {
    loadCanvasProjectState({
      canvasSize: project.canvas.canvasSize,
      layers: deserializeLayers(project.canvas.layers),
      activeLayerId: project.canvas.activeLayerId,
      referenceImageUrl: project.canvas.referenceImageUrl,
      referenceOpacity: project.canvas.referenceOpacity,
      referenceScale: project.canvas.referenceScale,
      isReferenceVisible: project.canvas.isReferenceVisible,
      nextLayerNumber: project.canvas.nextLayerNumber
    })

    loadColorProjectState(project.colors)
    loadToolProjectState(project.tools)
    setCurrentProjectHandle(options?.projectHandle ?? null)
    setCurrentProjectName(options?.projectName ?? options?.recentName ?? null)
    setPanelBlocks(INITIAL_PANEL_BLOCKS)
    setDraggingBlockId(null)
    setDragOverTarget(null)

    if (options?.recentName) {
      saveRecentProject({
        name: options.recentName,
        project
      })
      setRecentProjects(getRecentProjects())
    }

    navigateTo('/editor')
  }

  const loadProjectFile = async (file: File, projectHandle: ProjectFileHandle = null) => {
    const project = await readProjectFile(file)
    if (project.version !== 1) {
      throw new Error('Unsupported project version')
    }
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
    applyProject(createBlankProject(), {
      recentName: 'Новый проект',
      projectHandle: null,
      projectName: null
    })
  }

  const handleCreateFromTemplate = (template: StartTemplate) => {
    applyProject(createProjectFromTemplate(template), {
      recentName: template.title,
      projectHandle: null,
      projectName: null
    })
  }

  const handleSaveTemplate = (template: Omit<StartTemplate, 'id' | 'isBuiltIn'>) => {
    saveProjectTemplate(template)
    setProjectTemplates(getProjectTemplates())
  }

  const handleOpenRecentProject = (project: PixelArtProject, name: string) => {
    applyProject(project, {
      recentName: name,
      projectHandle: null,
      projectName: name
    })
  }

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
