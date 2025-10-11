'use client'

import React from 'react'
import Link from 'next/link'

interface VolumeSurge {
  symbol: string
  base: string
  surge_multiplier: number
  surge_multiplier_1h: number
  surge_multiplier_4h: number
  current_1h_volume: number
  current_4h_volume: number
  avg_hourly_volume: number
  avg_4h_volume: number
  volume_24h: number
  price_change_1h: number
  price_change_4h: number
  price_change_24h: number
  last_price: number
  volume_trend: 'accelerating' | 'stable' | 'declining'
  timeframe_alignment: 'both' | '1h_only' | '4h_only' | 'none'
  confidence: number
  signal: 'VERY_STRONG' | 'STRONG' | 'MEDIUM' | 'WEAK'
  reason: string
}

interface VolumeSurgeResponse {
  success: boolean
  surges: VolumeSurge[]
  total_analyzed: number
  total_surges: number
  parameters: {
    min_surge_multiplier: number
    max_price_change: number
    lookback_hours: number
  }
}

export default function VolumeSurgeDetector() {
  const [surges, setSurges] = React.useState<VolumeSurge[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = React.useState<number>(0)
  const [autoRefresh, setAutoRefresh] = React.useState(true)

  const fetchSurges = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      const response = await fetch(`${backend}/api/volume-surges`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data: VolumeSurgeResponse = await response.json()
      
      if (data.success && data.surges) {
        setSurges(data.surges)
        setLastUpdate(Date.now())
      }
    } catch (err: any) {
      console.error('Error fetching volume surges:', err)
      setError(err.message || 'Failed to load volume surges')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchSurges()
    
    if (autoRefresh) {
      // Refresh every 2 minutes for early detection
      const interval = setInterval(fetchSurges, 2 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'VERY_STRONG': return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/50'
      case 'STRONG': return 'text-green-400 bg-green-500/10 border-green-500/30'
      case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
      case 'WEAK': return 'text-slate-400 bg-slate-500/10 border-slate-500/30'
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30'
    }
  }

  const getSignalIcon = (signal: string) => {
    switch (signal) {
      case 'VERY_STRONG': return '🚀'
      case 'STRONG': return '🔥'
      case 'MEDIUM': return '⚡'
      case 'WEAK': return '📊'
      default: return '📊'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'accelerating': return '📈'
      case 'declining': return '📉'
      default: return '➡️'
    }
  }

  const formatVolume = (volume: number) => {
    if (volume >= 1_000_000) {
      return `$${(volume / 1_000_000).toFixed(2)}M`
    } else if (volume >= 1_000) {
      return `$${(volume / 1_000).toFixed(1)}K`
    }
    return `$${volume.toFixed(0)}`
  }

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  if (loading && surges.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          <p className="text-slate-400">Scanning for volume surges...</p>
          <p className="text-xs text-slate-500">Analyzing 200+ pairs for unusual volume activity</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="text-red-400 text-4xl">⚠️</div>
          <p className="text-slate-300">Failed to load volume surge data</p>
          <p className="text-sm text-slate-500">{error}</p>
          <button
            onClick={fetchSurges}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span>📊 Volume Surge Detection</span>
            <span className="text-xs font-normal text-slate-400">
              (Early Mover Signals)
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Volume spikes before price moves - catch the early accumulation phase
          </p>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2 sm:px-3 py-1.5 text-xs rounded-lg transition whitespace-nowrap ${
              autoRefresh 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-slate-700 text-slate-400 border border-slate-600'
            }`}
          >
            {autoRefresh ? '🔄 Auto' : '⏸ Manual'}
          </button>
          
          <button
            onClick={fetchSurges}
            disabled={loading}
            className="px-2 sm:px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 text-white text-xs rounded-lg transition whitespace-nowrap"
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
      {surges.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-slate-400">No volume surges detected</p>
          <p className="text-sm text-slate-500 mt-2">
            Try again in a few minutes - markets are constantly changing
          </p>
        </div>
      )}

      {/* Results Grid */}
      {surges.length > 0 && (
        <div className="space-y-3">
          {surges.map((surge, index) => (
            <div
              key={surge.symbol}
              className={`rounded-xl p-3 sm:p-4 border transition-all hover:border-cyan-500/50 ${
                getSignalColor(surge.signal)
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-0">
                {/* Left: Symbol & Signal */}
                <div className="flex-1 w-full sm:w-auto">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xl sm:text-2xl">{getSignalIcon(surge.signal)}</span>
                    <Link 
                      href={`/trading?symbol=${surge.symbol}`}
                      className="text-lg sm:text-xl font-bold text-white hover:text-cyan-400 transition"
                    >
                      {surge.base}
                    </Link>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold border ${
                      surge.signal === 'VERY_STRONG' ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400/70' :
                      surge.signal === 'STRONG' ? 'bg-green-500/20 text-green-400 border-green-500/50' :
                      surge.signal === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' :
                      'bg-slate-500/20 text-slate-400 border-slate-500/50'
                    }`}>
                      {surge.signal}
                    </span>
                    
                    {/* Timeframe alignment badge */}
                    {surge.timeframe_alignment === 'both' && (
                      <span className="text-xs px-2 py-1 rounded-full font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/50">
                        1h+4h ✓
                      </span>
                    )}
                  </div>

                  {/* Reason */}
                  <p className="text-xs sm:text-sm text-slate-300 mb-3">
                    {surge.reason}
                  </p>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 text-xs">
                    <div>
                      <div className="text-slate-500 mb-1">1h Surge</div>
                      <div className="text-cyan-400 font-bold text-sm sm:text-base">{surge.surge_multiplier_1h}x</div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">4h Surge</div>
                      <div className="text-purple-400 font-bold text-sm sm:text-base">{surge.surge_multiplier_4h}x</div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">Price (1h)</div>
                      <div className={`font-semibold text-sm sm:text-base ${
                        surge.price_change_1h > 0 ? 'text-green-400' : 
                        surge.price_change_1h < 0 ? 'text-red-400' : 
                        'text-slate-400'
                      }`}>
                        {surge.price_change_1h > 0 ? '+' : ''}{surge.price_change_1h.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">Confidence</div>
                      <div className="flex items-center gap-1">
                        <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full ${
                              surge.confidence > 70 ? 'bg-emerald-500' :
                              surge.confidence > 50 ? 'bg-yellow-500' :
                              'bg-slate-500'
                            }`}
                            style={{ width: `${surge.confidence}%` }}
                          />
                        </div>
                        <span className="text-white font-semibold w-8 sm:w-10 text-right text-xs sm:text-sm">
                          {surge.confidence.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Trend & Price */}
                <div className="text-left sm:text-right sm:ml-4 flex sm:flex-col gap-4 sm:gap-0">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Trend</div>
                    <div className="text-base sm:text-lg">
                      {getTrendIcon(surge.volume_trend)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Price</div>
                    <div className="text-xs sm:text-sm font-mono text-white">
                      ${surge.last_price.toFixed(4)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Details (collapsible on mobile) */}
              <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">1h Vol: </span>
                  <span className="text-cyan-400 font-mono">{formatVolume(surge.current_1h_volume)}</span>
                </div>
                <div>
                  <span className="text-slate-500">4h Vol: </span>
                  <span className="text-purple-400 font-mono">{formatVolume(surge.current_4h_volume)}</span>
                </div>
                <div>
                  <span className="text-slate-500">24h Change: </span>
                  <span className={`font-semibold ${
                    surge.price_change_24h > 0 ? 'text-green-400' : 
                    surge.price_change_24h < 0 ? 'text-red-400' : 
                    'text-slate-400'
                  }`}>
                    {surge.price_change_24h > 0 ? '+' : ''}{surge.price_change_24h.toFixed(2)}%
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
          <p>💡 <strong>Multi-Timeframe Detection:</strong> 1h = Early signal | 4h = Trend confirmation | BOTH = STRONGEST signal 🚀</p>
          <p>⚡ <strong>Pro tip:</strong> VERY_STRONG signals (both timeframes aligned) have highest probability of big moves</p>
        </div>
      </div>
    </div>
  )
}
