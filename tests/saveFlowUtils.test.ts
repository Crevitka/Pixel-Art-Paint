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
