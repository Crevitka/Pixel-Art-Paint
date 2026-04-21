import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface ToolButtonProps {
  tool: string
  icon: LucideIcon
  label: string
  isActive: boolean
  onClick: () => void
  iconOnly?: boolean
}

export function ToolButton({ tool: _tool, icon: Icon, label, isActive, onClick, iconOnly = false }: ToolButtonProps) {
  return (
    <motion.button
      className={cn(
        iconOnly
          ? "tool-btn flex h-12 w-12 items-center justify-center p-0"
          : "tool-btn flex items-center gap-3",
        isActive && "active"
      )}
      onClick={onClick}
      title={label}
      aria-label={label}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Icon className="w-5 h-5" />
      {iconOnly ? null : label}
    </motion.button>
  )
} 
