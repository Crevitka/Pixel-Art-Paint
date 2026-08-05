import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCanvasExportArtifact,
  buildProjectFile,
  buildSpriteSheetExportArtifact,
  writeProjectFile
} from '../src/widgets/header/model/projectFileUtils'

function createLayer(id: string, pixels: Array<[string, string]>, visible = true) {
  return {
    id,
    name: id,
    visible,
    pixels: new Map(pixels)
  }
}

function createFrame(id: string, layers: ReturnType<typeof createLayer>[]) {
  return {
    id,
    name: id,
    layers,
    activeLayerId: layers[0]?.id ?? 'layer-1',
    nextLayerNumber: layers.length + 1
  }
}

test('buildProjectFile creates serialized project and suggested name', async () => {
  const builtProject = await buildProjectFile({
    canvasSize: { width: 32, height: 24 },
    frames: [createFrame('frame-1', [createLayer('layer-1', [['0,0', '#111111']])])],
    activeFrameId: 'frame-1',
    animationFps: 10,
    layers: [createLayer('layer-1', [['0,0', '#111111'], ['1,1', '#222222']])],
    activeLayerId: 'layer-1',
    referenceImageUrl: null,
    referenceOpacity: 0.4,
    referenceScale: 1,
    referenceOffset: { x: 2, y: 3 },
    isReferenceVisible: true,
    selectedColor: '#111111',
    pickerColor: '#222222',
    paletteColors: ['#111111', '#222222'],
    palettePresets: [{ id: 'basic', label: 'Basic', colors: ['#111111', '#222222'] }],
    activePalettePresetId: 'basic',
    selectedTool: 'pencil',
    brushSize: 2,
    currentProjectName: null,
    timestamp: '2026-08-05T12:34:56.789Z'
  })

  assert.equal(
    builtProject.suggestedName,
    'pixel-art-project-32x24-2026-08-05T12-34-56-789Z.pap.json'
  )
  assert.equal(builtProject.project.version, 1)
  assert.equal(builtProject.project.canvas.nextLayerNumber, 2)
  assert.equal(builtProject.project.animation?.nextFrameNumber, 2)
  assert.equal(typeof builtProject.projectText, 'string')
  assert.deepEqual(JSON.parse(builtProject.projectText), builtProject.project)
})

test('writeProjectFile writes built project blob into file handle', async () => {
  const writes: Array<Blob | string> = []
  let closed = false
  const handle = {
    createWritable: async () => ({
      write: async (data: Blob | string) => {
        writes.push(data)
      },
      close: async () => {
        closed = true
      }
    })
  } as unknown as FileSystemFileHandle

  const builtProject = await buildProjectFile({
    canvasSize: { width: 16, height: 16 },
    frames: [createFrame('frame-1', [createLayer('layer-1', [['0,0', '#000000']])])],
    activeFrameId: 'frame-1',
    animationFps: 8,
    layers: [createLayer('layer-1', [['0,0', '#000000']])],
    activeLayerId: 'layer-1',
    referenceImageUrl: null,
    referenceOpacity: 0.5,
    referenceScale: 1,
    referenceOffset: { x: 0, y: 0 },
    isReferenceVisible: true,
    selectedColor: '#000000',
    pickerColor: '#000000',
    paletteColors: ['#000000'],
    palettePresets: [{ id: 'basic', label: 'Basic', colors: ['#000000'] }],
    activePalettePresetId: 'basic',
    selectedTool: 'pencil',
    brushSize: 1,
    currentProjectName: 'saved.pap.json',
    timestamp: '2026-08-05T12:34:56.789Z'
  })

  await writeProjectFile(handle, builtProject)

  assert.equal(writes.length, 1)
  assert.ok(writes[0] instanceof Blob)
  assert.equal(closed, true)
})

test('buildCanvasExportArtifact keeps project pixel dimensions and naming', () => {
  const artifact = buildCanvasExportArtifact({
    layers: [
      createLayer('top', [['0,0', '#ff0000'], ['2,1', '#00ff00']]),
      createLayer('bottom', [['0,0', '#111111']])
    ],
    canvasSize: { width: 4, height: 3 },
    timestamp: '2026-08-05T12:34:56.789Z'
  })

  assert.equal(artifact.suggestedName, 'pixel-art-4x3-2026-08-05T12-34-56-789Z.png')
  assert.equal(artifact.width, 4)
  assert.equal(artifact.height, 3)
  assert.equal(artifact.pixels.get('0,0'), '#ff0000')
  assert.equal(artifact.pixels.get('2,1'), '#00ff00')
})

test('buildSpriteSheetExportArtifact lays out frames horizontally with project dimensions', () => {
  const artifact = buildSpriteSheetExportArtifact({
    frames: [
      createFrame('frame-1', [createLayer('layer-1', [['0,0', '#111111']])]),
      createFrame('frame-2', [createLayer('layer-1', [['1,0', '#222222']])])
    ],
    canvasSize: { width: 3, height: 2 },
    timestamp: '2026-08-05T12:34:56.789Z'
  })

  assert.equal(
    artifact.suggestedName,
    'pixel-art-sprite-sheet-3x2-2026-08-05T12-34-56-789Z.png'
  )
  assert.equal(artifact.width, 6)
  assert.equal(artifact.height, 2)
  assert.equal(artifact.pixels.get('0,0'), '#111111')
  assert.equal(artifact.pixels.get('4,0'), '#222222')
})
