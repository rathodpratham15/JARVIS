import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setupNativeApi } from './lib/setupNativeApi'

// Point native APK calls at the Mac backend (same WiFi required)
setupNativeApi('http://10.110.100.3:5050')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
