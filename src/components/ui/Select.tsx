import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  label: string
  value: string | number
}

interface SelectProps {
  options: SelectOption[]
  value: string | number | null
  onChange: (value: string | number | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  icon?: React.ReactNode
}

export function Select({ options, value, onChange, placeholder = '请选择', disabled, className, icon }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const selectedOption = options.find(o => o.value === value)

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full h-full bg-surface-container-low px-4 py-2.5 rounded-full border shadow-sm transition-all focus:outline-none cursor-pointer",
          isOpen ? "border-primary/30 ring-1 ring-primary/20" : "border-white/5 hover:border-white/10",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="text-primary shrink-0">{icon}</span>}
          <span className={cn("text-sm font-medium truncate", !selectedOption && "text-on-surface-variant/70")}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown className={cn("w-4 h-4 ml-4 text-on-surface-variant transition-transform duration-200 shrink-0", isOpen && "rotate-180")} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 min-w-[220px] max-w-[320px] max-h-60 overflow-y-auto bg-surface-container-low border border-white/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.3)] animate-fade-in py-1 custom-scrollbar">
          {options.map((option, index) => {
            const isSelected = option.value === value
            return (
              <button
                key={`${option.value}-${index}`}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={cn(
                  "flex items-center justify-between w-full px-4 py-2.5 text-sm transition-colors text-left",
                  isSelected ? "bg-primary/10 text-primary font-bold" : "text-on-surface hover:bg-surface-container-high active:bg-surface-container-highest"
                )}
              >
                <span className="truncate pr-4">{option.label}</span>
                {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
