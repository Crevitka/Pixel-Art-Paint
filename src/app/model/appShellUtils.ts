import type { PanelBlocks, ToolbarBlockId, ToolbarPanelId } from './sessionPersistence'

export function movePanelBlock(options: {
  currentPanels: PanelBlocks
  blockId: ToolbarBlockId
  sourcePanelId: ToolbarPanelId
  targetPanelId: ToolbarPanelId
  targetBlockId: ToolbarBlockId | null
}) {
  const sourcePanelBlocks = options.currentPanels[options.sourcePanelId]
  const sourceIndex = sourcePanelBlocks.indexOf(options.blockId)
  const nextPanels: PanelBlocks = {
    left: options.currentPanels.left.filter((id) => id !== options.blockId),
    center: options.currentPanels.center.filter((id) => id !== options.blockId),
    right: options.currentPanels.right.filter((id) => id !== options.blockId)
  }

  const targetPanelBlocks = [...nextPanels[options.targetPanelId]]
  const rawTargetIndex = options.targetBlockId
    ? targetPanelBlocks.indexOf(options.targetBlockId)
    : -1

  let targetIndex = rawTargetIndex
  if (
    options.sourcePanelId === options.targetPanelId &&
    options.targetBlockId &&
    sourceIndex !== -1 &&
    rawTargetIndex !== -1 &&
    sourceIndex < options.currentPanels[options.targetPanelId].indexOf(options.targetBlockId)
  ) {
    targetIndex = rawTargetIndex + 1
  }

  if (targetIndex === -1) {
    targetPanelBlocks.push(options.blockId)
  } else {
    targetPanelBlocks.splice(targetIndex, 0, options.blockId)
  }

  nextPanels[options.targetPanelId] = targetPanelBlocks
  return nextPanels
}
