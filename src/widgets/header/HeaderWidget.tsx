import { motion } from 'framer-motion'
import { useState } from 'react'
import { Palette, Download, Trash2, Settings } from 'lucide-react'
import { useCanvasContext } from '@/features/canvas'
import { Button } from '@/shared/ui/Button'
import { SettingsWidget } from '@/widgets/settings'

export function HeaderWidget() {
  const { canvasSize, clearCanvas, layers } = useCanvasContext()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const handleClear = () => {
    clearCanvas()
  }

  const handleSave = async () => {
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
      showSaveFilePicker?: (options?: {
        suggestedName?: string
        types?: Array<{
          description?: string
          accept: Record<string, string[]>
        }>
      }) => Promise<{
        createWritable: () => Promise<{
          write: (data: Blob) => Promise<void>
          close: () => Promise<void>
        }>
      }>
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
            onClick={handleSave}
            variant="primary"
          >
            <Download className="w-4 h-4" />
            Сохранить
          </Button>
        </div>
      </motion.header>
      {isSettingsOpen ? <SettingsWidget onClose={() => setIsSettingsOpen(false)} /> : null}
    </>
  )
}
