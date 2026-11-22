import { create } from 'zustand'

interface AppState {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  isSidebarOpen: boolean
  toggleSidebar: () => void
  isButlerActive: boolean
  toggleButler: () => void
  setButlerActive: (active: boolean) => void
  isSearchOpen: boolean
  setSearchOpen: (open: boolean) => void
  toggleSearch: () => void
}

export const useAppStore = create<AppState>()((set) => ({
  theme: 'light',
  setTheme: (theme) => set({ theme }),
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  isButlerActive: false,
  toggleButler: () => set((state) => ({
    isButlerActive: !state.isButlerActive,
    isSearchOpen: !state.isButlerActive ? false : state.isSearchOpen,
  })),
  setButlerActive: (active) => set((state) => ({
    isButlerActive: active,
    isSearchOpen: active ? false : state.isSearchOpen,
  })),
  isSearchOpen: false,
  setSearchOpen: (open) => set((state) => ({
    isSearchOpen: open,
    isButlerActive: open ? false : state.isButlerActive,
  })),
  toggleSearch: () => set((state) => ({
    isSearchOpen: !state.isSearchOpen,
    isButlerActive: !state.isSearchOpen ? false : state.isButlerActive,
  })),
}))
