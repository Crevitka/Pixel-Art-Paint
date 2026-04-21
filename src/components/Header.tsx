import { motion } from 'framer-motion'
import { Palette, Download, Trash2 } from 'lucide-react'
import { cn } from '../lib/utils'

const Header = () => {
  const handleClear = () => {
    // TODO: Implement clear functionality
    console.log('Clear canvas')
  }

  const handleSave = () => {
    // TODO: Implement save functionality
    console.log('Save canvas')
  }

  return (
    <motion.header 
      className="glass-effect rounded-2xl p-5 mb-5 flex justify-between items-center"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.h1 
        className="text-3xl font-bold bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent flex items-center gap-3"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <Palette className="w-8 h-8" />
        Pixel Art Paint
      </motion.h1>
      <div className="flex gap-3">
        <motion.button 
          onClick={handleClear}
          className="btn-secondary flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Trash2 className="w-4 h-4" />
          Очистить
        </motion.button>
        <motion.button 
          onClick={handleSave}
          className="btn-primary flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Download className="w-4 h-4" />
          Сохранить
        </motion.button>
      </div>
    </motion.header>
  )
}

export default Header 