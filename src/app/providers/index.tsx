import { CanvasProvider } from '@/features/canvas'
import { ToolProvider } from '@/features/tools'
import { ColorProvider } from '@/features/colors'
import { HotkeyProvider } from '@/features/hotkeys'
import { I18nProvider } from '@/features/i18n'

export function withProviders(Component: React.ComponentType) {
  return function AppProviders() {
    return (
      <I18nProvider>
        <HotkeyProvider>
          <ToolProvider>
            <ColorProvider>
              <CanvasProvider>
                <Component />
              </CanvasProvider>
            </ColorProvider>
          </ToolProvider>
        </HotkeyProvider>
      </I18nProvider>
    )
  }
} 
