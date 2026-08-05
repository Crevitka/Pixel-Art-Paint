import type { PixelArtProject, SessionProjectState } from '../../shared/lib/project'

export type ToolbarPanelId = 'left' | 'center' | 'right'

export type ToolbarBlockId = 'tools' | 'reference' | 'palette' | 'brush' | 'layers'

export type PanelBlocks = Record<ToolbarPanelId, ToolbarBlockId[]>

type RawPanelBlocks = Record<ToolbarPanelId, string[]>

export const INITIAL_PANEL_BLOCKS: PanelBlocks = {
  left: ['tools', 'reference', 'palette', 'brush', 'layers'],
  center: [],
  right: []
}

export const PANEL_ACCEPTED_BLOCKS: Record<ToolbarPanelId, ToolbarBlockId[]> = {
  left: ['tools', 'reference', 'palette', 'brush', 'layers'],
  center: ['tools'],
  right: ['tools', 'reference', 'palette', 'brush', 'layers']
}

export function normalizePanelBlocks(rawPanelBlocks?: RawPanelBlocks): PanelBlocks {
  if (!rawPanelBlocks) return INITIAL_PANEL_BLOCKS

  const normalizePanel = (panelId: ToolbarPanelId) =>
    rawPanelBlocks[panelId].filter((blockId): blockId is ToolbarBlockId =>
      PANEL_ACCEPTED_BLOCKS[panelId].includes(blockId as ToolbarBlockId)
    )

  return {
    left: normalizePanel('left'),
    center: normalizePanel('center'),
    right: normalizePanel('right')
  }
}

export function buildSessionPayload(options: {
  currentProjectName: string | null
  currentProjectHandle: FileSystemFileHandle | null
  draftProject: PixelArtProject | null
  panelBlocks: PanelBlocks
  updatedAt?: string
}): SessionProjectState {
  return {
    projectName: options.currentProjectName,
    pathname: '/editor',
    hasFileHandle: Boolean(options.currentProjectHandle),
    draftProject: options.currentProjectHandle ? null : options.draftProject,
    panelBlocks: options.panelBlocks,
    updatedAt: options.updatedAt ?? new Date().toISOString()
  }
}

export type RestoredSessionState =
  | {
      kind: 'empty'
    }
  | {
      kind: 'file-handle'
      projectName: string | null
      panelBlocks: PanelBlocks
    }
  | {
      kind: 'draft-project'
      projectName: string | null
      panelBlocks: PanelBlocks
      draftProject: PixelArtProject
    }

export function resolveRestoredSessionState(
  sessionProject: SessionProjectState | null
): RestoredSessionState {
  if (!sessionProject || sessionProject.pathname !== '/editor') {
    return { kind: 'empty' }
  }

  const panelBlocks = normalizePanelBlocks(sessionProject.panelBlocks)

  if (sessionProject.hasFileHandle) {
    return {
      kind: 'file-handle',
      projectName: sessionProject.projectName,
      panelBlocks
    }
  }

  if (sessionProject.draftProject) {
    return {
      kind: 'draft-project',
      projectName: sessionProject.projectName,
      panelBlocks,
      draftProject: sessionProject.draftProject
    }
  }

  return { kind: 'empty' }
}
