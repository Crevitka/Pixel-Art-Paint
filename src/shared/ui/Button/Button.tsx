import { motion } from 'framer-motion'
import { cn } from '@/shared/lib/utils'
import { ButtonProps } from './Button.types'

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className,
  ...props 
}: ButtonProps) {
  const baseClasses = "font-semibold rounded-lg transition-all duration-200 flex items-center gap-2"
  
  const variants = {
    primary: "bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:shadow-lg hover:-translate-y-0.5 active:scale-95",
    secondary: "bg-gray-50 text-gray-700 border-2 border-gray-200 hover:bg-gray-100 hover:border-gray-300 active:scale-95"
  }
  
  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg"
  }

  return (
    <motion.button
      className={cn(baseClasses, variants[variant], sizes[size], className)}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      {...props}
    >
      {children}
    </motion.button>
  )
} 