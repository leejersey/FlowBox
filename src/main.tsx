import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeSettingsNavigation } from './services/settingsNavigationService'

void initializeSettingsNavigation().catch(error => {
  console.error('Settings menu initialization failed', error)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
