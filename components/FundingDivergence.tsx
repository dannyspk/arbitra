'use client'

import React from 'react'
import Link from 'next/link'

interface FundingOpportunity {
  symbol: string
  base: string
  funding_rate: number
  funding_direction: 'POSITIVE' | 'NEGATIVE'
  extreme_level: string
  price_change_24h: number
  current_price: number
  open_interest: number
  signal_type: string
  trade_direction: 'LONG' | 'SHORT'
  confidence: number
  signal: 'VERY_STRONG' | 'STRONG' | 'MEDIUM' | 'WEAK'
  market_cap?: number
  reason: string
}

interface FundingResponse {
  success: boolean
  opportunities: FundingOpportunity[]
  total_analyzed: number
  total_extreme: number
  parameters: {
    min_extreme: number
    min_oi_change: number
    lookback_hours: number
    max_market_cap: number
  }
}

export default function FundingDivergence() {
  const [opportunities, setOpportunities] = React.useState<FundingOpportunity[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = React.useState<number>(0)
  const [autoRefresh, setAutoRefresh] = React.useState(true)

  const fetchOpportunities = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      const response = await fetch(`${backend}/api/funding-divergence`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data: FundingResponse = await response.json()
      
      if (data.success && data.opportunities) {
        setOpportunities(data.opportunities)
        setLastUpdate(Date.now())
      }
    } catch (err: any) {
      console.error('Error fetching funding opportunities:', err)
      setError(err.message || 'Failed to load opportunities')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchOpportunities()
    
    if (autoRefresh) {
      // Refresh every 5 minutes (funding rates change every 8h typically)
      const interval = setInterval(fetchOpportunities, 5 * 60 * 1000)
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

  const getSignalTypeColor = (signalType: string) => {
    switch (signalType) {
      case 'MEAN_REVERSION': return 'bg-purple-500/20 text-purple-300 border-purple-500/50'
      case 'SHORT_SQUEEZE': return 'bg-green-500/20 text-green-300 border-green-500/50'
      case 'LONG_LIQUIDATION': return 'bg-red-500/20 text-red-300 border-red-500/50'
      case 'MOMENTUM': return 'bg-blue-500/20 text-blue-300 border-blue-500/50'
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/50'
    }
  }

  const getDirectionIcon = (direction: string) => {
    return direction === 'LONG' ? '🚀' : '📉'
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

  if (loading && opportunities.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
          <p className="text-slate-400">Scanning funding rates...</p>
          <p className="text-xs text-slate-500">Detecting extreme positions and squeeze opportunities</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="text-red-400 text-4xl">⚠️</div>
          <p className="text-slate-300">Failed to load funding data</p>
          <p className="text-sm text-slate-500">{error}</p>
          <button
            onClick={fetchOpportunities}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
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
            💰 Funding Divergence
            <span className="text-xs font-normal text-slate-400 ml-2">
              (Futures Signals)
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Extreme funding rates signaling squeeze setups and reversals
          </p>
        </div>
        
        <div className="flex items-center gap-3">
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
            onClick={fetchOpportunities}
            disabled={loading}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 text-white text-xs rounded-lg transition"
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
      {opportunities.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-slate-400">No extreme funding detected</p>
          <p className="text-sm text-slate-500 mt-2">
            Markets are balanced - waiting for extreme funding situations
          </p>
        </div>
      )}

      {/* Results Grid */}
      {opportunities.length > 0 && (
        <div className="space-y-3">
          {opportunities.map((opp) => (
            <div
              key={opp.symbol}
              className={`rounded-xl p-4 border transition-all hover:border-purple-500/50 ${
                getSignalColor(opp.signal)
              }`}
            >
              <div className="flex items-start justify-between">
                {/* Left: Symbol & Direction */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getDirectionIcon(opp.trade_direction)}</span>
                    <Link 
                      href={`/trading?symbol=${opp.symbol.replace('USDT', '')}`}
                      className="text-xl font-bold text-white hover:text-purple-400 transition"
                    >
                      {opp.base}
                    </Link>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold border ${
                      getSignalTypeColor(opp.signal_type)
                    }`}>
                      {opp.signal_type.replace('_', ' ')}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold border ${
                      opp.signal === 'VERY_STRONG' ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400/70' :
                      opp.signal === 'STRONG' ? 'bg-green-500/20 text-green-400 border-green-500/50' :
                      opp.signal === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' :
                      'bg-slate-500/20 text-slate-400 border-slate-500/50'
                    }`}>
                      {opp.signal}
                    </span>
                  </div>

                  {/* Reason */}
                  <p className="text-sm text-slate-300 mb-3">
                    {opp.reason}
                  </p>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <div className="text-slate-500 mb-1">Funding Rate</div>
                      <div className={`font-bold ${
                        Math.abs(opp.funding_rate) > 0.15 ? 'text-red-400' :
                        Math.abs(opp.funding_rate) > 0.10 ? 'text-orange-400' :
                        'text-yellow-400'
                      }`}>
                        {opp.funding_rate > 0 ? '+' : ''}{opp.funding_rate.toFixed(4)}%
                      </div>
                      <div className="text-slate-500 text-[10px]">{opp.extreme_level}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">Price 24h</div>
                      <div className={`font-bold ${
                        opp.price_change_24h > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {opp.price_change_24h > 0 ? '+' : ''}{opp.price_change_24h.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">Trade</div>
                      <div className={`font-bold ${
                        opp.trade_direction === 'LONG' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {opp.trade_direction}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">Confidence</div>
                      <div className="flex items-center gap-1">
                        <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full ${
                              opp.confidence > 70 ? 'bg-emerald-500' :
                              opp.confidence > 50 ? 'bg-yellow-500' :
                              'bg-slate-500'
                            }`}
                            style={{ width: `${opp.confidence}%` }}
                          />
                        </div>
                        <span className="text-white font-semibold w-10 text-right">
                          {opp.confidence.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Price & Market Cap */}
                <div className="text-right ml-4">
                  <div className="text-xs text-slate-500 mb-1">Price</div>
                  <div className="text-sm font-mono text-white mb-2">
                    ${opp.current_price.toFixed(4)}
                  </div>
                  {opp.market_cap && (
                    <>
                      <div className="text-xs text-slate-500 mb-1">MCap</div>
                      <div className={`text-xs font-semibold ${
                        opp.market_cap && opp.market_cap < 100_000_000 ? 'text-green-400' :
                        opp.market_cap && opp.market_cap < 500_000_000 ? 'text-yellow-400' :
                        'text-slate-400'
                      }`}>
                        {formatMarketCap(opp.market_cap)}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Additional Details */}
              <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Open Interest: </span>
                  <span className="text-slate-300 font-semibold">{opp.open_interest.toFixed(0)} contracts</span>
                </div>
                <div>
                  <span className="text-slate-500">Direction: </span>
                  <span className={`font-semibold ${
                    opp.funding_direction === 'POSITIVE' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {opp.funding_direction === 'POSITIVE' ? 'Longs pay shorts' : 'Shorts pay longs'}
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
          <p>💡 <strong>Mean Reversion:</strong> Extreme funding + stable price = reversal likely (opposite direction)</p>
          <p>🚀 <strong>Squeeze:</strong> Extreme funding opposite to price = trapped positions = explosive move</p>
          <p>⚡ <strong>Momentum:</strong> Funding + price aligned = strong conviction = continuation likely</p>
        </div>
      </div>
    </div>
  )
}
