import React from 'react'

export function TitleBar() {
  return (
    <div 
      className="h-10 w-full flex items-center px-4 shrink-0 select-none z-50 fixed top-0 left-0 right-0 bg-transparent"
      // data-tauri-drag-region is for Tauri 2.0 window dragging
      // @ts-ignore
      data-tauri-drag-region
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* macOS Traffic Lights Placeholder (space for the actual native buttons) */}
      <div className="flex gap-2 w-16 invisible" />
      
      {/* App Title */}
      <div className="flex-1 flex justify-center items-center h-full pointer-events-none">
        {/* Title removed per user request */}
      </div>
    </div>
  )
}
