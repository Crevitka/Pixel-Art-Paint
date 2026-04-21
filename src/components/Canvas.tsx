import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { MousePointer } from 'lucide-react'
import { Tool, CanvasSize } from '../types'

interface CanvasProps {
  selectedTool: Tool
  selectedColor: string
  pixelSize: number
  canvasSize: CanvasSize
  isDrawing: boolean
  setIsDrawing: (drawing: boolean) => void
}

const Canvas = ({
  selectedTool,
  selectedColor,
  pixelSize,
  canvasSize,
  isDrawing,
  setIsDrawing
}: CanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [pixels, setPixels] = useState<Map<string, string>>(new Map())

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw grid
    drawGrid(ctx, canvas.width, canvas.height, pixelSize)
    
    // Draw pixels
    drawPixels(ctx, pixels, pixelSize)
  }, [pixelSize, pixels])

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, pixelSize: number) => {
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1

    // Vertical lines
    for (let x = 0; x <= width; x += pixelSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    // Horizontal lines
    for (let y = 0; y <= height; y += pixelSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
  }

  const drawPixels = (ctx: CanvasRenderingContext2D, pixels: Map<string, string>, pixelSize: number) => {
    pixels.forEach((color, key) => {
      const [x, y] = key.split(',').map(Number)
      ctx.fillStyle = color
      ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize)
    })
  }

  const getPixelCoordinates = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((event.clientX - rect.left) / pixelSize)
    const y = Math.floor((event.clientY - rect.top) / pixelSize)

    return { x, y }
  }

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const coords = getPixelCoordinates(event)
    drawPixel(coords.x, coords.y)
  }

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getPixelCoordinates(event)
    setMousePosition(coords)

    if (isDrawing) {
      drawPixel(coords.x, coords.y)
    }
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
  }

  const drawPixel = (x: number, y: number) => {
    if (x < 0 || x >= canvasSize.width || y < 0 || y >= canvasSize.height) return

    const key = `${x},${y}`
    const newPixels = new Map(pixels)

    if (selectedTool === 'eraser') {
      newPixels.delete(key)
    } else if (selectedTool === 'fill') {
      floodFill(x, y, selectedColor)
    } else {
      newPixels.set(key, selectedColor)
    }

    setPixels(newPixels)
  }

  const floodFill = (startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const targetColor = pixels.get(`${startX},${startY}`) || '#ffffff'
    if (targetColor === fillColor) return

    const stack: [number, number][] = [[startX, startY]]
    const newPixels = new Map(pixels)

    while (stack.length > 0) {
      const [x, y] = stack.pop()!
      const key = `${x},${y}`

      if (x < 0 || x >= canvasSize.width || y < 0 || y >= canvasSize.height) continue
      if (newPixels.get(key) !== targetColor) continue

      newPixels.set(key, fillColor)

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
    }

    setPixels(newPixels)
  }

  const canvasWidth = canvasSize.width * pixelSize
  const canvasHeight = canvasSize.height * pixelSize

  return (
    <motion.div 
      className="glass-effect rounded-2xl p-5 flex flex-col items-center justify-center"
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <motion.canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="border-2 border-gray-200 rounded-lg cursor-crosshair bg-white shadow-lg max-w-full h-auto"
        whileHover={{ scale: 1.01 }}
        transition={{ type: "spring", stiffness: 300 }}
      />
      <motion.div 
        className="mt-3 text-sm text-gray-600 font-medium flex items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <MousePointer className="w-4 h-4" />
        Позиция: {mousePosition.x}, {mousePosition.y}
      </motion.div>
    </motion.div>
  )
}

export default Canvas 