import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Canvas from './pages/Canvas.tsx'

createRoot(document.getElementById('root')!).render(
  // removed strict mode for testing
    <App />
)
