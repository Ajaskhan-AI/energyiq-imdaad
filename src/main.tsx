import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { TooltipProvider } from './components/shadcn/tooltip.tsx'
import { ToastProvider } from './components/ui/ToastProvider.tsx'
import { SimulatorProvider } from './sim/SimulatorProvider.tsx'
import { AppProvider } from './store/AppProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <ToastProvider>
        <SimulatorProvider>
          {/* Needed once for every shadcn Tooltip in the app */}
          <TooltipProvider delayDuration={200}>
            <App />
          </TooltipProvider>
        </SimulatorProvider>
      </ToastProvider>
    </AppProvider>
  </StrictMode>,
)
