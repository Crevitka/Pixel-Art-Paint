import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PixelArtProject } from '@/shared/lib/project'
import type { BuiltProjectFile } from './projectFileUtils'
import {
  getSnackbarClassName,
  getSnackbarStateFromSaveStatus,
  shouldPersistAutosave,
  shouldSkipAutosave,
  type SaveStatus,
  type SnackbarState
} from './saveFlowUtils'

type SaveFilePicker = (options?: {
  suggestedName?: string
  types?: Array<{
    description?: string
    accept: Record<string, string[]>
  }>
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob | string) => Promise<void>
    close: () => Promise<void>
  }>
}>

type UseProjectSaveFlowOptions = {
  currentProjectHandle: FileSystemFileHandle | null
  buildProject: () => Promise<BuiltProjectFile>
  persistProject: (options?: {
    handle?: FileSystemFileHandle | null
    suggestedName?: string
    project?: PixelArtProject
    projectText?: string
  }) => Promise<{
    handle: FileSystemFileHandle | null
    suggestedName: string
    project: PixelArtProject
    projectText: string
  }>
  saveRecentProject: (entry: {
    name: string
    project: PixelArtProject
  }) => Promise<void>
  savingMessage: string
  savedMessage: string
  saveErrorMessage: string
}

export function useProjectSaveFlow(options: UseProjectSaveFlowOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [snackbar, setSnackbar] = useState<SnackbarState>(null)
  const lastSavedProjectTextRef = useRef<string | null>(null)
  const skipNextAutosaveRef = useRef(true)
  const autosaveRunIdRef = useRef(0)

  const persistSaveAsDownload = useCallback(async () => {
    const builtProject = await options.buildProject()
    const projectBlob = new Blob([builtProject.projectText], { type: 'application/json' })
    const link = document.createElement('a')
    link.download = builtProject.suggestedName
    link.href = URL.createObjectURL(projectBlob)
    link.click()
    URL.revokeObjectURL(link.href)
    lastSavedProjectTextRef.current = builtProject.projectText
    setSaveStatus('saved')
    setSnackbar({
      message: options.savedMessage,
      status: 'saved'
    })
    await options.saveRecentProject({
      name: builtProject.suggestedName,
      project: builtProject.project
    })
  }, [options])

  const handleSaveProject = useCallback(async () => {
    if (options.currentProjectHandle) {
      try {
        const persistedProject = await options.persistProject()
        lastSavedProjectTextRef.current = persistedProject.projectText
        setSaveStatus('saved')
        setSnackbar({
          message: options.savedMessage,
          status: 'saved'
        })
        return
      } catch {
        setSaveStatus('error')
      }
    }

    const filePicker = (window as Window & {
      showSaveFilePicker?: SaveFilePicker
    }).showSaveFilePicker

    if (filePicker) {
      try {
        const builtProject = await options.buildProject()
        const handle = await filePicker({
          suggestedName: builtProject.suggestedName,
          types: [
            {
              description: 'Pixel Art Paint project',
              accept: {
                'application/json': ['.pap.json', '.json']
              }
            }
          ]
        })

        const persistedProject = await options.persistProject({
          handle: handle as FileSystemFileHandle,
          suggestedName: builtProject.suggestedName,
          project: builtProject.project,
          projectText: builtProject.projectText
        })
        lastSavedProjectTextRef.current = persistedProject.projectText
        setSaveStatus('saved')
        setSnackbar({
          message: options.savedMessage,
          status: 'saved'
        })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setSaveStatus('error')
      }
    }

    await persistSaveAsDownload()
  }, [options, persistSaveAsDownload])

  const markProjectLoaded = useCallback((project: PixelArtProject) => {
    lastSavedProjectTextRef.current = JSON.stringify(project, null, 2)
    skipNextAutosaveRef.current = true
    setSaveStatus('idle')
    setSnackbar(null)
  }, [])

  useEffect(() => {
    const autosaveDecision = shouldSkipAutosave({
      currentProjectHandle: options.currentProjectHandle,
      skipNextAutosave: skipNextAutosaveRef.current
    })

    if (autosaveDecision === 'no-handle') {
      skipNextAutosaveRef.current = true
      return
    }

    if (autosaveDecision === 'skip-once') {
      skipNextAutosaveRef.current = false
      return
    }

    const runId = autosaveRunIdRef.current + 1
    autosaveRunIdRef.current = runId

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const builtProject = await options.buildProject()

          if (!shouldPersistAutosave({
            builtProjectText: builtProject.projectText,
            lastSavedProjectText: lastSavedProjectTextRef.current,
            runId,
            activeRunId: autosaveRunIdRef.current
          })) {
            return
          }

          const persistedProject = await options.persistProject({
            handle: options.currentProjectHandle,
            suggestedName: builtProject.suggestedName,
            project: builtProject.project,
            projectText: builtProject.projectText
          })
          lastSavedProjectTextRef.current = persistedProject.projectText
          setSaveStatus('saved')
          setSnackbar({
            message: options.savedMessage,
            status: 'saved'
          })
        } catch {
          setSaveStatus('error')
        }
      })()
    }, 1200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [options])

  useEffect(() => {
    setSnackbar((currentSnackbar) => getSnackbarStateFromSaveStatus({
      saveStatus,
      savingMessage: options.savingMessage,
      saveErrorMessage: options.saveErrorMessage,
      currentSnackbar
    }))
  }, [options.saveErrorMessage, options.savingMessage, saveStatus])

  useEffect(() => {
    if (!snackbar || snackbar.status === 'saving') return

    const timeoutId = window.setTimeout(() => {
      setSnackbar((currentSnackbar) => (
        currentSnackbar?.status === 'saving' ? currentSnackbar : null
      ))
    }, 2200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [snackbar])

  const snackbarClassName = useMemo(() => getSnackbarClassName(snackbar), [snackbar])

  return {
    saveStatus,
    setSaveStatus,
    snackbar,
    setSnackbar,
    snackbarClassName,
    handleSaveProject,
    markProjectLoaded,
    lastSavedProjectTextRef
  }
}
