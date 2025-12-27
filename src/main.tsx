import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles.css'
import './styles/malocraft.css'
import { AuthProvider } from './state/useAuth'
import { registerSW } from './registerSW'

document.body.classList.add('malocraft')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)

registerSW()
