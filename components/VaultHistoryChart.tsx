'use client'

import React, { useState, useEffect } from 'react'

interface ApyHistoryPoint {
  timestamp: number
  timestamp_iso: string
  apy: number
  apy_base: number
  apy_reward: number | null
  tvl_usd: number
  outlier: boolean
}

interface VaultHistoryProps {
  vaultId: string
  vaultName: string
  onClose: () => void
}

export default function VaultHistoryChart({ vaultId, vaultName, onClose }: VaultHistoryProps) {
  const [history, setHistory] = useState<ApyHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [hours, setHours] = useState(24)
  const [currentApy, setCurrentApy] = useState<number | null>(null)
  const [apyChange, setApyChange] = useState<number | null>(null)

  const getBackendUrl = () => {
    try {
      const hn = location.hostname
      const p = location.port
      if ((hn === 'localhost' || hn === '127.0.0.1') && p === '3000') {
        return 'http://127.0.0.1:8000'
      }
    } catch (e) {}
    return ''
  }

  useEffect(() => {
    fetchHistory()
    const interval = setInterval(fetchHistory, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [hours])

  async function fetchHistory() {
    try {
      setLoading(true)
      const backend = getBackendUrl()
      const res = await fetch(`${backend}/api/defi-vaults/history/${vaultId}?hours=${hours}`)
      if (!res.ok) throw new Error('Failed to fetch history')
      
      const data = await res.json()
      setHistory(data.history || [])
      setCurrentApy(data.current_apy)
      setApyChange(data.apy_change)
    } catch (e) {
      console.error('Failed to fetch history:', e)
    } finally {
      setLoading(false)
    }
  }

  // Simple ASCII-style chart rendering
  const renderChart = () => {
    if (history.length === 0) {
      return (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-lg">No historical data available yet</p>
          <p className="text-sm mt-2">The monitoring system collects data every 5 minutes</p>
          <p className="text-xs text-slate-500 mt-1">Check back in a few minutes!</p>
        </div>
      )
    }

    const maxApy = Math.max(...history.map(h => h.apy))
    const minApy = Math.min(...history.map(h => h.apy))
    const range = maxApy - minApy || 1
    
    return (
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <div className="text-slate-400 text-sm mb-1">Current APY</div>
            <div className="text-2xl font-bold text-emerald-400">
              {currentApy?.toFixed(2)}%
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <div className="text-slate-400 text-sm mb-1">Change ({hours}h)</div>
            <div className={`text-2xl font-bold ${apyChange && apyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {apyChange !== null ? `${apyChange >= 0 ? '+' : ''}${apyChange.toFixed(2)}%` : 'N/A'}
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <div className="text-slate-400 text-sm mb-1">Data Points</div>
            <div className="text-2xl font-bold text-white">
              {history.length}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
          <div className="h-64 relative">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-0 w-16 flex flex-col justify-between text-xs text-slate-400 pr-2">
              <span>{maxApy.toFixed(1)}%</span>
              <span>{((maxApy + minApy) / 2).toFixed(1)}%</span>
              <span>{minApy.toFixed(1)}%</span>
            </div>

            {/* Chart area */}
            <div className="ml-16 h-full relative">
              <svg className="w-full h-full" viewBox="0 0 1000 256" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="0" x2="1000" y2="0" stroke="#334155" strokeWidth="1" />
                <line x1="0" y1="128" x2="1000" y2="128" stroke="#334155" strokeWidth="1" strokeDasharray="4" />
                <line x1="0" y1="256" x2="1000" y2="256" stroke="#334155" strokeWidth="1" />

                {/* APY line */}
                <polyline
                  points={history.map((point, i) => {
                    const x = (i / (history.length - 1 || 1)) * 1000
                    const y = 256 - ((point.apy - minApy) / range) * 256
                    return `${x},${y}`
                  }).join(' ')}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Base APY line (if different from total) */}
                {history.some(h => h.apy_base !== h.apy) && (
                  <polyline
                    points={history.map((point, i) => {
                      const x = (i / (history.length - 1 || 1)) * 1000
                      const y = 256 - ((point.apy_base - minApy) / range) * 256
                      return `${x},${y}`
                    }).join(' ')}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeDasharray="4"
                    opacity="0.6"
                  />
                )}

                {/* Data points */}
                {history.map((point, i) => {
                  const x = (i / (history.length - 1 || 1)) * 1000
                  const y = 256 - ((point.apy - minApy) / range) * 256
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="4"
                      fill={point.outlier ? '#ef4444' : '#10b981'}
                      stroke="#1e293b"
                      strokeWidth="2"
                    />
                  )
                })}
              </svg>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
              <span className="text-slate-400">Total APY</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full opacity-60"></div>
              <span className="text-slate-400">Base APY</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-slate-400">Outlier</span>
            </div>
          </div>
        </div>

        {/* Recent data points */}
        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Recent Data Points</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {history.slice(-10).reverse().map((point, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-slate-800 last:border-0">
                <span className="text-slate-400">
                  {new Date(point.timestamp * 1000).toLocaleString()}
                </span>
                <div className="flex items-center gap-4">
                  <span className="text-emerald-400 font-semibold">{point.apy.toFixed(2)}%</span>
                  {point.outlier && (
                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">Outlier</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">APY History</h2>
              <p className="text-slate-400">{vaultName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Time range selector */}
          <div className="flex gap-2">
            {[6, 12, 24, 48, 168].map((h) => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  hours === h
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {h < 24 ? `${h}h` : `${h / 24}d`}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-16 text-slate-400">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
              <p>Loading history...</p>
            </div>
          ) : (
            renderChart()
          )}
        </div>
      </div>
    </div>
  )
}
