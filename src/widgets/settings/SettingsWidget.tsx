import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Grid3X3, Keyboard, Lock, RotateCcw, Settings, Unlock, X } from 'lucide-react'
import { useCanvasContext } from '@/features/canvas'
import { useI18nContext } from '@/features/i18n'
import {
  DEFAULT_HOTKEYS,
  HOTKEY_DEFINITIONS,
  HOTKEY_GESTURES,
  buildBindingFromKeyboardEvent,
  findConflictingHotkeyId,
  formatHotkey,
  useHotkeyContext,
  type HotkeyId
} from '@/features/hotkeys'

type SettingsWidgetProps = {
  onClose: () => void
}

type SettingsTab = 'canvas' | 'language' | 'shortcuts'

const TAB_BUTTON_CLASSES =
  'rounded-xl border-2 px-3 py-2 text-sm font-medium transition-colors'

export function SettingsWidget({ onClose }: SettingsWidgetProps) {
  const { canvasSize, setCanvasSize } = useCanvasContext()
  const { hotkeys, setHotkey, resetHotkeys } = useHotkeyContext()
  const { locale, setLocale, t } = useI18nContext()

  const [activeTab, setActiveTab] = useState<SettingsTab>('canvas')
  const [isAspectRatioLocked, setIsAspectRatioLocked] = useState(true)
  const [widthInput, setWidthInput] = useState(String(canvasSize.width))
  const [heightInput, setHeightInput] = useState(String(canvasSize.height))
  const [capturingHotkeyId, setCapturingHotkeyId] = useState<HotkeyId | null>(null)
  const [hotkeyError, setHotkeyError] = useState<string | null>(null)
  const aspectRatioRef = useRef(canvasSize.width / canvasSize.height)
  const maxCanvasSize = 512

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (capturingHotkeyId) return

      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [capturingHotkeyId, onClose])

  useEffect(() => {
    if (!capturingHotkeyId) return

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()

      const nextBinding = buildBindingFromKeyboardEvent(event)
      if (!nextBinding) return

      const conflictingHotkeyId = findConflictingHotkeyId(hotkeys, nextBinding, capturingHotkeyId)
      if (conflictingHotkeyId) {
        setHotkeyError(
          t('settings.shortcuts.conflict', {
            name: t(`hotkey.${conflictingHotkeyId}`)
          })
        )
        return
      }

      setHotkey(capturingHotkeyId, nextBinding)
      setCapturingHotkeyId(null)
      setHotkeyError(null)
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [capturingHotkeyId, hotkeys, setHotkey])

  useEffect(() => {
    setWidthInput(String(canvasSize.width))
    setHeightInput(String(canvasSize.height))
  }, [canvasSize.height, canvasSize.width])

  const clampCanvasSize = (value: number) => Math.min(maxCanvasSize, Math.max(8, value || 8))

  const toggleAspectRatioLock = () => {
    if (!isAspectRatioLocked) {
      aspectRatioRef.current = canvasSize.width / canvasSize.height
    }

    setIsAspectRatioLocked((current) => !current)
  }

  const handleWidthChange = (nextWidthValue: number) => {
    const nextWidth = clampCanvasSize(nextWidthValue)

    if (!isAspectRatioLocked) {
      setCanvasSize({
        ...canvasSize,
        width: nextWidth
      })
      return
    }

    setCanvasSize({
      width: nextWidth,
      height: clampCanvasSize(Math.round(nextWidth / aspectRatioRef.current))
    })
  }

  const handleHeightChange = (nextHeightValue: number) => {
    const nextHeight = clampCanvasSize(nextHeightValue)

    if (!isAspectRatioLocked) {
      setCanvasSize({
        ...canvasSize,
        height: nextHeight
      })
      return
    }

    setCanvasSize({
      width: clampCanvasSize(Math.round(nextHeight * aspectRatioRef.current)),
      height: nextHeight
    })
  }

  const renderCanvasTab = () => (
    <section className="space-y-4 rounded-2xl border-2 border-gray-200 bg-white p-4">
      <h3 className="flex items-center gap-2 text-base font-semibold text-gray-800">
        <Grid3X3 className="h-4 w-4" />
        {t('settings.canvas.title')}
      </h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-gray-700">{t('settings.canvas.size')}</span>
          <button
            type="button"
            onClick={toggleAspectRatioLock}
            className={`rounded-lg border-2 p-2 transition-colors ${
              isAspectRatioLocked
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:bg-gray-100'
            }`}
            aria-pressed={isAspectRatioLocked}
            title={isAspectRatioLocked ? t('settings.canvas.aspectOn') : t('settings.canvas.aspectOff')}
          >
            {isAspectRatioLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={widthInput}
            onChange={(event) => setWidthInput(event.target.value)}
            onBlur={() => handleWidthChange(Number(widthInput))}
            min="8"
            max={maxCanvasSize}
            className="w-24 rounded-lg border-2 border-gray-200 px-3 py-2 text-center text-sm focus:border-primary-500 focus:outline-none"
          />
          <span className="text-gray-500">×</span>
          <input
            type="number"
            value={heightInput}
            onChange={(event) => setHeightInput(event.target.value)}
            onBlur={() => handleHeightChange(Number(heightInput))}
            min="8"
            max={maxCanvasSize}
            className="w-24 rounded-lg border-2 border-gray-200 px-3 py-2 text-center text-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
        <p className="text-xs leading-5 text-gray-500">
          {t('settings.canvas.hint')}
        </p>
      </div>
    </section>
  )

  const renderLanguageTab = () => (
    <section className="space-y-4 rounded-2xl border-2 border-gray-200 bg-white p-4">
      <h3 className="flex items-center gap-2 text-base font-semibold text-gray-800">
        <Settings className="h-4 w-4" />
        {t('settings.language.title')}
      </h3>
      <p className="text-sm text-gray-500">
        {t('settings.language.hint')}
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setLocale('ru')}
          className={`rounded-xl border-2 px-4 py-3 text-sm font-medium transition ${
            locale === 'ru'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          {t('common.russian')}
        </button>
        <button
          type="button"
          onClick={() => setLocale('en')}
          className={`rounded-xl border-2 px-4 py-3 text-sm font-medium transition ${
            locale === 'en'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          {t('common.english')}
        </button>
      </div>
    </section>
  )

  const renderShortcutsTab = () => (
    <section className="space-y-4 rounded-2xl border-2 border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-800">
            <Keyboard className="h-4 w-4" />
            {t('settings.shortcuts.title')}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t('settings.shortcuts.hint')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetHotkeys()
            setCapturingHotkeyId(null)
            setHotkeyError(null)
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
        >
          <RotateCcw className="h-4 w-4" />
          {t('settings.shortcuts.resetAll')}
        </button>
      </div>

      {hotkeyError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {hotkeyError}
        </div>
      ) : null}

      <div className="space-y-2">
        {HOTKEY_DEFINITIONS.map((hotkey) => {
          const isCapturing = capturingHotkeyId === hotkey.id

          return (
            <div
              key={hotkey.id}
              className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800">{t(`hotkey.${hotkey.id}`)}</div>
                <div className="mt-1 text-xs text-gray-500">
                  {isCapturing ? t('settings.shortcuts.capturing') : formatHotkey(hotkeys[hotkey.id])}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-700 shadow-sm">
                  {formatHotkey(hotkeys[hotkey.id])}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCapturingHotkeyId(isCapturing ? null : hotkey.id)
                    setHotkeyError(null)
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isCapturing
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {isCapturing ? t('common.cancel') : t('settings.shortcuts.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHotkey(hotkey.id, DEFAULT_HOTKEYS[hotkey.id])
                    if (capturingHotkeyId === hotkey.id) {
                      setCapturingHotkeyId(null)
                    }
                    setHotkeyError(null)
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800"
                >
                  {t('common.default')}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
        <div className="text-sm font-semibold text-gray-800">{t('settings.shortcuts.gestures')}</div>
        <div className="mt-3 space-y-2">
          {HOTKEY_GESTURES.map((hotkey) => (
            <div
              key={hotkey.keys}
              className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 bg-white px-3 py-2"
            >
              <span className="rounded-md bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-700 shadow-sm">
                {hotkey.keys}
              </span>
              <span className="text-right text-sm text-gray-600">
                {t(
                  hotkey.keys === 'Ctrl + V'
                    ? 'gesture.paste'
                    : hotkey.keys === 'Shift'
                    ? 'gesture.shift'
                    : hotkey.keys === 'Ctrl'
                    ? 'gesture.ctrl'
                    : hotkey.keys === 'Ctrl + Shift'
                    ? 'gesture.ctrlShift'
                    : hotkey.keys === 'Space + drag'
                    ? 'gesture.spaceDrag'
                    : 'gesture.alt'
                )}
              </span>
            </div>
          ))}
        </div>
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
        className="glass-effect flex max-h-[calc(100vh-32px)] w-full max-w-4xl flex-col rounded-3xl shadow-2xl"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-gray-200/70 px-6 py-5 md:px-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
                <Settings className="h-6 w-6" />
                {t('settings.title')}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {t('settings.description')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-2 border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800"
              aria-label={t('settings.closeAria')}
              title={t('common.close')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('canvas')}
              className={`${TAB_BUTTON_CLASSES} ${
                activeTab === 'canvas'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {t('settings.tab.canvas')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('language')}
              className={`${TAB_BUTTON_CLASSES} ${
                activeTab === 'language'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {t('settings.tab.language')}
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
              {t('settings.tab.shortcuts')}
            </button>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto px-6 py-5 md:px-7">
          {activeTab === 'canvas' ? renderCanvasTab() : null}
          {activeTab === 'language' ? renderLanguageTab() : null}
          {activeTab === 'shortcuts' ? renderShortcutsTab() : null}
        </div>
      </motion.div>
    </motion.div>
  )
}
