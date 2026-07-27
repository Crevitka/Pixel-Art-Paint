export type Tool =
  | 'pencil'
  | 'eraser'
  | 'fill'
  | 'selection'
  | 'smartSelection'
  | 'rectangle'
  | 'ellipse'
  | 'eyedropper'

export interface CanvasSize {
  width: number
  height: number
}

export interface Pixel {
  x: number
  y: number
  color: string
}

export interface MousePosition {
  x: number
  y: number
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  pixels: Map<string, string>
}

export interface AnimationFrame {
  id: string
  name: string
  layers: Layer[]
  activeLayerId: string
  nextLayerNumber: number
}
