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
  type PanelBlocks
} from './sessionPersistence'
import { loadProjectFromFile } from './projectLifecycle'
import {
  persistEditorSession,
  restoreEditorSession
} from './appSessionPersistenceUtils'

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
      await restoreEditorSession({
        getSessionProject,
        getSessionProjectHandle,
        loadProjectFromFile,
        clearSessionProjectHandle,
        applyProject: (project, restoreOptions) => {
          if (cancelled) return
          applyProjectRef.current(project, restoreOptions)
        },
        setCurrentProjectHandle: (handle) => {
          if (cancelled) return
          setCurrentProjectHandleRef.current(handle)
        },
        setCurrentProjectName: (name) => {
          if (cancelled) return
          setCurrentProjectNameRef.current(name)
        },
        setPanelBlocks: (panelBlocks) => {
          if (cancelled) return
          setPanelBlocksRef.current(panelBlocks)
        }
      })
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
        await persistEditorSession({
          currentProjectName: options.currentProjectName,
          currentProjectHandle: options.currentProjectHandle,
          panelBlocks: options.panelBlocks,
          buildCurrentProject: options.buildCurrentProject,
          saveSessionProject,
          saveSessionProjectHandle,
          clearSessionProjectHandle
        })
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
