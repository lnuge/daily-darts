import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
// Self-hosted (no requests to Google Fonts): chalk lettering for headings and
// numbers, a chalk-marker hand for everything else. Latin only, to keep it small.
import '@fontsource/cabin-sketch/latin-700.css'
import '@fontsource/kalam/latin-400.css'
import '@fontsource/kalam/latin-700.css'
import './ui/styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
