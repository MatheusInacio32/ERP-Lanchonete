import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { aplicarTema, getTema } from './services/theme'

// Aplica a cor principal salva antes do render (evita "flash" de cor)
aplicarTema(getTema())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
