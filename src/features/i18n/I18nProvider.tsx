import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { translations, type AppLocale } from './model/translations'

type I18nContextValue = {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const STORAGE_KEY = 'pixel-art-paint.locale'

const I18nContext = createContext<I18nContextValue | null>(null)

function getInitialLocale(): AppLocale {
  if (typeof window === 'undefined') return 'en'

  const storedLocale = window.localStorage.getItem(STORAGE_KEY)
  if (storedLocale === 'ru' || storedLocale === 'en') {
    return storedLocale
  }

  return window.navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template

  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`))
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => getInitialLocale())

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale: (nextLocale) => {
      setLocaleState(nextLocale)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, nextLocale)
      }
    },
    t: (key, vars) => {
      const template = translations[locale][key] ?? translations.ru[key] ?? key
      return interpolate(template, vars)
    }
  }), [locale])

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18nContext() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18nContext must be used within I18nProvider')
  }

  return context
}
