import { useToastStore } from '@/store/useToastStore'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const icons = {
  success: <CheckCircle2 className="w-5 h-5 text-green-500" />,
  error: <XCircle className="w-5 h-5 text-red-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      {toasts.map(toast => (
        <div 
          key={toast.id}
          className={cn(
            "pointer-events-auto flex items-start gap-3 px-4 py-3 min-w-[280px] max-w-md rounded-2xl shadow-xl animate-fade-in border",
            "bg-surface-container-highest/95 backdrop-blur-xl",
            toast.type === 'error' ? "border-red-500/30" :
            toast.type === 'success' ? "border-green-500/30" :
            "border-white/10"
          )}
        >
          <div className="mt-0.5 shrink-0">
            {icons[toast.type]}
          </div>
          <p className="text-sm font-medium text-on-surface flex-1 leading-relaxed break-words">{toast.message}</p>
          <button 
            onClick={() => removeToast(toast.id)}
            className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
