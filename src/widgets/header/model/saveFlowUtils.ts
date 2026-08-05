export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type SnackbarState = {
  message: string
  status: Exclude<SaveStatus, 'idle'>
} | null

export function getSnackbarStateFromSaveStatus(options: {
  saveStatus: SaveStatus
  savingMessage: string
  saveErrorMessage: string
  currentSnackbar: SnackbarState
}) {
  if (options.saveStatus === 'saving') {
    return {
      message: options.savingMessage,
      status: 'saving'
    } satisfies Exclude<SnackbarState, null>
  }

  if (options.saveStatus === 'error') {
    return {
      message: options.saveErrorMessage,
      status: 'error'
    } satisfies Exclude<SnackbarState, null>
  }

  return options.currentSnackbar
}

export function getSnackbarClassName(snackbar: SnackbarState) {
  if (snackbar?.status === 'error') {
    return 'border-red-200 bg-red-50 text-red-700'
  }

  if (snackbar?.status === 'saving') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }

  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

export function shouldSkipAutosave(options: {
  currentProjectHandle: FileSystemFileHandle | null
  skipNextAutosave: boolean
}) {
  if (!options.currentProjectHandle) {
    return 'no-handle' as const
  }

  if (options.skipNextAutosave) {
    return 'skip-once' as const
  }

  return 'run' as const
}

export function shouldPersistAutosave(options: {
  builtProjectText: string
  lastSavedProjectText: string | null
  runId: number
  activeRunId: number
}) {
  if (options.lastSavedProjectText === options.builtProjectText) {
    return false
  }

  if (options.activeRunId !== options.runId) {
    return false
  }

  return true
}
