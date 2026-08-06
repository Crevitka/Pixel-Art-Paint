import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getSnackbarClassName,
  getSnackbarStateFromSaveStatus,
  shouldPersistAutosave,
  shouldSkipAutosave
} from '../src/widgets/header/model/saveFlowUtils'

test('getSnackbarStateFromSaveStatus maps saving and error states to snackbar payloads', () => {
  assert.deepEqual(
    getSnackbarStateFromSaveStatus({
      saveStatus: 'saving',
      savingMessage: 'Saving...',
      saveErrorMessage: 'Error',
      currentSnackbar: null
    }),
    {
      message: 'Saving...',
      status: 'saving'
    }
  )

  assert.deepEqual(
    getSnackbarStateFromSaveStatus({
      saveStatus: 'error',
      savingMessage: 'Saving...',
      saveErrorMessage: 'Error',
      currentSnackbar: null
    }),
    {
      message: 'Error',
      status: 'error'
    }
  )

  assert.deepEqual(
    getSnackbarStateFromSaveStatus({
      saveStatus: 'idle',
      savingMessage: 'Saving...',
      saveErrorMessage: 'Error',
      currentSnackbar: {
        message: 'Saved',
        status: 'saved'
      }
    }),
    {
      message: 'Saved',
      status: 'saved'
    }
  )
})

test('getSnackbarClassName returns styles per status', () => {
  assert.equal(
    getSnackbarClassName({ message: 'Err', status: 'error' }),
    'border-red-200 bg-red-50 text-red-700'
  )
  assert.equal(
    getSnackbarClassName({ message: 'Saving', status: 'saving' }),
    'border-amber-200 bg-amber-50 text-amber-700'
  )
  assert.equal(
    getSnackbarClassName({ message: 'Saved', status: 'saved' }),
    'border-emerald-200 bg-emerald-50 text-emerald-700'
  )
})

test('shouldSkipAutosave distinguishes no handle, first skip and run cases', () => {
  assert.equal(
    shouldSkipAutosave({
      currentProjectHandle: null,
      skipNextAutosave: false
    }),
    'no-handle'
  )

  assert.equal(
    shouldSkipAutosave({
      currentProjectHandle: {} as FileSystemFileHandle,
      skipNextAutosave: true
    }),
    'skip-once'
  )

  assert.equal(
    shouldSkipAutosave({
      currentProjectHandle: {} as FileSystemFileHandle,
      skipNextAutosave: false
    }),
    'run'
  )
})

test('shouldPersistAutosave filters unchanged or stale runs', () => {
  assert.equal(
    shouldPersistAutosave({
      builtProjectText: 'same',
      lastSavedProjectText: 'same',
      runId: 2,
      activeRunId: 2
    }),
    false
  )

  assert.equal(
    shouldPersistAutosave({
      builtProjectText: 'new',
      lastSavedProjectText: 'old',
      runId: 2,
      activeRunId: 3
    }),
    false
  )

  assert.equal(
    shouldPersistAutosave({
      builtProjectText: 'new',
      lastSavedProjectText: 'old',
      runId: 3,
      activeRunId: 3
    }),
    true
  )
})

test('autosave gating flow skips first run, persists only fresh changed output and ignores stale reruns', () => {
  const projectHandle = {} as FileSystemFileHandle

  assert.equal(
    shouldSkipAutosave({
      currentProjectHandle: projectHandle,
      skipNextAutosave: true
    }),
    'skip-once'
  )

  assert.equal(
    shouldSkipAutosave({
      currentProjectHandle: projectHandle,
      skipNextAutosave: false
    }),
    'run'
  )

  assert.equal(
    shouldPersistAutosave({
      builtProjectText: '{"version":1,"name":"v2"}',
      lastSavedProjectText: '{"version":1,"name":"v1"}',
      runId: 4,
      activeRunId: 4
    }),
    true
  )

  assert.equal(
    shouldPersistAutosave({
      builtProjectText: '{"version":1,"name":"v2"}',
      lastSavedProjectText: '{"version":1,"name":"v2"}',
      runId: 5,
      activeRunId: 5
    }),
    false
  )

  assert.equal(
    shouldPersistAutosave({
      builtProjectText: '{"version":1,"name":"v3"}',
      lastSavedProjectText: '{"version":1,"name":"v2"}',
      runId: 5,
      activeRunId: 6
    }),
    false
  )
})

test('snackbar flow keeps saved toast during idle and overrides it for saving or error states', () => {
  const savedSnackbar = {
    message: 'Saved',
    status: 'saved'
  } as const

  const idleState = getSnackbarStateFromSaveStatus({
    saveStatus: 'idle',
    savingMessage: 'Saving...',
    saveErrorMessage: 'Save failed',
    currentSnackbar: savedSnackbar
  })
  assert.deepEqual(idleState, savedSnackbar)

  const savingState = getSnackbarStateFromSaveStatus({
    saveStatus: 'saving',
    savingMessage: 'Saving...',
    saveErrorMessage: 'Save failed',
    currentSnackbar: savedSnackbar
  })
  assert.deepEqual(savingState, {
    message: 'Saving...',
    status: 'saving'
  })

  const errorState = getSnackbarStateFromSaveStatus({
    saveStatus: 'error',
    savingMessage: 'Saving...',
    saveErrorMessage: 'Save failed',
    currentSnackbar: savedSnackbar
  })
  assert.deepEqual(errorState, {
    message: 'Save failed',
    status: 'error'
  })
})
