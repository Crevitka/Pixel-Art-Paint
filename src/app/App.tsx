import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { HeaderWidget } from '@/widgets/header'
import { ToolbarWidget, type ToolbarBlockId, type ToolbarPanelId } from '@/widgets/toolbar'
import { CanvasWidget } from '@/widgets/canvas'

type DragOverTarget = {
  panelId: ToolbarPanelId
  blockId: ToolbarBlockId | null
} | null

type PanelBlocks = Record<ToolbarPanelId, ToolbarBlockId[]>

const INITIAL_PANEL_BLOCKS: PanelBlocks = {
  left: ['tools', 'canvas', 'palette', 'brush', 'layers'],
  center: [],
  right: []
}

const PANEL_ACCEPTED_BLOCKS: Record<ToolbarPanelId, ToolbarBlockId[]> = {
  left: ['tools', 'canvas', 'palette', 'brush', 'layers'],
  center: ['tools'],
  right: ['tools', 'canvas', 'palette', 'brush', 'layers']
}

export function App() {
  const [panelBlocks, setPanelBlocks] = useState<PanelBlocks>(INITIAL_PANEL_BLOCKS)
  const [draggingBlockId, setDraggingBlockId] = useState<ToolbarBlockId | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<DragOverTarget>(null)

  const centerPanelHasBlocks = panelBlocks.center.length > 0
  const rightPanelHasBlocks = panelBlocks.right.length > 0
  const shouldShowCenterPanel = centerPanelHasBlocks || draggingBlockId === 'tools'
  const shouldShowRightPanel = rightPanelHasBlocks || draggingBlockId !== null
  const desktopGridClass = shouldShowRightPanel
    ? 'lg:grid-cols-[300px_minmax(0,1fr)_300px]'
    : 'lg:grid-cols-[300px_minmax(0,1fr)]'

  const blockPanelMap = useMemo(() => {
    const map = new Map<ToolbarBlockId, ToolbarPanelId>()
    panelBlocks.left.forEach((blockId) => map.set(blockId, 'left'))
    panelBlocks.center.forEach((blockId) => map.set(blockId, 'center'))
    panelBlocks.right.forEach((blockId) => map.set(blockId, 'right'))
    return map
  }, [panelBlocks])

  const moveBlock = (blockId: ToolbarBlockId, targetPanelId: ToolbarPanelId, targetBlockId: ToolbarBlockId | null) => {
    const sourcePanelId = blockPanelMap.get(blockId)
    if (!sourcePanelId) return
    if (!PANEL_ACCEPTED_BLOCKS[targetPanelId].includes(blockId)) return

    setPanelBlocks((currentPanels) => {
      const sourcePanelBlocks = currentPanels[sourcePanelId]
      const sourceIndex = sourcePanelBlocks.indexOf(blockId)
      const nextPanels: PanelBlocks = {
        left: currentPanels.left.filter((id) => id !== blockId),
        center: currentPanels.center.filter((id) => id !== blockId),
        right: currentPanels.right.filter((id) => id !== blockId)
      }

      const targetPanelBlocks = [...nextPanels[targetPanelId]]
      const rawTargetIndex = targetBlockId ? targetPanelBlocks.indexOf(targetBlockId) : -1

      let targetIndex = rawTargetIndex
      if (
        sourcePanelId === targetPanelId &&
        targetBlockId &&
        sourceIndex !== -1 &&
        rawTargetIndex !== -1 &&
        sourceIndex < currentPanels[targetPanelId].indexOf(targetBlockId)
      ) {
        targetIndex = rawTargetIndex + 1
      }

      if (targetIndex === -1) {
        targetPanelBlocks.push(blockId)
      } else {
        targetPanelBlocks.splice(targetIndex, 0, blockId)
      }

      nextPanels[targetPanelId] = targetPanelBlocks
      return nextPanels
    })
  }

  const handleBlockDragStart = (blockId: ToolbarBlockId) => {
    setDraggingBlockId(blockId)
  }

  const handleBlockDragEnd = () => {
    setDraggingBlockId(null)
    setDragOverTarget(null)
  }

  const handleBlockDragOver = (panelId: ToolbarPanelId, blockId: ToolbarBlockId | null) => {
    setDragOverTarget({ panelId, blockId })
  }

  const handleBlockDrop = (panelId: ToolbarPanelId, blockId: ToolbarBlockId | null) => {
    if (!draggingBlockId) return

    moveBlock(draggingBlockId, panelId, blockId)
    setDraggingBlockId(null)
    setDragOverTarget(null)
  }

  const mobileBlockOrder = [...panelBlocks.left, ...panelBlocks.center, ...panelBlocks.right]

  return (
    <motion.div
      className="max-w-7xl mx-auto p-5 h-screen overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <HeaderWidget />
      <main className={`grid grid-cols-1 ${desktopGridClass} gap-5 h-[calc(100vh-140px)] min-h-0`}>
        <div className="hidden lg:block min-h-0">
          <ToolbarWidget
            panelId="left"
            blockIds={panelBlocks.left}
            draggingBlockId={draggingBlockId}
            dragOverTarget={dragOverTarget}
            onBlockDragStart={handleBlockDragStart}
            onBlockDragEnd={handleBlockDragEnd}
            onBlockDragOver={handleBlockDragOver}
            onBlockDrop={handleBlockDrop}
          />
        </div>

        <div className={`min-h-0 h-full flex flex-col ${shouldShowCenterPanel ? 'gap-4' : ''}`}>
          {shouldShowCenterPanel ? (
            <div className="hidden lg:block shrink-0">
              <ToolbarWidget
                panelId="center"
                blockIds={panelBlocks.center}
                draggingBlockId={draggingBlockId}
                dragOverTarget={dragOverTarget}
                onBlockDragStart={handleBlockDragStart}
                onBlockDragEnd={handleBlockDragEnd}
                onBlockDragOver={handleBlockDragOver}
                onBlockDrop={handleBlockDrop}
              />
            </div>
          ) : null}

          <div className="min-h-0 h-full flex-1">
            <CanvasWidget />
          </div>
        </div>

        {shouldShowRightPanel ? (
          <div className="hidden lg:block min-h-0">
            <ToolbarWidget
              panelId="right"
              blockIds={panelBlocks.right}
              draggingBlockId={draggingBlockId}
              dragOverTarget={dragOverTarget}
              onBlockDragStart={handleBlockDragStart}
              onBlockDragEnd={handleBlockDragEnd}
              onBlockDragOver={handleBlockDragOver}
              onBlockDrop={handleBlockDrop}
            />
          </div>
        ) : null}

        <div className="lg:hidden min-h-0">
          <ToolbarWidget
            panelId="left"
            blockIds={mobileBlockOrder}
            draggingBlockId={null}
            dragOverTarget={null}
            onBlockDragStart={() => {}}
            onBlockDragEnd={() => {}}
            onBlockDragOver={() => {}}
            onBlockDrop={() => {}}
          />
        </div>
      </main>
    </motion.div>
  )
}
