import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setupNativeApi } from './lib/setupNativeApi'

// Native APK calls hit the deployed Render backend directly
setupNativeApi('https://jarvis-backend.onrender.com')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
