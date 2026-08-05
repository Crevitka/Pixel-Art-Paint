import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getProjectTemplates,
  getRecentProjects,
  saveProjectTemplate,
  subscribeToProjectTemplates,
  subscribeToRecentProjects,
  type RecentProjectEntry,
  type StartTemplate
} from '@/shared/lib/project'
import type { PanelBlocks, ToolbarBlockId, ToolbarPanelId } from './sessionPersistence'
import {
  INITIAL_PANEL_BLOCKS,
  PANEL_ACCEPTED_BLOCKS
} from './sessionPersistence'
import { movePanelBlock } from './appShellUtils'

type DragOverTarget = {
  panelId: ToolbarPanelId
  blockId: ToolbarBlockId | null
} | null

type ProjectFileHandle = FileSystemFileHandle | null

type UseAppShellOptions = {
  locale: 'en' | 'ru'
}

export function useAppShell(options: UseAppShellOptions) {
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [recentProjects, setRecentProjects] = useState<RecentProjectEntry[]>([])
  const [projectTemplates, setProjectTemplates] = useState<StartTemplate[]>([])
  const [currentProjectHandle, setCurrentProjectHandle] = useState<ProjectFileHandle>(null)
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null)
  const [panelBlocks, setPanelBlocks] = useState<PanelBlocks>(INITIAL_PANEL_BLOCKS)
  const [draggingBlockId, setDraggingBlockId] = useState<ToolbarBlockId | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<DragOverTarget>(null)

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
    const loadRecentProjectList = async () => {
      setRecentProjects(await getRecentProjects())
    }

    void loadRecentProjectList()

    return subscribeToRecentProjects(() => {
      void loadRecentProjectList()
    })
  }, [])

  useEffect(() => {
    const loadTemplateList = async () => {
      setProjectTemplates(await getProjectTemplates(options.locale))
    }

    void loadTemplateList()

    return subscribeToProjectTemplates(() => {
      void loadTemplateList()
    })
  }, [options.locale])

  const navigateTo = useCallback((nextPathname: '/' | '/editor') => {
    if (window.location.pathname !== nextPathname) {
      window.history.pushState({}, '', nextPathname)
    }
    setPathname(nextPathname)
  }, [])

  const blockPanelMap = useMemo(() => {
    const map = new Map<ToolbarBlockId, ToolbarPanelId>()
    panelBlocks.left.forEach((blockId) => map.set(blockId, 'left'))
    panelBlocks.center.forEach((blockId) => map.set(blockId, 'center'))
    panelBlocks.right.forEach((blockId) => map.set(blockId, 'right'))
    return map
  }, [panelBlocks])

  const moveBlock = useCallback((
    blockId: ToolbarBlockId,
    targetPanelId: ToolbarPanelId,
    targetBlockId: ToolbarBlockId | null
  ) => {
    const sourcePanelId = blockPanelMap.get(blockId)
    if (!sourcePanelId) return
    if (!PANEL_ACCEPTED_BLOCKS[targetPanelId].includes(blockId)) return

    setPanelBlocks((currentPanels) => movePanelBlock({
      currentPanels,
      blockId,
      sourcePanelId,
      targetPanelId,
      targetBlockId
    }))
  }, [blockPanelMap])

  const handleBlockDragStart = useCallback((blockId: ToolbarBlockId) => {
    setDraggingBlockId(blockId)
  }, [])

  const handleBlockDragEnd = useCallback(() => {
    setDraggingBlockId(null)
    setDragOverTarget(null)
  }, [])

  const handleBlockDragOver = useCallback((panelId: ToolbarPanelId, blockId: ToolbarBlockId | null) => {
    setDragOverTarget({ panelId, blockId })
  }, [])

  const handleBlockDrop = useCallback((panelId: ToolbarPanelId, blockId: ToolbarBlockId | null) => {
    if (!draggingBlockId) return

    moveBlock(draggingBlockId, panelId, blockId)
    setDraggingBlockId(null)
    setDragOverTarget(null)
  }, [draggingBlockId, moveBlock])

  const handleSaveTemplate = useCallback((template: Omit<StartTemplate, 'id' | 'isBuiltIn'>) => {
    void saveProjectTemplate(template)
  }, [])

  return useMemo(() => ({
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
    handleSaveTemplate,
    setPathname
  }), [
    currentProjectHandle,
    currentProjectName,
    dragOverTarget,
    draggingBlockId,
    handleBlockDragEnd,
    handleBlockDragOver,
    handleBlockDragStart,
    handleBlockDrop,
    handleSaveTemplate,
    navigateTo,
    panelBlocks,
    pathname,
    projectTemplates,
    recentProjects
  ])
}
