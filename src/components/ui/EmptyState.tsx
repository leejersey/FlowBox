import React from 'react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-16 px-4 animate-fade-in',
        className
      )}
    >
      {icon && (
        <div className="w-16 h-16 rounded-3xl bg-surface-container-highest/50 flex items-center justify-center text-on-surface-variant/40 mb-4 ring-8 ring-surface-container-low/50">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-on-surface mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-on-surface-variant max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="flex items-center gap-3">{action}</div>}
    </div>
  )
}
