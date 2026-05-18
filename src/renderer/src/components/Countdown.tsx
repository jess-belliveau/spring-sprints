import { AnimatePresence, motion } from 'framer-motion'

interface Props {
  value: number | null
}

export function Countdown({ value }: Props) {
  const label = value === null ? null : value === 0 ? 'GO!' : String(value)

  return (
    <AnimatePresence>
      {label !== null && (
        <motion.div
          key={label}
          className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
          initial={{ opacity: 0, scale: 1.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.25 }}
        >
          <div
            className={
              label === 'GO!'
                ? 'text-[var(--accent)] text-[16rem] font-black'
                : 'text-white text-[20rem] font-black drop-shadow-2xl'
            }
            style={{ textShadow: '0 0 80px rgba(255,255,255,0.3)' }}
          >
            {label}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
