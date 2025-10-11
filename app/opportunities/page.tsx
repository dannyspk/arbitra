'use client'

import React from 'react'
import HotCoinsPanel from '../../components/HotCoinsPanel'

export default function Page() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
            Market Signals
          </h1>
          <p className="text-sm md:text-base text-slate-400">Discover trending pairs and hot market movers</p>
        </header>
        
        <HotCoinsPanel />
      </div>
    </div>
  )
}
