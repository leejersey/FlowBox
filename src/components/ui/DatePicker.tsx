import React, { useState, useEffect, useRef } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value: string // 'YYYY-MM-DD'
  onChange: (val: string) => void
  className?: string
  placeholder?: string
}

const MONTHS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月'
]

const DAYS_OF_WEEK = ['日', '一', '二', '三', '四', '五', '六']

export function DatePicker({ value, onChange, className, placeholder = '选择日期' }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Initialize view date to either the selected date, or today
  const initialDate = value ? new Date(value) : new Date()
  const [viewYear, setViewYear] = useState(initialDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth())

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Calendar logic
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay()

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)

  // Previous month logic for trailing days
  const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1)
  
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const handleSelectDate = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    onChange(`${viewYear}-${mm}-${dd}`)
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  const displayDate = value ? new Date(value) : null
  const isSelected = (day: number) => displayDate && displayDate.getFullYear() === viewYear && displayDate.getMonth() === viewMonth && displayDate.getDate() === day
  
  const today = new Date()
  const isToday = (day: number) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day

  return (
    <div className="relative" ref={containerRef}>
      {/* Input Trigger */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between bg-surface-container rounded-xl px-3 py-1.5 cursor-pointer hover:bg-surface-container-high transition-colors text-sm font-medium border border-transparent",
          isOpen && "border-primary/30 ring-1 ring-primary/20",
          className
        )}
      >
        <span className={cn("truncate", !value && "text-on-surface-variant/50")}>
          {value ? value : placeholder}
        </span>
        {value ? (
          <button 
            type="button" 
            onClick={handleClear} 
            className="p-1 rounded-full hover:bg-surface hover:text-red-400 transition-colors text-on-surface-variant z-10"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <CalendarIcon className="w-4 h-4 text-on-surface-variant/70" />
        )}
      </div>

      {/* Popover */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 z-50 w-64 bg-surface-container-low border border-white/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.3)] overflow-hidden animate-fade-in origin-top">
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-container/50">
            <button 
              type="button"
              onClick={handlePrevMonth} 
              className="p-1.5 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="font-bold text-sm text-on-surface">
              {viewYear}年 {MONTHS[viewMonth]}
            </div>
            <button 
              type="button"
              onClick={handleNextMonth} 
              className="p-1.5 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Grid */}
          <div className="p-3">
            <div className="grid grid-cols-7 mb-2">
              {DAYS_OF_WEEK.map(day => (
                <div key={day} className="text-center text-[10px] font-bold text-on-surface-variant/60 py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {/* Empty / Previous month trail */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-8 flex items-center justify-center text-xs text-on-surface-variant/20 font-medium">
                  {prevMonthDays - firstDay + i + 1}
                </div>
              ))}

              {/* Current Month Days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const selected = isSelected(day)
                const current = isToday(day)

                return (
                  <button
                    key={`day-${day}`}
                    type="button"
                    onClick={() => handleSelectDate(day)}
                    className={cn(
                      "h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                      selected 
                        ? "bg-primary text-white font-bold shadow-md shadow-primary/20 scale-105" 
                        : current
                          ? "text-primary border border-primary/30 font-bold hover:bg-primary/10"
                          : "text-on-surface hover:bg-surface-container active:scale-95"
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>
          
          {/* Footer Shortcuts */}
          <div className="px-3 py-2 border-t border-surface-container/30 bg-surface-container/20 flex gap-2">
            <button 
              type="button"
              onClick={() => {
                const d = new Date()
                onChange(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
                setIsOpen(false)
              }}
              className="flex-1 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded overflow-hidden transition-colors"
            >
              今天
            </button>
            <button 
              type="button"
              onClick={() => {
                const d = new Date()
                d.setDate(d.getDate() + 1)
                onChange(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
                setIsOpen(false)
              }}
              className="flex-1 py-1.5 text-xs font-medium text-on-surface-variant hover:bg-surface-container rounded overflow-hidden transition-colors"
            >
              明天
            </button>
          </div>
          
        </div>
      )}
    </div>
  )
}
