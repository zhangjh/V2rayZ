import { useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { useAppStore } from '@/store/app-store'
import { useNativeEventListeners } from '@/hooks/use-native-events'
import { HomePage } from '@/pages/home-page'
import { ServerPage } from '@/pages/server-page'
import { RulesPage } from '@/pages/rules-page'
import { SettingsPage } from '@/pages/settings-page'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/components/error-boundary'

function App() {
  const currentView = useAppStore((state) => state.currentView)
  const setCurrentView = useAppStore((state) => state.setCurrentView)
  const loadConfig = useAppStore((state) => state.loadConfig)
  const refreshConnectionStatus = useAppStore((state) => state.refreshConnectionStatus)

  // Listen to native events
  useNativeEventListeners()

  // Load initial data
  useEffect(() => {
    loadConfig()
    refreshConnectionStatus()
    
    // Poll connection status every 2 seconds
    const statusInterval = setInterval(() => {
      refreshConnectionStatus()
    }, 2000)
    
    return () => clearInterval(statusInterval)
  }, [loadConfig, refreshConnectionStatus])

  return (
    <ErrorBoundary>
      <MainLayout currentView={currentView} onViewChange={setCurrentView}>
        {currentView === 'home' && <HomePage />}
        
        {currentView === 'server' && <ServerPage />}
        
        {currentView === 'rules' && <RulesPage />}
        
        {currentView === 'settings' && <SettingsPage />}
      </MainLayout>
      <Toaster position="top-right" richColors closeButton />
    </ErrorBoundary>
  )
}

export default App
