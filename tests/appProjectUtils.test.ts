import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createBlankProject,
  createProjectFromTemplate,
  getLoadedProjectApplyOptions,
  getNewProjectApplyOptions,
  getRecentProjectApplyOptions
} from '../src/app/model/appProjectUtils'
import { INITIAL_PANEL_BLOCKS } from '../src/app/model/sessionPersistence'

test('createProjectFromTemplate builds a ready-to-open editor project from template data', () => {
  const project = createProjectFromTemplate({
    id: 'scene-64',
    title: 'Scene 64x64',
    description: 'Template for scenes',
    size: { width: 64, height: 64 },
    paletteColors: ['#112233', '#445566', '#778899']
  }, 'Layer 1')

  assert.equal(project.version, 1)
  assert.deepEqual(project.canvas.canvasSize, { width: 64, height: 64 })
  assert.equal(project.canvas.layers.length, 1)
  assert.equal(project.canvas.layers[0]?.name, 'Layer 1')
  assert.deepEqual(project.colors.paletteColors, ['#112233', '#445566', '#778899'])
  assert.equal(project.colors.selectedColor, '#112233')
  assert.equal(project.colors.activePalettePresetId, 'scene-64')
  assert.equal(project.animation?.frames.length, 1)
  assert.equal(project.animation?.activeFrameId, 'frame-1')
})

test('createBlankProject uses the default blank canvas preset', () => {
  const project = createBlankProject('Blank', 'Empty canvas', 'Layer 1')

  assert.deepEqual(project.canvas.canvasSize, { width: 32, height: 32 })
  assert.deepEqual(project.colors.paletteColors, ['#000000', '#ffffff'])
  assert.equal(project.colors.activePalettePresetId, 'blank-32')
  assert.equal(project.canvas.nextLayerNumber, 2)
  assert.equal(project.animation?.nextFrameNumber, 2)
})

test('appProjectUtils returns consistent apply options for new, loaded and recent projects', () => {
  assert.deepEqual(getNewProjectApplyOptions('New Project'), {
    recentName: 'New Project',
    projectHandle: null,
    projectName: null,
    panelBlocks: INITIAL_PANEL_BLOCKS
  })

  const fileHandle = {} as FileSystemFileHandle

  assert.deepEqual(getLoadedProjectApplyOptions('sprite.pap.json', fileHandle), {
    recentName: 'sprite.pap.json',
    projectHandle: fileHandle,
    projectName: 'sprite.pap.json'
  })

  assert.deepEqual(getLoadedProjectApplyOptions('imported.json'), {
    recentName: 'imported.json',
    projectHandle: null,
    projectName: 'imported.json'
  })

  assert.deepEqual(getRecentProjectApplyOptions('Recent project'), {
    recentName: 'Recent project',
    projectHandle: null,
    projectName: 'Recent project'
  })
})
