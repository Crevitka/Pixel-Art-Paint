import { motion } from 'framer-motion'
import { HeaderWidget } from '@/widgets/header'
import { CanvasWidget } from '@/widgets/canvas'
import { ToolbarWidget, type ToolbarBlockId, type ToolbarPanelId } from '@/widgets/toolbar'

type DragOverTarget = {
  panelId: ToolbarPanelId
  blockId: ToolbarBlockId | null
} | null

type EditorPageProps = {
  currentProjectHandle: FileSystemFileHandle | null
  currentProjectName: string | null
  onProjectFileChange: (handle: FileSystemFileHandle | null, name: string | null) => void
  panelBlocks: Record<ToolbarPanelId, ToolbarBlockId[]>
  draggingBlockId: ToolbarBlockId | null
  dragOverTarget: DragOverTarget
  onBlockDragStart: (blockId: ToolbarBlockId) => void
  onBlockDragEnd: () => void
  onBlockDragOver: (panelId: ToolbarPanelId, blockId: ToolbarBlockId | null) => void
  onBlockDrop: (panelId: ToolbarPanelId, blockId: ToolbarBlockId | null) => void
}

export function EditorPage({
  currentProjectHandle,
  currentProjectName,
  onProjectFileChange,
  panelBlocks,
  draggingBlockId,
  dragOverTarget,
  onBlockDragStart,
  onBlockDragEnd,
  onBlockDragOver,
  onBlockDrop
}: EditorPageProps) {
  const centerPanelHasBlocks = panelBlocks.center.length > 0
  const rightPanelHasBlocks = panelBlocks.right.length > 0
  const shouldShowCenterPanel = centerPanelHasBlocks || draggingBlockId === 'tools'
  const shouldShowRightPanel = rightPanelHasBlocks || draggingBlockId !== null
  const desktopGridClass = shouldShowRightPanel
    ? 'lg:grid-cols-[300px_minmax(0,1fr)_300px]'
    : 'lg:grid-cols-[300px_minmax(0,1fr)]'
  const mobileBlockOrder = [...panelBlocks.left, ...panelBlocks.center, ...panelBlocks.right]

  return (
    <motion.div
      className="max-w-7xl mx-auto p-5 h-screen overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <HeaderWidget
        currentProjectHandle={currentProjectHandle}
        currentProjectName={currentProjectName}
        onProjectFileChange={onProjectFileChange}
      />
      <main className={`grid grid-cols-1 ${desktopGridClass} gap-5 h-[calc(100vh-140px)] min-h-0`}>
        <div className="hidden lg:block min-h-0">
          <ToolbarWidget
            panelId="left"
            blockIds={panelBlocks.left}
            draggingBlockId={draggingBlockId}
            dragOverTarget={dragOverTarget}
            onBlockDragStart={onBlockDragStart}
            onBlockDragEnd={onBlockDragEnd}
            onBlockDragOver={onBlockDragOver}
            onBlockDrop={onBlockDrop}
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
                onBlockDragStart={onBlockDragStart}
                onBlockDragEnd={onBlockDragEnd}
                onBlockDragOver={onBlockDragOver}
                onBlockDrop={onBlockDrop}
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
              onBlockDragStart={onBlockDragStart}
              onBlockDragEnd={onBlockDragEnd}
              onBlockDragOver={onBlockDragOver}
              onBlockDrop={onBlockDrop}
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
