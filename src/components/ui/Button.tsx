import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  isLoading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, disabled, children, ...props }, ref) => {
    const variantStyles = {
      primary: 'primary-gradient-button font-medium text-white',
      secondary: 'bg-surface-container text-on-surface hover:bg-surface-container-highest border border-outline-variant font-medium',
      ghost: 'bg-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest font-medium',
      danger: 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 font-medium',
      outline: 'bg-transparent border border-outline-variant text-on-surface hover:bg-surface-container-low font-medium',
    }

    const sizeStyles = {
      sm: 'h-8 px-3 text-xs rounded-xl gap-1.5',
      md: 'h-10 px-4 text-sm rounded-2xl gap-2',
      lg: 'h-12 px-6 text-base rounded-2xl gap-2.5',
      icon: 'h-9 w-9 p-0 rounded-xl flex items-center justify-center',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center transition-all duration-200 outline-none select-none cursor-pointer',
          'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
