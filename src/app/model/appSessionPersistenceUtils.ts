import type { PixelArtProject, SessionProjectState } from '@/shared/lib/project'
import { buildSessionPayload, normalizePanelBlocks, type PanelBlocks } from './sessionPersistence'

type ProjectFileHandle = FileSystemFileHandle | null

type ApplyProject = (
  project: PixelArtProject,
  options?: {
    recentName?: string
    projectHandle?: ProjectFileHandle
    projectName?: string | null
    panelBlocks?: PanelBlocks
    saveToRecent?: boolean
  }
) => void

type RestoreSessionOptions = {
  getSessionProject: () => Promise<SessionProjectState | null>
  getSessionProjectHandle: () => Promise<ProjectFileHandle>
  loadProjectFromFile: (file: File) => Promise<PixelArtProject>
  clearSessionProjectHandle: () => Promise<void>
  applyProject: ApplyProject
  setCurrentProjectHandle: (handle: ProjectFileHandle) => void
  setCurrentProjectName: (name: string | null) => void
  setPanelBlocks: (panelBlocks: PanelBlocks) => void
}

type PersistSessionOptions = {
  currentProjectName: string | null
  currentProjectHandle: ProjectFileHandle
  panelBlocks: PanelBlocks
  buildCurrentProject: () => Promise<PixelArtProject>
  saveSessionProject: (state: SessionProjectState) => Promise<void>
  saveSessionProjectHandle: (handle: FileSystemFileHandle) => Promise<void>
  clearSessionProjectHandle: () => Promise<void>
}

export async function restoreEditorSession(options: RestoreSessionOptions) {
  const sessionProject = await options.getSessionProject()
  if (!sessionProject || sessionProject.pathname !== '/editor') {
    return false
  }

  const restoredPanelBlocks = normalizePanelBlocks(sessionProject.panelBlocks)

  if (sessionProject.hasFileHandle) {
    try {
      const handle = await options.getSessionProjectHandle()
      if (handle) {
        const file = await handle.getFile()
        const project = await options.loadProjectFromFile(file)

        options.applyProject(project, {
          projectHandle: handle,
          projectName: sessionProject.projectName ?? file.name,
          panelBlocks: restoredPanelBlocks,
          saveToRecent: false
        })
        options.setCurrentProjectHandle(handle)
        options.setCurrentProjectName(sessionProject.projectName ?? file.name)
        options.setPanelBlocks(restoredPanelBlocks)
        return true
      }
    } catch {
      await options.clearSessionProjectHandle()
    }
  }

  if (sessionProject.draftProject) {
    options.applyProject(sessionProject.draftProject, {
      projectHandle: null,
      projectName: sessionProject.projectName,
      panelBlocks: restoredPanelBlocks,
      saveToRecent: false
    })
    options.setCurrentProjectHandle(null)
    options.setCurrentProjectName(sessionProject.projectName)
    options.setPanelBlocks(restoredPanelBlocks)
    return true
  }

  return false
}

export async function persistEditorSession(options: PersistSessionOptions) {
  const sessionPayload = buildSessionPayload({
    currentProjectName: options.currentProjectName,
    currentProjectHandle: options.currentProjectHandle,
    draftProject: await options.buildCurrentProject(),
    panelBlocks: options.panelBlocks
  })

  await options.saveSessionProject(sessionPayload)

  if (options.currentProjectHandle) {
    await options.saveSessionProjectHandle(options.currentProjectHandle)
    return
  }

  await options.clearSessionProjectHandle()
}
