import { motion } from 'framer-motion'
import { Pencil, Eraser, PaintBucket, Palette, Settings, Grid3X3 } from 'lucide-react'
import { Tool, CanvasSize } from '../types'
import { cn } from '../lib/utils'

interface ToolbarProps {
  selectedTool: Tool
  onToolChange: (tool: Tool) => void
  selectedColor: string
  onColorChange: (color: string) => void
  pixelSize: number
  onPixelSizeChange: (size: number) => void
  canvasSize: CanvasSize
  onCanvasSizeChange: (size: CanvasSize) => void
}

const Toolbar = ({
  selectedTool,
  onToolChange,
  selectedColor,
  onColorChange,
  pixelSize,
  onPixelSizeChange,
  canvasSize,
  onCanvasSizeChange
}: ToolbarProps) => {
  const presetColors = [
    '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
    '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080',
    '#008000', '#ffc0cb'
  ]

  const tools = [
    { id: 'pencil' as Tool, icon: Pencil, label: 'Карандаш' },
    { id: 'eraser' as Tool, icon: Eraser, label: 'Ластик' },
    { id: 'fill' as Tool, icon: PaintBucket, label: 'Заливка' }
  ]

  const handleCanvasSizeChange = () => {
    onCanvasSizeChange(canvasSize)
  }

  return (
    <motion.div 
      className="glass-effect rounded-2xl p-6 overflow-y-auto max-h-full"
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <div className="space-y-6">
        {/* Tools Section */}
        <motion.div 
          className="space-y-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Инструменты
          </h3>
          <div className="space-y-2">
            {tools.map((tool) => (
              <motion.button
                key={tool.id}
                className={cn(
                  "tool-btn flex items-center gap-3",
                  selectedTool === tool.id && "active"
                )}
                onClick={() => onToolChange(tool.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <tool.icon className="w-5 h-5" />
                {tool.label}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Colors Section */}
        <motion.div 
          className="space-y-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Цвета
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => onColorChange(e.target.value)}
                className="w-full h-10 rounded-lg border-2 border-gray-200 cursor-pointer hover:border-primary-500 transition-colors"
              />
              <label className="text-sm text-gray-600 font-medium">Выбрать цвет</label>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {presetColors.map((color) => (
                <motion.div
                  key={color}
                  className={cn(
                    "color-swatch",
                    selectedColor === color && "selected"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => onColorChange(color)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Pixel Size Section */}
        <motion.div 
          className="space-y-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Размер пикселя
          </h3>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="8"
              max="32"
              value={pixelSize}
              onChange={(e) => onPixelSizeChange(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <span className="font-semibold text-gray-700 min-w-[50px]">{pixelSize}px</span>
          </div>
        </motion.div>

        {/* Canvas Size Section */}
        <motion.div 
          className="space-y-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <Grid3X3 className="w-5 h-5" />
            Размер холста
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="number"
              value={canvasSize.width}
              onChange={(e) => onCanvasSizeChange({ ...canvasSize, width: Number(e.target.value) })}
              min="8"
              max="128"
              className="w-16 px-3 py-2 border-2 border-gray-200 rounded-lg text-center text-sm focus:border-primary-500 focus:outline-none"
            />
            <span className="text-gray-600">×</span>
            <input
              type="number"
              value={canvasSize.height}
              onChange={(e) => onCanvasSizeChange({ ...canvasSize, height: Number(e.target.value) })}
              min="8"
              max="128"
              className="w-16 px-3 py-2 border-2 border-gray-200 rounded-lg text-center text-sm focus:border-primary-500 focus:outline-none"
            />
            <motion.button 
              onClick={handleCanvasSizeChange}
              className="btn-secondary text-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Изменить
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default Toolbar 