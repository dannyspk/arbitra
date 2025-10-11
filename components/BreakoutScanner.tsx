'use client'

import React from 'react'
import Link from 'next/link'

interface Breakout {
  symbol: string
  base: string
  breakout_direction: 'BULLISH' | 'BEARISH'
  breakout_strength: number
  consolidation_range_pct: number
  consolidation_high: number
  consolidation_low: number
  current_price: number
  volume_increase: number
  hours_since_breakout: number
  pattern_type: string
  confidence: number
  signal: 'VERY_STRONG' | 'STRONG' | 'MEDIUM' | 'WEAK'
  volume_24h: number
  market_cap?: number
  reason: string
}

interface BreakoutResponse {
  success: boolean
  breakouts: Breakout[]
  total_analyzed: number
  total_breakouts: number
  parameters: {
    consolidation_hours: number
    min_breakout_pct: number
    min_volume_increase: number
  }
}

export default function BreakoutScanner() {
  const [breakouts, setBreakouts] = React.useState<Breakout[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = React.useState<number>(0)
  const [autoRefresh, setAutoRefresh] = React.useState(true)
  const [directionFilter, setDirectionFilter] = React.useState<'both' | 'bullish' | 'bearish'>('both')

  const fetchBreakouts = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      const response = await fetch(`${backend}/api/breakout-scanner?direction=${directionFilter}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data: BreakoutResponse = await response.json()
      
      if (data.success && data.breakouts) {
        setBreakouts(data.breakouts)
        setLastUpdate(Date.now())
      }
    } catch (err: any) {
      console.error('Error fetching breakouts:', err)
      setError(err.message || 'Failed to load breakouts')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchBreakouts()
    
    if (autoRefresh) {
      // Refresh every 3 minutes
      const interval = setInterval(fetchBreakouts, 3 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, directionFilter])

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'VERY_STRONG': return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/50'
      case 'STRONG': return 'text-green-400 bg-green-500/10 border-green-500/30'
      case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
      case 'WEAK': return 'text-slate-400 bg-slate-500/10 border-slate-500/30'
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30'
    }
  }

  const getDirectionColor = (direction: string) => {
    return direction === 'BULLISH' 
      ? 'bg-green-500/20 text-green-300 border-green-500/50'
      : 'bg-red-500/20 text-red-300 border-red-500/50'
  }

  const getDirectionIcon = (direction: string) => {
    return direction === 'BULLISH' ? '🚀' : '📉'
  }

  const formatVolume = (volume: number) => {
    if (volume >= 1_000_000) {
      return `$${(volume / 1_000_000).toFixed(2)}M`
    } else if (volume >= 1_000) {
      return `$${(volume / 1_000).toFixed(1)}K`
    }
    return `$${volume.toFixed(0)}`
  }

  const formatMarketCap = (mcap: number | undefined | null) => {
    if (!mcap) return 'N/A'
    if (mcap >= 1_000_000_000) {
      return `$${(mcap / 1_000_000_000).toFixed(2)}B`
    } else if (mcap >= 1_000_000) {
      return `$${(mcap / 1_000_000).toFixed(0)}M`
    }
    return `$${(mcap / 1_000).toFixed(0)}K`
  }

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  if (loading && breakouts.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          <p className="text-slate-400">Scanning for breakout patterns...</p>
          <p className="text-xs text-slate-500">Analyzing consolidations and price action</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="text-red-400 text-4xl">⚠️</div>
          <p className="text-slate-300">Failed to load breakout data</p>
          <p className="text-sm text-slate-500">{error}</p>
          <button
            onClick={fetchBreakouts}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            💥 Breakout Scanner
            <span className="text-xs font-normal text-slate-400 ml-2">
              (Pattern Detection)
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Tight consolidations breaking out - early entries for big moves
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Direction Filter */}
          <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
            <button
              onClick={() => setDirectionFilter('both')}
              className={`px-3 py-1.5 text-xs rounded-md transition ${
                directionFilter === 'both'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              Both
            </button>
            <button
              onClick={() => setDirectionFilter('bullish')}
              className={`px-3 py-1.5 text-xs rounded-md transition flex items-center gap-1 ${
                directionFilter === 'bullish'
                  ? 'bg-green-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              🚀 Longs
            </button>
            <button
              onClick={() => setDirectionFilter('bearish')}
              className={`px-3 py-1.5 text-xs rounded-md transition flex items-center gap-1 ${
                directionFilter === 'bearish'
                  ? 'bg-red-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              📉 Shorts
            </button>
          </div>
          
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 text-xs rounded-lg transition ${
              autoRefresh 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-slate-700 text-slate-400 border border-slate-600'
            }`}
          >
            {autoRefresh ? '🔄 Auto' : '⏸ Manual'}
          </button>
          
          <button
            onClick={fetchBreakouts}
            disabled={loading}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 text-white text-xs rounded-lg transition"
          >
            {loading ? 'Scanning...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Last Update */}
      {lastUpdate > 0 && (
        <div className="text-xs text-slate-500 mb-4">
          Last updated: {formatTimeAgo(lastUpdate)}
        </div>
      )}

      {/* No Results */}
      {breakouts.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">
            {directionFilter === 'bullish' ? '🚀' : directionFilter === 'bearish' ? '📉' : '🔍'}
          </div>
          <p className="text-slate-400">
            {directionFilter === 'bullish' ? 'No bullish breakouts detected' :
             directionFilter === 'bearish' ? 'No bearish breakdowns detected' :
             'No breakouts detected'}
          </p>
          <p className="text-sm text-slate-500 mt-2">
            {directionFilter === 'bearish' 
              ? 'Bearish breakdowns are rare in bull markets. Try lowering min_breakout_pct or check "Both" filter.'
              : 'Markets are currently consolidating - waiting for breakouts'
            }
          </p>
        </div>
      )}

      {/* Results Grid */}
      {breakouts.length > 0 && (
        <div className="space-y-3">
          {breakouts.map((breakout) => (
            <div
              key={breakout.symbol}
              className={`rounded-xl p-4 border transition-all hover:border-cyan-500/50 ${
                getSignalColor(breakout.signal)
              }`}
            >
              <div className="flex items-start justify-between">
                {/* Left: Symbol & Direction */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getDirectionIcon(breakout.breakout_direction)}</span>
                    <Link 
                      href={`/trading?symbol=${breakout.symbol}`}
                      className="text-xl font-bold text-white hover:text-cyan-400 transition"
                    >
                      {breakout.base}
                    </Link>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold border ${
                      getDirectionColor(breakout.breakout_direction)
                    }`}>
                      {breakout.breakout_direction}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold border ${
                      breakout.signal === 'VERY_STRONG' ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400/70' :
                      breakout.signal === 'STRONG' ? 'bg-green-500/20 text-green-400 border-green-500/50' :
                      breakout.signal === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' :
                      'bg-slate-500/20 text-slate-400 border-slate-500/50'
                    }`}>
                      {breakout.signal}
                    </span>
                  </div>

                  {/* Reason */}
                  <p className="text-sm text-slate-300 mb-3">
                    {breakout.reason}
                  </p>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <div className="text-slate-500 mb-1">Breakout</div>
                      <div className={`font-bold ${
                        breakout.breakout_direction === 'BULLISH' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {breakout.breakout_direction === 'BULLISH' ? '+' : '-'}{breakout.breakout_strength.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">Pattern</div>
                      <div className="text-purple-400 font-semibold">{breakout.pattern_type}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">Volume</div>
                      <div className="text-cyan-400 font-bold">{breakout.volume_increase.toFixed(1)}x</div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">Confidence</div>
                      <div className="flex items-center gap-1">
                        <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full ${
                              breakout.confidence > 70 ? 'bg-emerald-500' :
                              breakout.confidence > 50 ? 'bg-yellow-500' :
                              'bg-slate-500'
                            }`}
                            style={{ width: `${breakout.confidence}%` }}
                          />
                        </div>
                        <span className="text-white font-semibold w-10 text-right">
                          {breakout.confidence.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Time & Price */}
                <div className="text-right ml-4">
                  <div className="text-xs text-slate-500 mb-1">Time</div>
                  <div className={`text-sm font-bold mb-2 ${
                    breakout.hours_since_breakout <= 2 ? 'text-green-400' :
                    breakout.hours_since_breakout <= 6 ? 'text-yellow-400' :
                    'text-slate-400'
                  }`}>
                    {breakout.hours_since_breakout}h ago
                  </div>
                  <div className="text-xs text-slate-500 mb-1">Price</div>
                  <div className="text-sm font-mono text-white">
                    ${breakout.current_price.toFixed(4)}
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Range: </span>
                  <span className="text-slate-300 font-semibold">{breakout.consolidation_range_pct.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-slate-500">High: </span>
                  <span className="text-slate-300 font-mono">${breakout.consolidation_high.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Low: </span>
                  <span className="text-slate-300 font-mono">${breakout.consolidation_low.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Market Cap: </span>
                  <span className={`font-semibold ${
                    breakout.market_cap && breakout.market_cap < 100_000_000 ? 'text-green-400' :
                    breakout.market_cap && breakout.market_cap < 500_000_000 ? 'text-yellow-400' :
                    'text-slate-400'
                  }`}>
                    {formatMarketCap(breakout.market_cap)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Footer */}
      <div className="mt-6 pt-4 border-t border-slate-700/50">
        <div className="text-xs text-slate-500 space-y-1">
          <p>💡 <strong>How to use:</strong> FRESH breakouts (≤2h) from tight squeezes (&lt;5% range) have highest probability</p>
          <p>⚡ <strong>Pro tip:</strong> Enter on pullback to breakout level for best risk/reward - confirm with volume</p>
        </div>
      </div>
    </div>
  )
}
