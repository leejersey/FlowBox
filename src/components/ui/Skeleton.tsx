import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-surface-container-highest/60', className)}
      {...props}
    />
  )
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4 rounded-md',
            i === lines - 1 ? 'w-3/5' : i === 0 ? 'w-4/5' : 'w-full'
          )}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'p-5 rounded-2xl bg-surface-container border border-outline-variant/30 flex flex-col gap-3',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-1/3 rounded-lg" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <SkeletonText lines={2} />
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-outline-variant/20">
        <Skeleton className="h-4 w-12 rounded-md" />
        <Skeleton className="h-4 w-16 rounded-md" />
      </div>
    </div>
  )
}

export function SkeletonList({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3.5', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
