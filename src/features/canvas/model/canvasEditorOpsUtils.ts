import type { AnimationFrame, Layer } from '@/shared/types'
import { cloneLayers } from './canvasSessionUtils'
import { removeFrameFromState, removeLayerFromFrameState } from './canvasStateUtils'

export type CanvasFrameMutationResult = {
  frames: AnimationFrame[]
  activeFrameId: string
  selectedLayerIds: string[]
  selectionAnchorLayerId: string
  nextFrameNumber: number
}

export type CanvasLayerMutationResult = {
  frame: AnimationFrame
  selectedLayerIds: string[]
  selectionAnchorLayerId: string
}

function createLayer(id: string, name: string): Layer {
  return {
    id,
    name,
    visible: true,
    pixels: new Map()
  }
}

export function addFrameToState(options: {
  frames: AnimationFrame[]
  activeFrameId: string
  nextFrameNumber: number
  getFrameLabel: (number: number) => string
  getDefaultLayerName: (number: number) => string
}) {
  const {
    frames,
    activeFrameId,
    nextFrameNumber,
    getFrameLabel,
    getDefaultLayerName
  } = options
  const nextFrameId = `frame-${nextFrameNumber}`
  const sourceFrame = frames.find((frame) => frame.id === activeFrameId) ?? frames[0]

  const nextFrame: AnimationFrame = sourceFrame
    ? {
        id: nextFrameId,
        name: getFrameLabel(nextFrameNumber),
        layers: cloneLayers(sourceFrame.layers),
        activeLayerId: sourceFrame.activeLayerId,
        nextLayerNumber: sourceFrame.nextLayerNumber
      }
    : {
        id: nextFrameId,
        name: getFrameLabel(nextFrameNumber),
        layers: [createLayer('layer-1', getDefaultLayerName(1))],
        activeLayerId: 'layer-1',
        nextLayerNumber: 2
      }

  const sourceIndex = frames.findIndex((frame) => frame.id === activeFrameId)
  const insertIndex = sourceIndex === -1 ? frames.length : sourceIndex + 1
  const nextFrames = [...frames]
  nextFrames.splice(insertIndex, 0, nextFrame)

  return {
    frames: nextFrames,
    activeFrameId: nextFrameId,
    selectedLayerIds: [nextFrame.activeLayerId],
    selectionAnchorLayerId: nextFrame.activeLayerId,
    nextFrameNumber: nextFrameNumber + 1
  }
}

export function duplicateFrameInState(options: {
  frames: AnimationFrame[]
  frameId: string
  nextFrameNumber: number
}) {
  const { frames, frameId, nextFrameNumber } = options
  const sourceFrame = frames.find((frame) => frame.id === frameId)
  if (!sourceFrame) return null

  const nextFrameId = `frame-${nextFrameNumber}`
  const nextFrame: AnimationFrame = {
    id: nextFrameId,
    name: `${sourceFrame.name} copy`,
    layers: cloneLayers(sourceFrame.layers),
    activeLayerId: sourceFrame.activeLayerId,
    nextLayerNumber: sourceFrame.nextLayerNumber
  }

  const sourceIndex = frames.findIndex((frame) => frame.id === frameId)
  const nextFrames = [...frames]
  nextFrames.splice(sourceIndex + 1, 0, nextFrame)

  return {
    frames: nextFrames,
    activeFrameId: nextFrameId,
    selectedLayerIds: [nextFrame.activeLayerId],
    selectionAnchorLayerId: nextFrame.activeLayerId,
    nextFrameNumber: nextFrameNumber + 1
  }
}

export function removeFrameAndResolveSelection(options: {
  frames: AnimationFrame[]
  activeFrameId: string
  frameId: string
  selectedLayerIds: string[]
  selectionAnchorLayerId: string
}): CanvasFrameMutationResult | null {
  const nextState = removeFrameFromState({
    frames: options.frames,
    activeFrameId: options.activeFrameId,
    frameId: options.frameId
  })

  if (!nextState) return null

  if (options.activeFrameId === options.frameId && nextState.activeLayerId) {
    return {
      frames: nextState.frames,
      activeFrameId: nextState.activeFrameId,
      selectedLayerIds: [nextState.activeLayerId],
      selectionAnchorLayerId: nextState.activeLayerId,
      nextFrameNumber: 0
    }
  }

  return {
    frames: nextState.frames,
    activeFrameId: nextState.activeFrameId,
    selectedLayerIds: [...options.selectedLayerIds],
    selectionAnchorLayerId: options.selectionAnchorLayerId,
    nextFrameNumber: 0
  }
}

