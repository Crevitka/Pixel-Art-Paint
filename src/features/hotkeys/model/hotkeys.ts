export type HotkeyId =
  | 'saveProject'
  | 'undo'
  | 'copySelection'
  | 'cutSelection'
  | 'renameLayer'
  | 'cancel'
  | 'flipLayerHorizontal'
  | 'flipLayerVertical'
  | 'selectPencil'
  | 'selectEraser'
  | 'selectFill'
  | 'selectSelection'
  | 'selectSmartSelection'
  | 'selectRectangle'
  | 'selectEllipse'
  | 'selectEyedropper'

export type HotkeyBinding = {
  code: string
  key: string
  ctrlOrMeta?: boolean
  shift?: boolean
  alt?: boolean
}

export type HotkeyDefinition = {
  id: HotkeyId
  description: string
  binding: HotkeyBinding
}

const STORAGE_KEY = 'pixel-art-paint.hotkeys'

export const DEFAULT_HOTKEYS: Record<HotkeyId, HotkeyBinding> = {
  saveProject: { code: 'KeyS', key: 's', ctrlOrMeta: true },
  undo: { code: 'KeyZ', key: 'z', ctrlOrMeta: true },
  copySelection: { code: 'KeyC', key: 'c', ctrlOrMeta: true },
  cutSelection: { code: 'KeyX', key: 'x', ctrlOrMeta: true },
  renameLayer: { code: 'F2', key: 'F2' },
  cancel: { code: 'Escape', key: 'Escape' },
  flipLayerHorizontal: { code: 'KeyH', key: 'h', shift: true },
  flipLayerVertical: { code: 'KeyV', key: 'v', shift: true },
  selectPencil: { code: 'KeyB', key: 'b' },
  selectEraser: { code: 'KeyE', key: 'e' },
  selectFill: { code: 'KeyG', key: 'g' },
  selectSelection: { code: 'KeyM', key: 'm' },
  selectSmartSelection: { code: 'KeyW', key: 'w' },
  selectRectangle: { code: 'KeyR', key: 'r' },
  selectEllipse: { code: 'KeyO', key: 'o' },
  selectEyedropper: { code: 'KeyI', key: 'i' }
}

export const HOTKEY_DEFINITIONS: HotkeyDefinition[] = [
  { id: 'saveProject', description: 'Сохранить проект', binding: DEFAULT_HOTKEYS.saveProject },
  { id: 'undo', description: 'Отменить действие', binding: DEFAULT_HOTKEYS.undo },
  { id: 'copySelection', description: 'Копировать выделение', binding: DEFAULT_HOTKEYS.copySelection },
  { id: 'cutSelection', description: 'Вырезать выделение', binding: DEFAULT_HOTKEYS.cutSelection },
  { id: 'renameLayer', description: 'Переименовать активный слой', binding: DEFAULT_HOTKEYS.renameLayer },
  { id: 'cancel', description: 'Закрыть окно или снять выделение', binding: DEFAULT_HOTKEYS.cancel },
  { id: 'flipLayerHorizontal', description: 'Отзеркалить слой по горизонтали', binding: DEFAULT_HOTKEYS.flipLayerHorizontal },
  { id: 'flipLayerVertical', description: 'Отзеркалить слой по вертикали', binding: DEFAULT_HOTKEYS.flipLayerVertical },
  { id: 'selectPencil', description: 'Выбрать карандаш', binding: DEFAULT_HOTKEYS.selectPencil },
  { id: 'selectEraser', description: 'Выбрать ластик', binding: DEFAULT_HOTKEYS.selectEraser },
  { id: 'selectFill', description: 'Выбрать заливку', binding: DEFAULT_HOTKEYS.selectFill },
  { id: 'selectSelection', description: 'Выбрать выделение', binding: DEFAULT_HOTKEYS.selectSelection },
  { id: 'selectSmartSelection', description: 'Выбрать умное выделение', binding: DEFAULT_HOTKEYS.selectSmartSelection },
  { id: 'selectRectangle', description: 'Выбрать квадрат', binding: DEFAULT_HOTKEYS.selectRectangle },
  { id: 'selectEllipse', description: 'Выбрать круг', binding: DEFAULT_HOTKEYS.selectEllipse },
  { id: 'selectEyedropper', description: 'Выбрать пипетку', binding: DEFAULT_HOTKEYS.selectEyedropper }
]

export const HOTKEY_GESTURES = [
  { keys: 'Ctrl + V', description: 'Вставить выделение или изображение' },
  { keys: 'Shift', description: 'Линия, квадрат и шаговый поворот' },
  { keys: 'Ctrl', description: 'Перемещение и трансформация слоя' },
  { keys: 'Ctrl + Shift', description: 'Сохранять пропорции при трансформации' },
  { keys: 'Space + drag', description: 'Перемещение вида мышью' },
  { keys: 'Alt', description: 'Временная пипетка' }
]

function normalizeBinding(binding: HotkeyBinding): HotkeyBinding {
  return {
    code: binding.code,
    key: binding.key,
    ctrlOrMeta: Boolean(binding.ctrlOrMeta),
    shift: Boolean(binding.shift),
    alt: Boolean(binding.alt)
  }
}

