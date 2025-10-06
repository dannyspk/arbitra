'use client'

import React from 'react'
import ExecutionConsole from '../../components/ExecutionConsole'

export default function Page() {
  const [listenerStatus, setListenerStatus] = React.useState<'stopped' | 'starting' | 'running'>('stopped')
  const [listenerError, setListenerError] = React.useState<string | null>(null)

  const startListener = async () => {
    setListenerStatus('starting')
    setListenerError(null)
    
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      const res = await fetch(`${API}/api/liquidations/start-listener`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      
      if (!res.ok) {
        const error = await res.text()
        throw new Error(error || 'Failed to start listener')
      }
      
      const data = await res.json()
      setListenerStatus('running')
      console.log('Listener started:', data)
    } catch (error) {
      console.error('Failed to start listener:', error)
      setListenerError(error instanceof Error ? error.message : 'Unknown error')
      setListenerStatus('stopped')
    }
  }

  const stopListener = async () => {
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      const res = await fetch(`${API}/api/liquidations/stop-listener`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      
      if (res.ok) {
        setListenerStatus('stopped')
      }
    } catch (error) {
      console.error('Failed to stop listener:', error)
    }
  }

  // Check listener status on mount
  React.useEffect(() => {
    const checkStatus = async () => {
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
        const res = await fetch(`${API}/api/liquidations/listener-status`)
        if (res.ok) {
          const data = await res.json()
          setListenerStatus(data.running ? 'running' : 'stopped')
        }
      } catch (error) {
        console.debug('Could not check listener status:', error)
      }
    }
    checkStatus()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
                Liquidation
              </h1>
              <p className="text-sm md:text-base text-slate-400">Monitor and manage liquidation events</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {listenerStatus === 'running' ? (
                <>
                  <div className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-400 text-sm font-medium">Listener Active</span>
                  </div>
                  <button
                    onClick={stopListener}
                    className="px-5 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-lg font-semibold shadow-lg shadow-red-500/30 transition-all duration-200"
                  >
                    Stop Listener
                  </button>
                </>
              ) : (
                <button
                  onClick={startListener}
                  disabled={listenerStatus === 'starting'}
                  className={`px-5 py-2 rounded-lg font-semibold shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                    listenerStatus === 'starting'
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-500/30'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {listenerStatus === 'starting' ? 'Starting...' : 'Start Listener'}
                </button>
              )}
            </div>
          </div>
          {listenerError && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{listenerError}</p>
            </div>
          )}
        </header>
        
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg shadow-lg border border-slate-700/50 p-4 md:p-6">
          <ExecutionConsole />
        </div>
      </div>
    </div>
  )
}