export function addLayerToFrame(options: {
  frame: AnimationFrame
  getDefaultLayerName: (number: number) => string
}) {
  const { frame, getDefaultLayerName } = options
  const nextLayerNumber = frame.nextLayerNumber
  const nextId = `layer-${nextLayerNumber}`

  return {
    frame: {
      ...frame,
      layers: [
        createLayer(nextId, getDefaultLayerName(nextLayerNumber)),
        ...frame.layers
      ],
      activeLayerId: nextId,
      nextLayerNumber: nextLayerNumber + 1
    },
    selectedLayerIds: [nextId],
    selectionAnchorLayerId: nextId
  }
}

export function addLayerWithPixelsToFrame(options: {
  frame: AnimationFrame
  pixelsMap: Map<string, string>
  name?: string
  getDefaultLayerName: (number: number) => string
}) {
  const { frame, pixelsMap, name, getDefaultLayerName } = options
  const nextLayerNumber = frame.nextLayerNumber
  const nextId = `layer-${nextLayerNumber}`
  const trimmedName = name?.trim()

  return {
    frame: {
      ...frame,
      layers: [
        {
          ...createLayer(nextId, trimmedName || getDefaultLayerName(nextLayerNumber)),
          pixels: new Map(pixelsMap)
        },
        ...frame.layers
      ],
      activeLayerId: nextId,
      nextLayerNumber: nextLayerNumber + 1
    },
    selectedLayerIds: [nextId],
    selectionAnchorLayerId: nextId
  }
}

export function removeLayerAndResolveSelection(options: {
  frame: AnimationFrame
  layerId: string
  selectedLayerIds: string[]
  selectionAnchorLayerId: string
}) {
  return removeLayerFromFrameState(options)
}

export function renameLayerInFrame(frame: AnimationFrame, layerId: string, name: string) {
  const trimmedName = name.trim()
  if (!trimmedName) return frame

  return {
    ...frame,
    layers: frame.layers.map((layer) =>
      layer.id === layerId
        ? { ...layer, name: trimmedName }
        : layer
    )
  }
}

export function getActiveFrameSelectionState(frames: AnimationFrame[], frameId: string) {
  const nextFrame = frames.find((frame) => frame.id === frameId)
  if (!nextFrame) return null

  return {
    activeFrameId: frameId,
    selectedLayerIds: [nextFrame.activeLayerId],
    selectionAnchorLayerId: nextFrame.activeLayerId
  }
}

export function getNextLayerSelectionState(options: {
  layers: Layer[]
  selectionAnchorLayerId: string
  currentSelectedLayerIds: string[]
  layerId: string
  toggle?: boolean
  range?: boolean
  activeLayerId: string
}) {
  const {
    layers,
    selectionAnchorLayerId,
    currentSelectedLayerIds,
    layerId,
    toggle,
    range,
    activeLayerId
  } = options
  if (!layers.some((layer) => layer.id === layerId)) return null

  if (range) {
    const anchorIndex = layers.findIndex((layer) => layer.id === selectionAnchorLayerId)
    const targetIndex = layers.findIndex((layer) => layer.id === layerId)

    if (anchorIndex !== -1 && targetIndex !== -1) {
      const [startIndex, endIndex] = anchorIndex < targetIndex
        ? [anchorIndex, targetIndex]
        : [targetIndex, anchorIndex]

      return {
        activeLayerId: layerId,
        selectedLayerIds: layers.slice(startIndex, endIndex + 1).map((layer) => layer.id),
        selectionAnchorLayerId
      }
    }
  }

  if (toggle) {
    if (currentSelectedLayerIds.includes(layerId)) {
      if (currentSelectedLayerIds.length === 1) {
        return {
          activeLayerId: layerId,
          selectedLayerIds: currentSelectedLayerIds,
          selectionAnchorLayerId: layerId
        }
      }

      const nextSelectedLayerIds = currentSelectedLayerIds.filter((id) => id !== layerId)
      return {
        activeLayerId: activeLayerId === layerId ? nextSelectedLayerIds[0] : activeLayerId,
        selectedLayerIds: nextSelectedLayerIds,
        selectionAnchorLayerId: layerId
      }
    }

    return {
      activeLayerId: layerId,
      selectedLayerIds: [...currentSelectedLayerIds, layerId],
      selectionAnchorLayerId: layerId
    }
  }

  return {
    activeLayerId: layerId,
    selectedLayerIds: [layerId],
    selectionAnchorLayerId: layerId
  }
}
