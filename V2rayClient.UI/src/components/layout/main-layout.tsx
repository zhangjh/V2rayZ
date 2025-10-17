import { ReactNode } from 'react'
import { Sidebar } from './sidebar'

interface MainLayoutProps {
  currentView: string
  onViewChange: (view: string) => void
  children: ReactNode
}

export function MainLayout({ currentView, onViewChange, children }: MainLayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar currentView={currentView} onViewChange={onViewChange} />
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
