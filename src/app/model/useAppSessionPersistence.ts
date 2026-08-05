import { useEffect, useRef, useState } from 'react'
import {
  clearSessionProjectHandle,
  getSessionProject,
  getSessionProjectHandle,
  saveSessionProject,
  saveSessionProjectHandle,
  type PixelArtProject
} from '@/shared/lib/project'
import {
  buildSessionPayload,
  normalizePanelBlocks,
  type PanelBlocks
} from './sessionPersistence'
import { loadProjectFromFile } from './projectLifecycle'

type ProjectFileHandle = FileSystemFileHandle | null

type UseAppSessionPersistenceOptions = {
  pathname: string
  currentProjectHandle: ProjectFileHandle
  currentProjectName: string | null
  panelBlocks: PanelBlocks
  setCurrentProjectHandle: (handle: ProjectFileHandle) => void
  setCurrentProjectName: (name: string | null) => void
  setPanelBlocks: (panelBlocks: PanelBlocks) => void
  applyProject: (
    project: PixelArtProject,
    options?: {
      recentName?: string
      projectHandle?: ProjectFileHandle
      projectName?: string | null
      panelBlocks?: PanelBlocks
      saveToRecent?: boolean
    }
  ) => void
  buildCurrentProject: () => Promise<PixelArtProject>
}

export function useAppSessionPersistence(options: UseAppSessionPersistenceOptions) {
  const [isSessionReady, setIsSessionReady] = useState(false)
  const applyProjectRef = useRef(options.applyProject)
  const setCurrentProjectHandleRef = useRef(options.setCurrentProjectHandle)
  const setCurrentProjectNameRef = useRef(options.setCurrentProjectName)
  const setPanelBlocksRef = useRef(options.setPanelBlocks)

  applyProjectRef.current = options.applyProject
  setCurrentProjectHandleRef.current = options.setCurrentProjectHandle
  setCurrentProjectNameRef.current = options.setCurrentProjectName
  setPanelBlocksRef.current = options.setPanelBlocks

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
              applyProjectRef.current(project, {
                projectHandle: handle,
                projectName: sessionProject.projectName ?? file.name,
                panelBlocks: restoredPanelBlocks,
                saveToRecent: false
              })
              setCurrentProjectHandleRef.current(handle)
              setCurrentProjectNameRef.current(sessionProject.projectName ?? file.name)
              setPanelBlocksRef.current(restoredPanelBlocks)
              setIsSessionReady(true)
              return
            }
          }
        } catch {
          await clearSessionProjectHandle()
        }
      }

      if (sessionProject.draftProject && !cancelled) {
        applyProjectRef.current(sessionProject.draftProject, {
          projectHandle: null,
          projectName: sessionProject.projectName,
          panelBlocks: restoredPanelBlocks,
          saveToRecent: false
        })
        setCurrentProjectHandleRef.current(null)
        setCurrentProjectNameRef.current(sessionProject.projectName)
        setPanelBlocksRef.current(restoredPanelBlocks)
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
    if (options.pathname !== '/editor') return

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const sessionPayload = buildSessionPayload({
          currentProjectName: options.currentProjectName,
          currentProjectHandle: options.currentProjectHandle,
          draftProject: await options.buildCurrentProject(),
          panelBlocks: options.panelBlocks
        })

        await saveSessionProject(sessionPayload)

        if (options.currentProjectHandle) {
          await saveSessionProjectHandle(options.currentProjectHandle)
        } else {
          await clearSessionProjectHandle()
        }
      })()
    }, 700)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    isSessionReady,
    options.buildCurrentProject,
    options.currentProjectHandle,
    options.currentProjectName,
    options.panelBlocks,
    options.pathname
  ])

  return {
    isSessionReady
  }
}
