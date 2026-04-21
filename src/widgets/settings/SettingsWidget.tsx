import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Keyboard, Settings, X } from 'lucide-react'
import { useCanvasContext } from '@/features/canvas'

type SettingsWidgetProps = {
  onClose: () => void
}

type SettingsTab = 'reference' | 'shortcuts'

const HOTKEYS = [
  { keys: 'Ctrl + Z', description: 'Отменить действие' },
  { keys: 'Ctrl + C', description: 'Копировать выделение' },
  { keys: 'Ctrl + X', description: 'Вырезать выделение' },
  { keys: 'Ctrl + V', description: 'Вставить выделение' },
  { keys: 'Shift', description: 'Рисовать прямую линию' },
  { keys: 'Ctrl', description: 'Перемещение и трансформация слоя' },
  { keys: 'Ctrl + Shift', description: 'Сохранять пропорции при трансформации' },
  { keys: 'Space + drag', description: 'Перемещение вида мышью' },
  { keys: 'F2', description: 'Переименовать активный слой' },
  { keys: 'Esc', description: 'Закрыть окно или снять выделение' }
]

const TAB_BUTTON_CLASSES =
  'rounded-xl border-2 px-3 py-2 text-sm font-medium transition-colors'

export function SettingsWidget({ onClose }: SettingsWidgetProps) {
  const {
    referenceImageUrl,
    setReferenceImageUrl,
    referenceOpacity,
    setReferenceOpacity,
    isReferenceVisible,
    setIsReferenceVisible
  } = useCanvasContext()

  const [activeTab, setActiveTab] = useState<SettingsTab>('reference')
  const referenceInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

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

  const renderReferenceTab = () => (
    <section className="rounded-2xl border-2 border-gray-200 bg-white p-4 space-y-4">
      <h3 className="text-base font-semibold text-gray-800">Референс</h3>
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
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>
    </section>
  )

  const renderShortcutsTab = () => (
    <section className="rounded-2xl border-2 border-gray-200 bg-white p-4 space-y-3">
      <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
        <Keyboard className="h-4 w-4" />
        Хоткеи
      </h3>
      <div className="space-y-2">
        {HOTKEYS.map((hotkey) => (
          <div
            key={hotkey.keys}
            className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
          >
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-700 shadow-sm">
              {hotkey.keys}
            </span>
            <span className="text-right text-sm text-gray-600">
              {hotkey.description}
            </span>
          </div>
        ))}
      </div>
    </section>
  )

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
    >
      <motion.div
        className="glass-effect flex w-full max-w-4xl max-h-[calc(100vh-32px)] flex-col rounded-3xl shadow-2xl"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-gray-200/70 px-6 py-5 md:px-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Settings className="h-6 w-6" />
                Настройки
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Параметры холста, референса и быстрые клавиши редактора.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-2 border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800"
              aria-label="Закрыть настройки"
              title="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('reference')}
              className={`${TAB_BUTTON_CLASSES} ${
                activeTab === 'reference'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              Референс
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('shortcuts')}
              className={`${TAB_BUTTON_CLASSES} ${
                activeTab === 'shortcuts'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              Хоткеи
            </button>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto px-6 py-5 md:px-7">
          {activeTab === 'reference' ? renderReferenceTab() : null}
          {activeTab === 'shortcuts' ? renderShortcutsTab() : null}
        </div>
      </motion.div>
    </motion.div>
  )
}
