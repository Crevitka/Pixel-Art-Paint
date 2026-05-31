import { motion } from 'framer-motion'
import {
  Circle,
  Crop,
  Eraser,
  Eye,
  EyeOff,
  Grip,
  GripVertical,
  Image,
  Layers,
  PaintBucket,
  Palette,
  Pencil,
  Pipette,
  Plus,
  Settings,
  Square,
  Trash2,
  X
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from 'react'
import { useCanvasContext } from '@/features/canvas'
import { useColorContext } from '@/features/colors'
import { ToolButton, useToolContext } from '@/features/tools'

export type ToolbarBlockId = 'tools' | 'reference' | 'palette' | 'brush' | 'layers'
export type ToolbarPanelId = 'left' | 'center' | 'right'

type DragOverTarget = {
  panelId: ToolbarPanelId
  blockId: ToolbarBlockId | null
} | null

type LayerDropTarget = {
  layerId: string
  position: 'before' | 'after'
} | null

type PaletteDropTarget = {
  index: number
  position: 'before' | 'after'
} | null

type ToolbarWidgetProps = {
  panelId: ToolbarPanelId
  blockIds: ToolbarBlockId[]
  draggingBlockId: ToolbarBlockId | null
  dragOverTarget: DragOverTarget
  onBlockDragStart: (blockId: ToolbarBlockId, panelId: ToolbarPanelId) => void
  onBlockDragEnd: () => void
  onBlockDragOver: (panelId: ToolbarPanelId, blockId: ToolbarBlockId | null) => void
  onBlockDrop: (panelId: ToolbarPanelId, blockId: ToolbarBlockId | null) => void
}

const tools = [
  { id: 'pencil' as const, icon: Pencil, label: 'Карандаш' },
  { id: 'eraser' as const, icon: Eraser, label: 'Ластик' },
  { id: 'fill' as const, icon: PaintBucket, label: 'Заливка' },
  { id: 'selection' as const, icon: Crop, label: 'Выделение' },
  { id: 'rectangle' as const, icon: Square, label: 'Квадрат' },
  { id: 'ellipse' as const, icon: Circle, label: 'Круг' },
  { id: 'eyedropper' as const, icon: Pipette, label: 'Пипетка' }
]

const PANEL_ACCEPTED_BLOCKS: Record<ToolbarPanelId, ToolbarBlockId[]> = {
  left: ['tools', 'reference', 'palette', 'brush', 'layers'],
  center: ['tools'],
  right: ['tools', 'reference', 'palette', 'brush', 'layers']
}

export function ToolbarWidget({
  panelId,
  blockIds,
  draggingBlockId,
  dragOverTarget,
  onBlockDragStart,
  onBlockDragEnd,
  onBlockDragOver,
  onBlockDrop
}: ToolbarWidgetProps) {
  const { selectedTool, setSelectedTool, brushSize, setBrushSize } = useToolContext()
  const {
    selectedColor,
    setSelectedColor,
    pickerColor,
    setPickerColor,
    paletteColors,
    palettePresets,
    activePalettePresetId,
    applyPalettePreset,
    createPalettePreset,
    addPaletteColor,
    updatePaletteColor,
    reorderPaletteColor
  } = useColorContext()
  const {
    layers,
    activeLayerId,
    setActiveLayerId,
    addLayer,
    reorderLayer,
    removeLayer,
    toggleLayerVisibility,
    renameLayer,
    referenceImageUrl,
    setReferenceImageUrl,
    referenceOpacity,
    setReferenceOpacity,
    referenceScale,
    setReferenceScale,
    isReferenceVisible,
    setIsReferenceVisible
  } = useCanvasContext()

  const [editingLayerId, setEditingLayerId] = useState<string | null>(null)
  const [editingLayerName, setEditingLayerName] = useState('')
  const [editingPaletteColorIndex, setEditingPaletteColorIndex] = useState<number | null>(null)
  const [draggingPaletteColorIndex, setDraggingPaletteColorIndex] = useState<number | null>(null)
  const [paletteDropTarget, setPaletteDropTarget] = useState<PaletteDropTarget>(null)
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null)
  const [layerDropTarget, setLayerDropTarget] = useState<LayerDropTarget>(null)
  const editingInputRef = useRef<HTMLInputElement>(null)
  const paletteColorInputRef = useRef<HTMLInputElement>(null)
  const paletteEditColorInputRef = useRef<HTMLInputElement>(null)
  const referenceInputRef = useRef<HTMLInputElement>(null)
  const paletteColorDraftRef = useRef<string | null>(null)
  const isPaletteColorPickerOpenRef = useRef(false)
  const paletteEditColorDraftRef = useRef<string | null>(null)
  const isPaletteEditColorPickerOpenRef = useRef(false)

  const isCenterPanel = panelId === 'center'

  const canPanelAcceptBlock = (blockId: ToolbarBlockId) => PANEL_ACCEPTED_BLOCKS[panelId].includes(blockId)

  useEffect(() => {
    if (!editingLayerId) return
    editingInputRef.current?.focus()
    editingInputRef.current?.select()
  }, [editingLayerId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'F2') return
      if (editingLayerId) return

      const activeLayer = layers.find((layer) => layer.id === activeLayerId)
      if (!activeLayer) return

      event.preventDefault()
      setEditingLayerId(activeLayer.id)
      setEditingLayerName(activeLayer.name)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeLayerId, editingLayerId, layers])

  const handleAddPaletteColor = () => {
    paletteColorDraftRef.current = pickerColor
    isPaletteColorPickerOpenRef.current = true
    paletteColorInputRef.current?.click()
  }

  const handlePaletteColorPreview = (color: string) => {
    paletteColorDraftRef.current = color
    setPickerColor(color)
  }

  const commitPaletteColorPicked = () => {
    if (!isPaletteColorPickerOpenRef.current) return

    isPaletteColorPickerOpenRef.current = false
    const color = paletteColorDraftRef.current
    if (!color) return
    addPaletteColor(color)
  }

  const handleEditPaletteColor = (index: number, color: string) => {
    setEditingPaletteColorIndex(index)
    paletteEditColorDraftRef.current = color
    isPaletteEditColorPickerOpenRef.current = true
    setPickerColor(color)
    paletteEditColorInputRef.current?.click()
  }

  const handlePaletteEditColorPreview = (color: string) => {
    paletteEditColorDraftRef.current = color
    setPickerColor(color)
  }

  const commitPaletteEditColorPicked = () => {
    if (!isPaletteEditColorPickerOpenRef.current) return

    isPaletteEditColorPickerOpenRef.current = false
    const color = paletteEditColorDraftRef.current
    const index = editingPaletteColorIndex

    setEditingPaletteColorIndex(null)

    if (!color || index === null) return
    updatePaletteColor(index, color)
  }

  const handlePaletteColorDragStart = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.stopPropagation()
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
    setDraggingPaletteColorIndex(index)
    setPaletteDropTarget(null)
  }

  const handlePaletteColorDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    if (draggingPaletteColorIndex === null || draggingPaletteColorIndex === index) return

    event.preventDefault()
    event.stopPropagation()

    const bounds = event.currentTarget.getBoundingClientRect()
    const position = event.clientX - bounds.left < bounds.width / 2 ? 'before' : 'after'

    setPaletteDropTarget((currentTarget) => {
      if (currentTarget?.index === index && currentTarget.position === position) {
        return currentTarget
      }

      return { index, position }
    })
  }

  const handlePaletteColorDrop = (event: DragEvent<HTMLDivElement>, index: number) => {
    if (draggingPaletteColorIndex === null || draggingPaletteColorIndex === index) return

    event.preventDefault()
    event.stopPropagation()

    const position = paletteDropTarget?.index === index ? paletteDropTarget.position : 'before'
    const targetIndex = position === 'after' ? index + 1 : index
    const adjustedTargetIndex =
      draggingPaletteColorIndex < targetIndex ? targetIndex - 1 : targetIndex

    const boundedTargetIndex = Math.max(0, Math.min(paletteColors.length - 1, adjustedTargetIndex))

    reorderPaletteColor(draggingPaletteColorIndex, boundedTargetIndex)
    setDraggingPaletteColorIndex(null)
    setPaletteDropTarget(null)
  }

  const handlePaletteColorDragEnd = () => {
    setDraggingPaletteColorIndex(null)
    setPaletteDropTarget(null)
  }

  const handleOpenReferencePicker = () => {
    referenceInputRef.current?.click()
  }

  const handleReferenceFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (referenceImageUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(referenceImageUrl)
    }

    setReferenceImageUrl(URL.createObjectURL(file))
    setIsReferenceVisible(true)
    event.target.value = ''
  }

  const handleRemoveReference = () => {
    if (referenceImageUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(referenceImageUrl)
    }

    setReferenceImageUrl(null)
  }

  const startLayerRename = (layerId: string, layerName: string) => {
    setEditingLayerId(layerId)
    setEditingLayerName(layerName)
  }

  const submitLayerRename = () => {
    if (!editingLayerId) return
    renameLayer(editingLayerId, editingLayerName)
    setEditingLayerId(null)
    setEditingLayerName('')
  }

  const cancelLayerRename = () => {
    setEditingLayerId(null)
    setEditingLayerName('')
  }

  const handleLayerNameKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      submitLayerRename()
      return
    }

    if (event.key === 'Escape') {
      cancelLayerRename()
    }
  }

  const handleLayerDragStart = (event: DragEvent<HTMLButtonElement>, layerId: string) => {
    event.stopPropagation()
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', layerId)
    setDraggingLayerId(layerId)
    setLayerDropTarget(null)
  }

  const handleLayerDragOver = (event: DragEvent<HTMLDivElement>, layerId: string) => {
    if (!draggingLayerId || draggingLayerId === layerId) return

    event.preventDefault()
    event.stopPropagation()

    const bounds = event.currentTarget.getBoundingClientRect()
    const position = event.clientY - bounds.top < bounds.height / 2 ? 'before' : 'after'

    setLayerDropTarget((currentTarget) => {
      if (currentTarget?.layerId === layerId && currentTarget.position === position) {
        return currentTarget
      }

      return { layerId, position }
    })
  }

  const handleLayerDrop = (event: DragEvent<HTMLDivElement>, layerId: string) => {
    if (!draggingLayerId || draggingLayerId === layerId) return

    event.preventDefault()
    event.stopPropagation()

    const position = layerDropTarget?.layerId === layerId ? layerDropTarget.position : 'before'
    reorderLayer(draggingLayerId, layerId, position)
    setDraggingLayerId(null)
    setLayerDropTarget(null)
  }

  const handleLayerDragEnd = () => {
    setDraggingLayerId(null)
    setLayerDropTarget(null)
  }

  const renderHeader = (
    blockId: ToolbarBlockId,
    icon: ReactNode,
    title: string,
    extra?: ReactNode
  ) => (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', blockId)
        onBlockDragStart(blockId, panelId)
      }}
      onDragEnd={onBlockDragEnd}
      className="flex cursor-grab items-center justify-between gap-3 rounded-xl border border-transparent px-1 py-1 active:cursor-grabbing"
      title="Перетащите блок за заголовок"
    >
      <div className="flex items-center gap-2 text-lg font-semibold text-gray-700">
        <GripVertical className="h-4 w-4 text-gray-400" />
        {icon}
        {title}
      </div>
      {extra}
    </div>
  )

  const handleBlockDragOver = (event: DragEvent<HTMLDivElement>, blockId: ToolbarBlockId | null) => {
    if (!draggingBlockId || draggingBlockId === blockId || !canPanelAcceptBlock(draggingBlockId)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    onBlockDragOver(panelId, blockId)
  }

  const handleBlockDropInternal = (event: DragEvent<HTMLDivElement>, blockId: ToolbarBlockId | null) => {
    if (!draggingBlockId || !canPanelAcceptBlock(draggingBlockId)) return
    event.preventDefault()
    onBlockDrop(panelId, blockId)
  }

  const renderCenterToolsHandle = () => (
    <div
      className="tool-btn pointer-events-none flex h-12 w-12 items-center justify-center border border-dashed border-gray-200 bg-transparent p-0 text-gray-400"
      aria-hidden="true"
    >
      <Grip className="h-4 w-4 rotate-90" />
    </div>
  )

  const renderBlock = (blockId: ToolbarBlockId) => {
    if (!canPanelAcceptBlock(blockId)) {
      return null
    }

    const isDragging = draggingBlockId === blockId
    const isDropTarget =
      dragOverTarget?.panelId === panelId &&
      dragOverTarget.blockId === blockId &&
      draggingBlockId !== blockId

    const wrapperProps = {
      className: `${isCenterPanel ? 'rounded-2xl border-2 p-2' : 'space-y-3 rounded-2xl border-2 p-3'} transition-colors ${
        isDropTarget
          ? 'border-primary-500 bg-primary-50/60'
          : 'border-transparent bg-transparent'
      } ${isDragging ? 'opacity-60' : ''} ${
        isCenterPanel && blockId === 'tools' ? 'cursor-grab active:cursor-grabbing' : ''
      }`,
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      onDragOver: (event: DragEvent<HTMLDivElement>) => handleBlockDragOver(event, blockId),
      onDrop: (event: DragEvent<HTMLDivElement>) => handleBlockDropInternal(event, blockId)
    }

    if (blockId === 'tools') {
      return (
        <motion.div
          key={blockId}
          {...wrapperProps}
          draggable={isCenterPanel}
          onDragStartCapture={
            isCenterPanel
              ? (event: DragEvent<HTMLDivElement>) => {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', blockId)
                  onBlockDragStart(blockId, panelId)
                }
              : undefined
          }
          onDragEndCapture={isCenterPanel ? onBlockDragEnd : undefined}
          title={isCenterPanel ? 'Перетащите панель инструментов' : undefined}
          transition={{ delay: 0.15 }}
        >
          {isCenterPanel ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {renderCenterToolsHandle()}
              {tools.map((tool) => (
                <ToolButton
                  key={tool.id}
                  tool={tool.id}
                  icon={tool.icon}
                  label={tool.label}
                  isActive={selectedTool === tool.id}
                  onClick={() => setSelectedTool(tool.id)}
                  iconOnly
                />
              ))}
            </div>
          ) : (
            <>
              {renderHeader(blockId, <Pencil className="h-5 w-5" />, 'Инструменты')}
              <div className="space-y-2">
                {tools.map((tool) => (
                  <ToolButton
                    key={tool.id}
                    tool={tool.id}
                    icon={tool.icon}
                    label={tool.label}
                    isActive={selectedTool === tool.id}
                    onClick={() => setSelectedTool(tool.id)}
                  />
                ))}
              </div>
            </>
          )}
        </motion.div>
      )
    }

    if (blockId === 'reference') {
      return (
        <motion.div key={blockId} {...wrapperProps} transition={{ delay: 0.18 }}>
          {renderHeader(blockId, <Image className="h-5 w-5" />, 'Референс')}
          <div className="space-y-4">
            <input
              ref={referenceInputRef}
              type="file"
              accept="image/*"
              onChange={handleReferenceFileChange}
              className="hidden"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleOpenReferencePicker}
                className="flex-1 min-w-[180px] rounded-lg border-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-primary-500 hover:bg-primary-50 hover:text-primary-700"
              >
                {referenceImageUrl ? 'Заменить' : 'Добавить'}
              </button>
              <button
                type="button"
                onClick={() => setIsReferenceVisible(!isReferenceVisible)}
                disabled={!referenceImageUrl}
                className="rounded-lg border-2 border-gray-200 bg-gray-50 p-2 text-gray-700 transition-colors hover:border-primary-500 hover:bg-primary-50 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
                title={isReferenceVisible ? 'Скрыть референс' : 'Показать референс'}
                aria-label={isReferenceVisible ? 'Скрыть референс' : 'Показать референс'}
              >
                {isReferenceVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={handleRemoveReference}
                disabled={!referenceImageUrl}
                className="rounded-lg border-2 border-gray-200 bg-gray-50 p-2 text-gray-700 transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                title="Удалить референс"
                aria-label="Удалить референс"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-700">Прозрачность</span>
                <span className="min-w-[52px] text-right font-semibold text-gray-700">
                  {Math.round(referenceOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={referenceOpacity}
                onChange={(event) => setReferenceOpacity(Number(event.target.value))}
                disabled={!referenceImageUrl}
                className="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-700">Масштаб</span>
                <span className="min-w-[52px] text-right font-semibold text-gray-700">
                  {Math.round(referenceScale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="4"
                step="0.05"
                value={referenceScale}
                onChange={(event) => setReferenceScale(Number(event.target.value))}
                disabled={!referenceImageUrl}
                className="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
              />
            </div>
          </div>
        </motion.div>
      )
    }

    if (blockId === 'palette') {
      return (
        <motion.div key={blockId} {...wrapperProps} transition={{ delay: 0.2 }}>
          {renderHeader(blockId, <Palette className="h-5 w-5" />, 'Палитра')}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <select
                value={activePalettePresetId}
                onChange={(event) => applyPalettePreset(event.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-primary-400 focus:border-primary-500 focus:outline-none"
              >
                {palettePresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={createPalettePreset}
                className="flex h-11 shrink-0 items-center justify-center rounded-xl border-2 border-gray-200 bg-gray-50 px-3 text-gray-600 transition-colors hover:border-primary-500 hover:bg-primary-50 hover:text-primary-700"
                title="Создать палитру из текущих цветов"
                aria-label="Создать палитру из текущих цветов"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {paletteColors.map((color, index) => (
                <div
                  key={`${color}-${index}`}
                  draggable
                  onDragStart={(event) => handlePaletteColorDragStart(event, index)}
                  onDragOver={(event) => handlePaletteColorDragOver(event, index)}
                  onDrop={(event) => handlePaletteColorDrop(event, index)}
                  onDragEnd={handlePaletteColorDragEnd}
                  className={`color-swatch relative ${selectedColor === color ? 'selected' : ''} ${
                    draggingPaletteColorIndex === index ? 'opacity-60' : ''
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    setSelectedColor(color)
                    setPickerColor(color)
                  }}
                  onDoubleClick={() => handleEditPaletteColor(index, color)}
                >
                  {paletteDropTarget?.index === index ? (
                    <div
                      className={`pointer-events-none absolute top-1 bottom-1 w-0.5 rounded-full bg-primary-500 ${
                        paletteDropTarget.position === 'before' ? 'left-0' : 'right-0'
                      }`}
                    />
                  ) : null}
                </div>
              ))}
              <input
                ref={paletteEditColorInputRef}
                type="color"
                value={pickerColor}
                onInput={(event) => handlePaletteEditColorPreview((event.target as HTMLInputElement).value)}
                onChange={commitPaletteEditColorPicked}
                onBlur={commitPaletteEditColorPicked}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
              <input
                ref={paletteColorInputRef}
                type="color"
                value={pickerColor}
                onInput={(event) => handlePaletteColorPreview((event.target as HTMLInputElement).value)}
                onChange={commitPaletteColorPicked}
                onBlur={commitPaletteColorPicked}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={handleAddPaletteColor}
                className="flex aspect-square w-full items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-500 transition-colors hover:border-primary-500 hover:bg-primary-50 hover:text-primary-700"
                title="Добавить цвет в палитру"
                aria-label="Добавить цвет в палитру"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )
    }

    if (blockId === 'brush') {
      return (
        <motion.div key={blockId} {...wrapperProps} transition={{ delay: 0.25 }}>
          {renderHeader(blockId, <Settings className="h-5 w-5" />, 'Размер кисти')}
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="8"
              value={brushSize}
              onChange={(event) => setBrushSize(Number(event.target.value))}
              className="slider h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200"
            />
            <span className="min-w-[50px] font-semibold text-gray-700">{brushSize}px</span>
          </div>
        </motion.div>
      )
    }

    return (
      <motion.div key={blockId} {...wrapperProps} transition={{ delay: 0.3 }}>
        {renderHeader(
          blockId,
          <Layers className="h-5 w-5" />,
          'Слои',
          <button
            type="button"
            onClick={addLayer}
            className="rounded-lg border-2 border-gray-200 bg-gray-50 p-2 text-gray-700 transition-colors hover:border-primary-500 hover:bg-primary-50 hover:text-primary-700"
            title="Добавить слой"
            aria-label="Добавить слой"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
        <div className="space-y-2">
          {layers.map((layer) => (
            <div
              key={layer.id}
              onDragOver={(event) => handleLayerDragOver(event, layer.id)}
              onDrop={(event) => handleLayerDrop(event, layer.id)}
              className={`relative flex items-center gap-2 rounded-lg border-2 px-3 py-2 transition-colors ${
                activeLayerId === layer.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'
              } ${draggingLayerId === layer.id ? 'opacity-60' : ''}`}
            >
              {layerDropTarget?.layerId === layer.id ? (
                <div
                  className={`pointer-events-none absolute left-2 right-2 h-0.5 rounded-full bg-primary-500 ${
                    layerDropTarget.position === 'before' ? 'top-0' : 'bottom-0'
                  }`}
                />
              ) : null}
              <button
                type="button"
                draggable
                onDragStart={(event) => handleLayerDragStart(event, layer.id)}
                onDragEnd={handleLayerDragEnd}
                className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                title="Перетащить слой"
                aria-label="Перетащить слой"
              >
                <GripVertical className="h-4 w-4" />
              </button>
              {editingLayerId === layer.id ? (
                <input
                  ref={editingInputRef}
                  type="text"
                  value={editingLayerName}
                  onChange={(event) => setEditingLayerName(event.target.value)}
                  onBlur={submitLayerRename}
                  onKeyDown={handleLayerNameKeyDown}
                  className="min-w-0 flex-1 rounded-md border border-primary-300 bg-white px-2 py-1 text-sm font-medium text-gray-700 outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveLayerId(layer.id)}
                  onDoubleClick={() => startLayerRename(layer.id, layer.name)}
                  className="min-w-0 flex-1 truncate text-left text-sm font-medium text-gray-700"
                  title={layer.name}
                >
                  {layer.name}
                </button>
              )}
              <button
                type="button"
                onClick={() => toggleLayerVisibility(layer.id)}
                className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                title={layer.visible ? 'Скрыть слой' : 'Показать слой'}
                aria-label={layer.visible ? 'Скрыть слой' : 'Показать слой'}
              >
                {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => removeLayer(layer.id)}
                disabled={layers.length === 1}
                className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                title="Удалить слой"
                aria-label="Удалить слой"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    )
  }

  const isEmptyDropTarget = dragOverTarget?.panelId === panelId && dragOverTarget.blockId === null
  const emptyDropLabel = isCenterPanel ? 'Перетащите сюда инструменты' : 'Перетащите сюда блок'

  return (
    <motion.aside
      className={`glass-effect rounded-2xl min-w-0 ${
        isCenterPanel ? 'overflow-hidden p-4' : 'max-h-full overflow-y-auto p-6'
      }`}
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      onDragOver={(event) => {
        if (!draggingBlockId || blockIds.length > 0 || !canPanelAcceptBlock(draggingBlockId)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        onBlockDragOver(panelId, null)
      }}
      onDrop={(event) => {
        if (blockIds.length > 0 || !draggingBlockId || !canPanelAcceptBlock(draggingBlockId)) return
        event.preventDefault()
        onBlockDrop(panelId, null)
      }}
    >
      <div className={isCenterPanel ? 'space-y-3' : 'space-y-6'}>
        {blockIds.length === 0 ? (
          <div
            className={`flex items-center justify-center rounded-2xl border-2 border-dashed px-4 text-center text-sm font-medium transition-colors ${
              isEmptyDropTarget
                ? 'border-primary-500 bg-primary-50/70 text-primary-700'
                : 'border-gray-300 bg-white/35 text-gray-500'
            } ${isCenterPanel ? 'min-h-[88px]' : 'min-h-[120px]'}`}
          >
            {emptyDropLabel}
          </div>
        ) : null}
        {blockIds.map((blockId) => renderBlock(blockId))}
      </div>
    </motion.aside>
  )
}
