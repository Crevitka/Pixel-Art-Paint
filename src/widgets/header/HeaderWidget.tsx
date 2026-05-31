import { motion } from 'framer-motion'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Download, FolderOpen, Palette, Save, Settings, Trash2 } from 'lucide-react'
import { useCanvasContext } from '@/features/canvas'
import { useColorContext } from '@/features/colors'
import { useToolContext } from '@/features/tools'
import {
  deserializeLayers,
  saveRecentProject,
  readProjectFile,
  serializeLayers,
  serializeReferenceImage,
  type PixelArtProject
} from '@/shared/lib/project'
import { Button } from '@/shared/ui/Button'
import { SettingsWidget } from '@/widgets/settings'

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

type OpenFilePicker = (options?: {
  multiple?: boolean
  types?: Array<{
    description?: string
    accept: Record<string, string[]>
  }>
}) => Promise<FileSystemFileHandle[]>

type HeaderWidgetProps = {
  currentProjectHandle: FileSystemFileHandle | null
  currentProjectName: string | null
  onProjectFileChange: (handle: FileSystemFileHandle | null, name: string | null) => void
}

function getNextLayerNumber(layers: Array<{ id: string }>) {
  const maxLayerNumber = layers.reduce((maxNumber, layer) => {
    const match = /^layer-(\d+)$/.exec(layer.id)
    if (!match) return maxNumber
    return Math.max(maxNumber, Number(match[1]))
  }, 1)

  return maxLayerNumber + 1
}

