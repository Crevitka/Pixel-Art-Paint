import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Download, FolderOpen, Palette, Save, Settings, Trash2 } from 'lucide-react'
import { useCanvasContext } from '@/features/canvas'
import { useColorContext } from '@/features/colors'
import { eventMatchesHotkey, useHotkeyContext } from '@/features/hotkeys'
import { useI18nContext } from '@/features/i18n'
import { useToolContext } from '@/features/tools'
import {
  deserializeAnimationFrames,
  deserializeLayers,
  saveRecentProject,
  readProjectFile,
  serializeAnimationFrames,
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

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type SnackbarState = {
  message: string
  status: Exclude<SaveStatus, 'idle'>
} | null

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
  const { hotkeys } = useHotkeyContext()
  const { t } = useI18nContext()
  const {
    canvasSize,
    clearCanvas,
    frames,
    activeFrameId,
    animationFps,
    layers,
    activeLayerId,
    referenceImageUrl,
    referenceOpacity,
    referenceScale,
    referenceOffset,
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [snackbar, setSnackbar] = useState<SnackbarState>(null)
  const openProjectInputRef = useRef<HTMLInputElement>(null)
  const lastSavedProjectTextRef = useRef<string | null>(null)
  const skipNextAutosaveRef = useRef(true)
  const autosaveRunIdRef = useRef(0)

  const handleClear = () => {
    clearCanvas()
  }

  const buildProject = useCallback(async () => {
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
        referenceOffset,
        isReferenceVisible,
        nextLayerNumber: getNextLayerNumber(layers)
      },
      animation: {
        frames: serializeAnimationFrames(frames),
        activeFrameId,
        fps: animationFps,
        nextFrameNumber:
          frames.reduce((maxFrameNumber, frame) => {
            const match = /^frame-(\d+)$/.exec(frame.id)
            if (!match) return maxFrameNumber
            return Math.max(maxFrameNumber, Number(match[1]))
          }, 1) + 1
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

    return {
      suggestedName,
      project,
      projectText
    }
  }, [
    activeFrameId,
    activeLayerId,
    activePalettePresetId,
    animationFps,
    brushSize,
    canvasSize,
    currentProjectName,
    frames,
    isReferenceVisible,
    layers,
    paletteColors,
    palettePresets,
    pickerColor,
    referenceImageUrl,
    referenceOpacity,
    referenceScale,
    referenceOffset,
    selectedColor,
    selectedTool
  ])

  const persistProject = useCallback(async (options?: {
    handle?: FileSystemFileHandle | null
    suggestedName?: string
    project?: PixelArtProject
    projectText?: string
  }) => {
    const builtProject = options?.project && options?.projectText && options?.suggestedName
      ? {
          suggestedName: options.suggestedName,
          project: options.project,
          projectText: options.projectText
        }
      : await buildProject()

    const projectBlob = new Blob([builtProject.projectText], { type: 'application/json' })
    const handle = options?.handle ?? currentProjectHandle

    if (handle) {
      setSaveStatus('saving')
      const writable = await handle.createWritable()
      await writable.write(projectBlob)
      await writable.close()

      onProjectFileChange(handle, builtProject.suggestedName)
      lastSavedProjectTextRef.current = builtProject.projectText
      setSaveStatus('saved')
      setSnackbar({
        message: t('header.saved'),
        status: 'saved'
      })

      try {
        await saveRecentProject({
          name: builtProject.suggestedName,
          project: builtProject.project
        })
      } catch {
        // Recent-project persistence should not turn a successful save into a fallback download.
      }

      return {
        handle,
        ...builtProject
      }
    }

    return {
      handle: null,
      ...builtProject
    }
  }, [buildProject, currentProjectHandle, onProjectFileChange])

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
    if (currentProjectHandle) {
      try {
        await persistProject()
        return
      } catch {
        setSaveStatus('error')
        // Fall back to Save As when the existing handle is no longer writable.
      }
    }

    const filePicker = (window as Window & {
      showSaveFilePicker?: SaveFilePicker
    }).showSaveFilePicker

    if (filePicker) {
      try {
        const builtProject = await buildProject()
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

        await persistProject({
          handle: handle as FileSystemFileHandle,
          suggestedName: builtProject.suggestedName,
          project: builtProject.project,
          projectText: builtProject.projectText
        })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setSaveStatus('error')
      }
    }

    const builtProject = await buildProject()
    const projectBlob = new Blob([builtProject.projectText], { type: 'application/json' })
    const link = document.createElement('a')
    link.download = builtProject.suggestedName
    link.href = URL.createObjectURL(projectBlob)
    link.click()
    URL.revokeObjectURL(link.href)
    lastSavedProjectTextRef.current = builtProject.projectText
    setSaveStatus('saved')
    setSnackbar({
      message: t('header.saved'),
      status: 'saved'
    })
    await saveRecentProject({
      name: builtProject.suggestedName,
      project: builtProject.project
    })
  }

  useEffect(() => {
    if (!currentProjectHandle) {
      skipNextAutosaveRef.current = true
      return
    }

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false
      return
    }

    const runId = autosaveRunIdRef.current + 1
    autosaveRunIdRef.current = runId

    const timeoutId = window.setTimeout(async () => {
      try {
        const builtProject = await buildProject()

        if (lastSavedProjectTextRef.current === builtProject.projectText) {
          return
        }

        if (autosaveRunIdRef.current !== runId) {
          return
        }

        await persistProject({
          handle: currentProjectHandle,
          suggestedName: builtProject.suggestedName,
          project: builtProject.project,
          projectText: builtProject.projectText
        })
      } catch {
        setSaveStatus('error')
        // Ignore autosave failures and keep manual save available.
      }
    }, 1200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [buildProject, currentProjectHandle, persistProject])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!eventMatchesHotkey(event, hotkeys.saveProject)) return

      event.preventDefault()
      event.stopPropagation()
      void handleSaveProject()
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [handleSaveProject, hotkeys.saveProject])

  const loadProject = async (file: File, fileHandle: FileSystemFileHandle | null = null) => {
    const project = await readProjectFile(file)
    if (project.version !== 1) {
      throw new Error('Unsupported project version')
    }

    loadCanvasProjectState({
      canvasSize: project.canvas.canvasSize,
      layers: deserializeLayers(project.canvas.layers),
      activeLayerId: project.canvas.activeLayerId,
      frames: project.animation?.frames ? deserializeAnimationFrames(project.animation.frames) : undefined,
      activeFrameId: project.animation?.activeFrameId,
      animationFps: project.animation?.fps,
      nextFrameNumber: project.animation?.nextFrameNumber,
      referenceImageUrl: project.canvas.referenceImageUrl,
      referenceOpacity: project.canvas.referenceOpacity,
      referenceScale: project.canvas.referenceScale,
      referenceOffset: project.canvas.referenceOffset ?? { x: 0, y: 0 },
      isReferenceVisible: project.canvas.isReferenceVisible,
      nextLayerNumber: project.canvas.nextLayerNumber
    })

    loadColorProjectState(project.colors)
    loadToolProjectState(project.tools)
    lastSavedProjectTextRef.current = JSON.stringify(project, null, 2)
    skipNextAutosaveRef.current = true
    setSaveStatus('idle')
    setSnackbar(null)
    onProjectFileChange(fileHandle, file.name)
    await saveRecentProject({
      name: file.name,
      project
    })
  }

  useEffect(() => {
    if (saveStatus === 'saving') {
      setSnackbar({
        message: t('header.saving'),
        status: 'saving'
      })
      return
    }

    if (saveStatus === 'error') {
      setSnackbar({
        message: t('header.saveError'),
        status: 'error'
      })
      return
    }
  }, [saveStatus, t])

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

  const snackbarClassName =
    snackbar?.status === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : snackbar?.status === 'saving'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700'

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
        <div className="flex items-center gap-3">
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
            {t('header.open')}
          </Button>
          <Button
            onClick={() => setIsSettingsOpen(true)}
            variant="secondary"
          >
            <Settings className="w-4 h-4" />
            {t('header.settings')}
          </Button>
          <Button
            onClick={handleClear}
            variant="secondary"
          >
            <Trash2 className="w-4 h-4" />
            {t('header.clear')}
          </Button>
          <Button
            onClick={handleSaveProject}
            variant="secondary"
          >
            <Save className="w-4 h-4" />
            {t('header.saveProject')}
          </Button>
          <Button
            onClick={handleExportPng}
            variant="primary"
          >
            <Download className="w-4 h-4" />
            {t('header.exportPng')}
          </Button>
        </div>
      </motion.header>
      {snackbar ? (
        <motion.div
          className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur ${snackbarClassName}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {snackbar.message}
        </motion.div>
      ) : null}
      {isSettingsOpen ? <SettingsWidget onClose={() => setIsSettingsOpen(false)} /> : null}
    </>
  )
}
