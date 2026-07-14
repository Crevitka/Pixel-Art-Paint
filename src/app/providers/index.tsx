import { ReactNode } from 'react'
import { CanvasProvider } from '@/features/canvas'
import { ToolProvider } from '@/features/tools'
import { ColorProvider } from '@/features/colors'
import { HotkeyProvider } from '@/features/hotkeys'

interface AppProvidersProps {
  children: ReactNode
}

export function withProviders(Component: React.ComponentType) {
  return function AppProviders() {
    return (
      <HotkeyProvider>
        <ToolProvider>
          <ColorProvider>
            <CanvasProvider>
              <Component />
            </CanvasProvider>
          </ColorProvider>
        </ToolProvider>
      </HotkeyProvider>
    )
  }
} 