export function HeaderWidget({
  currentProjectHandle,
  currentProjectName,
  onProjectFileChange
}: HeaderWidgetProps) {
  const {
    canvasSize,
    clearCanvas,
    layers,
    activeLayerId,
    referenceImageUrl,
    referenceOpacity,
    referenceScale,
    isReferenceVisible,
    loadCanvasProjectState
  } = useCanvasContext()
  const {
    selectedColor,
    pickerColor,
    paletteColors,
    palettePresets,
    activePalettePresetId,
    loadColorProjectState
  } = useColorContext()
  const { selectedTool, brushSize, loadToolProjectState } = useToolContext()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const openProjectInputRef = useRef<HTMLInputElement>(null)

  const handleClear = () => {
    clearCanvas()
  }

  const handleExportPng = async () => {
    const exportScale = 16
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = canvasSize.width * exportScale
    exportCanvas.height = canvasSize.height * exportScale

    const ctx = exportCanvas.getContext('2d')
    if (!ctx) return

    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)

    layers
      .filter((layer) => layer.visible)
      .reverse()
      .forEach((layer) => {
        layer.pixels.forEach((color, key) => {
          const [x, y] = key.split(',').map(Number)
          ctx.fillStyle = color
          ctx.fillRect(x * exportScale, y * exportScale, exportScale, exportScale)
        })
      })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const suggestedName = `pixel-art-${canvasSize.width}x${canvasSize.height}-${timestamp}.png`
    const pngBlob = await new Promise<Blob | null>((resolve) => {
      exportCanvas.toBlob(resolve, 'image/png')
    })

    if (!pngBlob) return

    const filePicker = (window as Window & {
      showSaveFilePicker?: SaveFilePicker
    }).showSaveFilePicker

    if (filePicker) {
      try {
        const handle = await filePicker({
          suggestedName,
          types: [
            {
              description: 'PNG image',
              accept: {
                'image/png': ['.png']
              }
            }
          ]
        })

        const writable = await handle.createWritable()
        await writable.write(pngBlob)
        await writable.close()
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
      }
    }

    const link = document.createElement('a')
    link.download = suggestedName
    link.href = URL.createObjectURL(pngBlob)
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleSaveProject = async () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const suggestedName =
      currentProjectName ?? `pixel-art-project-${canvasSize.width}x${canvasSize.height}-${timestamp}.pap.json`
    const project: PixelArtProject = {
      version: 1,
      canvas: {
        canvasSize,
        layers: serializeLayers(layers),
        activeLayerId,
        referenceImageUrl: await serializeReferenceImage(referenceImageUrl),
        referenceOpacity,
        referenceScale,
        isReferenceVisible,
        nextLayerNumber: getNextLayerNumber(layers)
      },
      colors: {
        selectedColor,
        pickerColor,
        paletteColors: [...paletteColors],
        palettePresets: palettePresets.map((preset) => ({
          ...preset,
          colors: [...preset.colors]
        })),
        activePalettePresetId
      },
      tools: {
        selectedTool,
        brushSize
      }
    }

    const projectText = JSON.stringify(project, null, 2)
    const projectBlob = new Blob([projectText], { type: 'application/json' })

    if (currentProjectHandle) {
      try {
        const writable = await currentProjectHandle.createWritable()
        await writable.write(projectBlob)
        await writable.close()
        onProjectFileChange(currentProjectHandle, suggestedName)
        saveRecentProject({
          name: suggestedName,
          project
        })
        return
      } catch {
        // Fall back to Save As when the existing handle is no longer writable.
      }
    }

    const filePicker = (window as Window & {
      showSaveFilePicker?: SaveFilePicker
    }).showSaveFilePicker

    if (filePicker) {
      try {
        const handle = await filePicker({
          suggestedName,
          types: [
            {
              description: 'Pixel Art Paint project',
              accept: {
                'application/json': ['.pap.json', '.json']
              }
            }
          ]
        })

        const writable = await handle.createWritable()
        await writable.write(projectBlob)
        await writable.close()
        onProjectFileChange(handle as FileSystemFileHandle, suggestedName)
        saveRecentProject({
          name: suggestedName,
          project
        })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
      }
    }

    const link = document.createElement('a')
    link.download = suggestedName
    link.href = URL.createObjectURL(projectBlob)
    link.click()
    URL.revokeObjectURL(link.href)
    saveRecentProject({
      name: suggestedName,
      project
    })
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.code === 'KeyS'

      if (!isSaveShortcut) return

      event.preventDefault()
      event.stopPropagation()
      void handleSaveProject()
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [
    activeLayerId,
    brushSize,
    canvasSize,
    isReferenceVisible,
    layers,
    paletteColors,
    palettePresets,
    pickerColor,
    referenceImageUrl,
    referenceOpacity,
    referenceScale,
    selectedColor,
    selectedTool,
    activePalettePresetId
  ])

  const loadProject = async (file: File, fileHandle: FileSystemFileHandle | null = null) => {
    const project = await readProjectFile(file)
    if (project.version !== 1) {
      throw new Error('Unsupported project version')
    }

    loadCanvasProjectState({
      canvasSize: project.canvas.canvasSize,
      layers: deserializeLayers(project.canvas.layers),
      activeLayerId: project.canvas.activeLayerId,
      referenceImageUrl: project.canvas.referenceImageUrl,
      referenceOpacity: project.canvas.referenceOpacity,
      referenceScale: project.canvas.referenceScale,
      isReferenceVisible: project.canvas.isReferenceVisible,
      nextLayerNumber: project.canvas.nextLayerNumber
    })

    loadColorProjectState(project.colors)
    loadToolProjectState(project.tools)
    onProjectFileChange(fileHandle, file.name)
    saveRecentProject({
      name: file.name,
      project
    })
  }

  const handleOpenProject = async () => {
    const filePicker = (window as Window & {
      showOpenFilePicker?: OpenFilePicker
    }).showOpenFilePicker

    if (filePicker) {
      try {
        const [handle] = await filePicker({
          multiple: false,
          types: [
            {
              description: 'Pixel Art Paint project',
              accept: {
                'application/json': ['.pap.json', '.json']
              }
            }
          ]
        })

        if (!handle) return
        const file = await handle.getFile()
        await loadProject(file, handle as FileSystemFileHandle)
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
      }
    }

    openProjectInputRef.current?.click()
  }

  const handleOpenProjectInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    await loadProject(file)
  }

  return (
    <>
      <motion.header
        className="glass-effect rounded-2xl p-5 mb-5 flex justify-between items-center"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.h1
          className="text-3xl font-bold bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent flex items-center gap-3"
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <Palette className="w-8 h-8" />
          Pixel Art Paint
        </motion.h1>
        <div className="flex gap-3">
          <input
            ref={openProjectInputRef}
            type="file"
            accept=".pap.json,.json,application/json"
            onChange={handleOpenProjectInput}
            className="hidden"
          />
          <Button
            onClick={handleOpenProject}
            variant="secondary"
          >
            <FolderOpen className="w-4 h-4" />
            Открыть
          </Button>
          <Button
            onClick={() => setIsSettingsOpen(true)}
            variant="secondary"
          >
            <Settings className="w-4 h-4" />
            Настройки
          </Button>
          <Button
            onClick={handleClear}
            variant="secondary"
          >
            <Trash2 className="w-4 h-4" />
            Очистить
          </Button>
          <Button
            onClick={handleSaveProject}
            variant="secondary"
          >
            <Save className="w-4 h-4" />
            Сохранить проект
          </Button>
          <Button
            onClick={handleExportPng}
            variant="primary"
          >
            <Download className="w-4 h-4" />
            Экспорт PNG
          </Button>
        </div>
      </motion.header>
      {isSettingsOpen ? <SettingsWidget onClose={() => setIsSettingsOpen(false)} /> : null}
    </>
  )
}
