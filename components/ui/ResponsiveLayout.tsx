'use client'

import React, { useState, createContext, useContext } from 'react'
import Sidebar from './Sidebar'

// Create context for sidebar state
const SidebarContext = createContext<{
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
} | null>(null)

export const useSidebar = () => {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within ResponsiveLayout')
  }
  return context
}

export default function ResponsiveLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
      <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-60 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 
        border-r border-slate-800/50 shadow-2xl shadow-slate-950/50
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="px-4 py-3 md:py-4 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm min-h-[10px] md:min-h-[88px] flex items-center">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <img 
                src="/cryptoai.png" 
                alt="CryptoAIEdge" 
                className="h-14 w-auto min-w-[180px] object-contain"
                onError={(e) => {
                  // Fallback to text if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling;
                  if (fallback) (fallback as HTMLElement).style.display = 'block';
                }}
              />
              <span 
                className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]"
                style={{ display: 'none' }}
              >
                CryptoAIEdge
              </span>
            </div>
            {/* Close button for mobile */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white transition-colors p-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <Sidebar />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {children}
      </div>
    </div>
    </SidebarContext.Provider>
  )
}
