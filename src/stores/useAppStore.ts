import { create } from 'zustand'

interface AppState {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  isSidebarOpen: boolean
  toggleSidebar: () => void
  isButlerActive: boolean
  toggleButler: () => void
}

export const useAppStore = create<AppState>()((set) => ({
  theme: 'light',
  setTheme: (theme) => set({ theme }),
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  isButlerActive: false,
  toggleButler: () => set((state) => ({ isButlerActive: !state.isButlerActive })),
}))
