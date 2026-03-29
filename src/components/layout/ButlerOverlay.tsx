import { useEffect } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { ButlerWorkbench } from '../butler/ButlerWorkbench'

export function ButlerOverlay() {
  const { isButlerActive, toggleButler } = useAppStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isButlerActive) {
        toggleButler()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggleButler()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isButlerActive, toggleButler])

  if (!isButlerActive) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-12 lg:p-[10vh]">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-md animate-fade-in"
        onClick={toggleButler}
      />
      <ButlerWorkbench className="relative z-10 animate-slide-up" />
    </div>
  )
}