export function loadHotkeys(): Record<HotkeyId, HotkeyBinding> {
  if (typeof window === 'undefined') {
    return DEFAULT_HOTKEYS
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_HOTKEYS

    const parsed = JSON.parse(raw) as Partial<Record<HotkeyId, HotkeyBinding>>
    return {
      saveProject: normalizeBinding(parsed.saveProject ?? DEFAULT_HOTKEYS.saveProject),
      undo: normalizeBinding(parsed.undo ?? DEFAULT_HOTKEYS.undo),
      copySelection: normalizeBinding(parsed.copySelection ?? DEFAULT_HOTKEYS.copySelection),
      cutSelection: normalizeBinding(parsed.cutSelection ?? DEFAULT_HOTKEYS.cutSelection),
      renameLayer: normalizeBinding(parsed.renameLayer ?? DEFAULT_HOTKEYS.renameLayer),
      cancel: normalizeBinding(parsed.cancel ?? DEFAULT_HOTKEYS.cancel),
      flipLayerHorizontal: normalizeBinding(parsed.flipLayerHorizontal ?? DEFAULT_HOTKEYS.flipLayerHorizontal),
      flipLayerVertical: normalizeBinding(parsed.flipLayerVertical ?? DEFAULT_HOTKEYS.flipLayerVertical),
      selectPencil: normalizeBinding(parsed.selectPencil ?? DEFAULT_HOTKEYS.selectPencil),
      selectEraser: normalizeBinding(parsed.selectEraser ?? DEFAULT_HOTKEYS.selectEraser),
      selectFill: normalizeBinding(parsed.selectFill ?? DEFAULT_HOTKEYS.selectFill),
      selectSelection: normalizeBinding(parsed.selectSelection ?? DEFAULT_HOTKEYS.selectSelection),
      selectSmartSelection: normalizeBinding(parsed.selectSmartSelection ?? DEFAULT_HOTKEYS.selectSmartSelection),
      selectRectangle: normalizeBinding(parsed.selectRectangle ?? DEFAULT_HOTKEYS.selectRectangle),
      selectEllipse: normalizeBinding(parsed.selectEllipse ?? DEFAULT_HOTKEYS.selectEllipse),
      selectEyedropper: normalizeBinding(parsed.selectEyedropper ?? DEFAULT_HOTKEYS.selectEyedropper)
    }
  } catch {
    return DEFAULT_HOTKEYS
  }
}

export function saveHotkeys(hotkeys: Record<HotkeyId, HotkeyBinding>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hotkeys))
}

export function eventMatchesHotkey(event: KeyboardEvent, binding: HotkeyBinding) {
  if (binding.ctrlOrMeta && !(event.ctrlKey || event.metaKey)) return false
  if (!binding.ctrlOrMeta && (event.ctrlKey || event.metaKey)) return false
  if (Boolean(binding.shift) !== event.shiftKey) return false
  if (Boolean(binding.alt) !== event.altKey) return false

  return event.code === binding.code
}

function formatKeyPart(binding: HotkeyBinding) {
  switch (binding.code) {
    case 'Escape':
      return 'Esc'
    case 'Space':
      return 'Space'
    default:
      if (binding.code.startsWith('Key')) {
        return binding.code.slice(3).toUpperCase()
      }
      if (binding.code.startsWith('Digit')) {
        return binding.code.slice(5)
      }
      return binding.key.length === 1 ? binding.key.toUpperCase() : binding.key
  }
}

export function formatHotkey(binding: HotkeyBinding) {
  const parts: string[] = []

  if (binding.ctrlOrMeta) parts.push('Ctrl/Cmd')
  if (binding.shift) parts.push('Shift')
  if (binding.alt) parts.push('Alt')

  parts.push(formatKeyPart(binding))
  return parts.join(' + ')
}

export function bindingsEqual(a: HotkeyBinding, b: HotkeyBinding) {
  return (
    a.code === b.code &&
    a.key === b.key &&
    Boolean(a.ctrlOrMeta) === Boolean(b.ctrlOrMeta) &&
    Boolean(a.shift) === Boolean(b.shift) &&
    Boolean(a.alt) === Boolean(b.alt)
  )
}

export function buildBindingFromKeyboardEvent(event: KeyboardEvent): HotkeyBinding | null {
  const ignoredKeys = new Set(['Meta'])
  if (ignoredKeys.has(event.key)) return null

  return {
    code: event.code,
    key: event.key,
    ctrlOrMeta: (event.ctrlKey || event.metaKey) && event.key !== 'Control',
    shift: event.shiftKey && event.key !== 'Shift',
    alt: event.altKey && event.key !== 'Alt'
  }
}

export function findConflictingHotkeyId(
  hotkeys: Record<HotkeyId, HotkeyBinding>,
  candidate: HotkeyBinding,
  currentId: HotkeyId
) {
  return (Object.keys(hotkeys) as HotkeyId[]).find((id) => id !== currentId && bindingsEqual(hotkeys[id], candidate)) ?? null
}
