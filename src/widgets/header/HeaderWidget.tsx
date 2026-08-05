import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Download, FolderOpen, Palette, Save, Settings, Trash2 } from 'lucide-react'
import { useCanvasContext } from '@/features/canvas'
import { useColorContext } from '@/features/colors'
import { eventMatchesHotkey, useHotkeyContext } from '@/features/hotkeys'
import { useI18nContext } from '@/features/i18n'
import { useToolContext } from '@/features/tools'
import {
  saveRecentProject,
  type PixelArtProject
} from '@/shared/lib/project'
import {
  applyProjectToEditor,
  loadProjectFromFile
} from '@/app/model/projectLifecycle'
import { Button } from '@/shared/ui/Button'
import {
  buildCanvasExportArtifact,
  buildProjectFile,
  buildSpriteSheetExportArtifact,
  writeProjectFile
} from './model/projectFileUtils'
import { useProjectSaveFlow } from './model/useProjectSaveFlow'
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
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
  const openProjectInputRef = useRef<HTMLInputElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  const handleClear = () => {
    clearCanvas()
  }

  const buildProject = useCallback(async () => {
    return buildProjectFile({
      canvasSize,
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
      selectedColor,
      pickerColor,
      paletteColors,
      palettePresets,
      activePalettePresetId,
      selectedTool,
      brushSize,
      currentProjectName
    })
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

    const handle = options?.handle ?? currentProjectHandle

    if (handle) {
      setSaveStatus('saving')
      await writeProjectFile(handle, builtProject)

      onProjectFileChange(handle, builtProject.suggestedName)

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
  }, [buildProject, currentProjectHandle, onProjectFileChange, t])

  const {
    setSaveStatus,
    setSnackbar,
    snackbar,
    snackbarClassName,
    handleSaveProject,
    markProjectLoaded
  } = useProjectSaveFlow({
    currentProjectHandle,
    buildProject,
    persistProject,
    saveRecentProject,
    savingMessage: t('header.saving'),
    savedMessage: t('header.saved'),
    saveErrorMessage: t('header.saveError')
  })

  const handleExportPng = async () => {
    const exportArtifact = buildCanvasExportArtifact({
      layers,
      canvasSize
    })
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = exportArtifact.width
    exportCanvas.height = exportArtifact.height

    const ctx = exportCanvas.getContext('2d')
    if (!ctx) return

    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    exportArtifact.pixels.forEach((color, key) => {
      const [x, y] = key.split(',').map(Number)
      ctx.fillStyle = color
      ctx.fillRect(x, y, 1, 1)
    })

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
          suggestedName: exportArtifact.suggestedName,
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
    link.download = exportArtifact.suggestedName
    link.href = URL.createObjectURL(pngBlob)
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleExportSpriteSheet = async () => {
    const exportArtifact = buildSpriteSheetExportArtifact({
      frames,
      canvasSize
    })
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = exportArtifact.width
    exportCanvas.height = exportArtifact.height

    const ctx = exportCanvas.getContext('2d')
    if (!ctx) return

    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    exportArtifact.pixels.forEach((color, key) => {
      const [x, y] = key.split(',').map(Number)
      ctx.fillStyle = color
      ctx.fillRect(x, y, 1, 1)
    })

    const pngBlob = await new Promise<Blob | null>((resolve) => {
      exportCanvas.toBlob(resolve, 'image/png')
    })

    if (!pngBlob) {
      setSnackbar({
        message: t('header.exportError'),
        status: 'error'
      })
      return
    }

    const filePicker = (window as Window & {
      showSaveFilePicker?: SaveFilePicker
    }).showSaveFilePicker

    if (filePicker) {
      try {
        const handle = await filePicker({
          suggestedName: exportArtifact.suggestedName,
          types: [
            {
              description: 'PNG sprite sheet',
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
    link.download = exportArtifact.suggestedName
    link.href = URL.createObjectURL(pngBlob)
    link.click()
    URL.revokeObjectURL(link.href)
  }

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
    const project = await loadProjectFromFile(file)
    applyProjectToEditor(project, {
      loadCanvasProjectState,
      loadColorProjectState,
      loadToolProjectState,
      setCurrentProjectHandle: (handle) => onProjectFileChange(handle, file.name),
      setCurrentProjectName: (_name) => undefined,
      setPanelBlocks: () => undefined,
      setDraggingBlockId: () => undefined,
      setDragOverTarget: () => undefined,
      navigateToEditor: () => undefined,
      saveRecentProject
    }, {
      projectHandle: fileHandle,
      projectName: file.name,
      recentName: file.name
    })

    markProjectLoaded(project)
  }

  useEffect(() => {
    if (!isExportMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return
      if (exportMenuRef.current?.contains(event.target)) return
      setIsExportMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExportMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isExportMenuOpen])

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
        className="glass-effect relative z-[140] rounded-2xl p-5 mb-5 flex justify-between items-center"
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
          <div ref={exportMenuRef} className="relative">
            <Button
              onClick={() => setIsExportMenuOpen((currentValue) => !currentValue)}
              variant="primary"
            >
              <Download className="w-4 h-4" />
              {t('header.export')}
            </Button>
            {isExportMenuOpen ? (
              <motion.div
                className="absolute right-0 top-full z-[120] mt-3 w-64 rounded-2xl border border-white/70 bg-white/90 p-3 shadow-2xl backdrop-blur-xl"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.18 }}
              >
                <p className="px-2 pb-2 text-sm font-semibold text-gray-700">
                  {t('header.exportChoose')}
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false)
                      void handleExportPng()
                    }}
                    className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-3 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700"
                  >
                    {t('header.exportPng')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false)
                      void handleExportSpriteSheet()
                    }}
                    className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-3 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700"
                  >
                    {t('header.exportSpriteSheet')}
                  </button>
                </div>
              </motion.div>
            ) : null}
          </div>
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
