'use client'

import React from 'react'
import Link from 'next/link'

interface CompositeMove {
  symbol: string
  base: string
  composite_score: number
  signal: 'VERY_STRONG' | 'STRONG' | 'MEDIUM' | 'WEAK'
  signal_count: number
  active_signals: string[]
  breakdown: {
    volume_contribution: number
    breakout_contribution: number
    funding_contribution: number
    momentum_contribution: number
  }
  individual_scores: {
    volume_surge: number | null
    breakout: number | null
    funding_divergence: number | null
  }
  market_cap: number | null
  price_change_24h: number
  reason: string
}

interface CompositeResponse {
  success: boolean
  movers: CompositeMove[]
  total_analyzed: number
  total_qualified: number
  parameters: {
    min_score: number
    max_market_cap: number
    weights: {
      volume_surge: string
      breakout: string
      funding_divergence: string
      momentum: string
    }
  }
}

export default function CompositeMoverScore() {
  const [movers, setMovers] = React.useState<CompositeMove[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = React.useState<number>(0)
  const [autoRefresh, setAutoRefresh] = React.useState(true)
  const [minScore, setMinScore] = React.useState<number>(30)
  const [selectedSymbol, setSelectedSymbol] = React.useState<string | null>(null)
  
  // Signal data for selected symbol
  const [signalData, setSignalData] = React.useState<any | null>(null)
  const [signalLoading, setSignalLoading] = React.useState(false)
  const [signalError, setSignalError] = React.useState<string | null>(null)
  
  // All Binance symbols for search
  const [allBinanceSymbols, setAllBinanceSymbols] = React.useState<string[]>([])
  const [binanceSymbolsLoading, setBinanceSymbolsLoading] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false)
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const fetchMovers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      const response = await fetch(`${backend}/api/big-mover-score?min_score=${minScore}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data: CompositeResponse = await response.json()
      
      if (data.success && data.movers) {
        setMovers(data.movers)
        setLastUpdate(Date.now())
      }
    } catch (err: any) {
      console.error('Error fetching composite scores:', err)
      setError(err.message || 'Failed to load composite scores')
    } finally {
      setLoading(false)
    }
  }

  const fetchSignalsForSymbol = async (symbol: string) => {
    try {
      setSignalLoading(true)
      setSignalError(null)
      
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      
      // Use the new symbol-specific endpoint
      const response = await fetch(`${backend}/api/symbol-signals/${symbol}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success && data.data) {
        // Map the response to our expected format
        const symbolData = {
          volume: data.data.volume_surge,
          breakout: data.data.breakout,
          funding: data.data.funding_divergence
        }
        setSignalData(symbolData)
      }
    } catch (err: any) {
      console.error('Error fetching signals for symbol:', err)
      setSignalError(err.message || 'Failed to load signals')
    } finally {
      setSignalLoading(false)
    }
  }

  React.useEffect(() => {
    fetchMovers()
    
    if (autoRefresh) {
      // Refresh every 5 minutes (slower since it aggregates other endpoints)
      const interval = setInterval(fetchMovers, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, minScore])

  // Fetch all Binance Futures symbols on mount
  React.useEffect(() => {
    const fetchBinanceSymbols = async () => {
      setBinanceSymbolsLoading(true)
      try {
        const response = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo')
        const data = await response.json()
        
        if (data.symbols && Array.isArray(data.symbols)) {
          // Filter for USDT perpetual contracts that are trading
          const usdtSymbols = data.symbols
            .filter((s: any) => 
              s.status === 'TRADING' && 
              s.contractType === 'PERPETUAL' &&
              s.symbol.endsWith('USDT')
            )
            .map((s: any) => s.symbol)
            .sort()
          
          setAllBinanceSymbols(usdtSymbols)
        }
      } catch (error) {
        console.error('Failed to fetch Binance symbols:', error)
      } finally {
        setBinanceSymbolsLoading(false)
      }
    }
    
    fetchBinanceSymbols()
  }, [])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
        setSearchTerm('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load signals when symbol is selected
  React.useEffect(() => {
    if (selectedSymbol) {
      fetchSignalsForSymbol(selectedSymbol)
    } else {
      setSignalData(null)
      setSignalError(null)
    }
  }, [selectedSymbol])

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'VERY_STRONG': return 'from-emerald-500 to-green-500'
      case 'STRONG': return 'from-green-500 to-cyan-500'
      case 'MEDIUM': return 'from-yellow-500 to-orange-500'
      case 'WEAK': return 'from-slate-500 to-slate-600'
      default: return 'from-slate-500 to-slate-600'
    }
  }

  const getSignalBadgeColor = (signal: string) => {
    switch (signal) {
      case 'VERY_STRONG': return 'bg-emerald-500/30 text-emerald-300 border-emerald-400/70'
      case 'STRONG': return 'bg-green-500/30 text-green-300 border-green-400/70'
      case 'MEDIUM': return 'bg-yellow-500/30 text-yellow-300 border-yellow-400/70'
      case 'WEAK': return 'bg-slate-500/30 text-slate-300 border-slate-400/70'
      default: return 'bg-slate-500/30 text-slate-300 border-slate-400/70'
    }
  }

  const formatMarketCap = (mcap: number | null) => {
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

  // Filter symbols based on search term
  const filteredSymbols = React.useMemo(() => {
    if (!searchTerm) return allBinanceSymbols.slice(0, 50) // Show first 50 if no search
    const upper = searchTerm.toUpperCase()
    return allBinanceSymbols
      .filter(s => s.includes(upper))
      .slice(0, 50) // Limit to 50 results
  }, [searchTerm, allBinanceSymbols])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsDropdownOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < filteredSymbols.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredSymbols.length) {
          handleSymbolSelect(filteredSymbols[highlightedIndex])
        }
        break
      case 'Escape':
        setIsDropdownOpen(false)
        setSearchTerm('')
        break
    }
  }

  const handleSymbolSelect = (symbol: string) => {
    setSelectedSymbol(symbol)
    setIsDropdownOpen(false)
    setSearchTerm('')
    setHighlightedIndex(-1)
  }

  if (loading && movers.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
          <p className="text-slate-400">Analyzing all signals...</p>
          <p className="text-xs text-slate-500">Combining volume, breakouts, and funding data</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="text-red-400 text-4xl">⚠️</div>
          <p className="text-slate-300">Failed to load composite scores</p>
          <p className="text-sm text-slate-500">{error}</p>
          <button
            onClick={fetchMovers}
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
            🎯 Big Mover Score
            <span className="text-xs font-normal text-slate-400 ml-2">
              (All Signals Combined)
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Ultimate accuracy: Volume + Breakouts + Funding + Momentum
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Symbol Selector - Searchable */}
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-1.5">
            <span className="text-xs text-slate-400">Symbol:</span>
            <div className="relative" ref={dropdownRef}>
              <input
                ref={inputRef}
                type="text"
                value={isDropdownOpen ? searchTerm : (selectedSymbol || 'All (Overview)')}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setIsDropdownOpen(true)
                  setHighlightedIndex(-1)
                }}
                onFocus={() => {
                  setIsDropdownOpen(true)
                  setSearchTerm('')
                }}
                onKeyDown={handleKeyDown}
                placeholder={selectedSymbol || "Search trading pair..."}
                className="bg-slate-700 text-white text-xs rounded px-2 py-1 outline-none min-w-[180px] focus:ring-2 focus:ring-purple-500"
              />
              
              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 max-h-80 overflow-y-auto">
                  {binanceSymbolsLoading ? (
                    <div className="p-4 text-center text-slate-400 text-xs">
                      Loading symbols...
                    </div>
                  ) : filteredSymbols.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs">
                      No symbols found
                    </div>
                  ) : (
                    <>
                      {/* Overview Option */}
                      <button
                        onClick={() => {
                          setSelectedSymbol(null)
                          setIsDropdownOpen(false)
                          setSearchTerm('')
                        }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-700 transition ${
                          !selectedSymbol ? 'bg-slate-700 text-purple-400 font-semibold' : 'text-white'
                        }`}
                      >
                        📊 All (Overview)
                      </button>
                      
                      <div className="border-t border-slate-700 my-1"></div>
                      
                      {/* High Score Movers Section */}
                      {movers.length > 0 && searchTerm === '' && (
                        <>
                          <div className="px-3 py-1 text-xs font-semibold text-slate-500 bg-slate-900/50">
                            🎯 HIGH SCORES
                          </div>
                          {movers.map((m) => (
                            <button
                              key={m.symbol}
                              onClick={() => handleSymbolSelect(m.symbol)}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-700 transition flex items-center justify-between ${
                                selectedSymbol === m.symbol ? 'bg-slate-700 text-purple-400' : 'text-white'
                              }`}
                            >
                              <span>
                                {m.base} 
                                <span className="text-slate-500 ml-1">({m.symbol})</span>
                              </span>
                              <span className={`font-bold ${
                                m.signal === 'VERY_STRONG' ? 'text-emerald-400' :
                                m.signal === 'STRONG' ? 'text-green-400' :
                                m.signal === 'MEDIUM' ? 'text-yellow-400' :
                                'text-slate-400'
                              }`}>
                                {m.composite_score.toFixed(0)}
                              </span>
                            </button>
                          ))}
                          <div className="border-t border-slate-700 my-1"></div>
                          <div className="px-3 py-1 text-xs font-semibold text-slate-500 bg-slate-900/50">
                            🔍 ALL BINANCE PAIRS
                          </div>
                        </>
                      )}
                      
                      {/* All Symbols */}
                      {filteredSymbols.map((symbol, idx) => (
                        <button
                          key={symbol}
                          onClick={() => handleSymbolSelect(symbol)}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          className={`w-full text-left px-3 py-2 text-xs transition ${
                            highlightedIndex === idx ? 'bg-slate-700' : 
                            selectedSymbol === symbol ? 'bg-slate-700 text-purple-400' : 
                            'hover:bg-slate-700 text-slate-300'
                          }`}
                        >
                          {symbol}
                        </button>
                      ))}
                      
                      {filteredSymbols.length === 50 && (
                        <div className="px-3 py-2 text-xs text-slate-500 text-center bg-slate-900/50">
                          Type to search more...
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Clear Selection Button */}
          {selectedSymbol && (
            <button
              onClick={() => setSelectedSymbol(null)}
              className="px-2 py-1 text-xs text-slate-400 hover:text-white transition"
              title="Back to Overview"
            >
              ← Back
            </button>
          )}
          
          {/* Min Score Selector */}
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-1.5">
            <span className="text-xs text-slate-400">Min Score:</span>
            <select
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="bg-slate-700 text-white text-xs rounded px-2 py-1 outline-none"
            >
              <option value={30}>30+</option>
              <option value={60}>60+</option>
              <option value={70}>70+</option>
              <option value={80}>80+</option>
              <option value={90}>90+</option>
            </select>
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
            onClick={fetchMovers}
            disabled={loading}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 text-white text-xs rounded-lg transition"
          >
            {loading ? 'Analyzing...' : 'Refresh'}
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
      {movers.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-slate-400">No high-scoring opportunities</p>
          <p className="text-sm text-slate-500 mt-2">
            Try lowering the minimum score threshold
          </p>
        </div>
      )}

      {/* Results Grid */}
      {selectedSymbol ? (
        // Detailed view for ANY selected symbol
        <div className="space-y-4">
          {/* Back Button */}
          <button
            onClick={() => setSelectedSymbol(null)}
            className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-2 mb-4"
          >
            ← Back to Overview
          </button>
          
          {/* Get mover data if exists */}
          {(() => {
            const mover = movers.find(m => m.symbol === selectedSymbol)
            
            return (
              <div className="space-y-4">
                {/* Show composite card if in movers list */}
                {mover && (
                  <div className="rounded-xl p-6 border-2 bg-gradient-to-br from-slate-800/50 to-slate-900/50"
                    style={{
                      borderImage: `linear-gradient(135deg, ${getSignalColor(mover.signal)}) 1`
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br ${getSignalColor(mover.signal)} text-white font-bold text-2xl`}>
                          {mover.base.charAt(0)}
                        </div>
                        <div>
                          <Link 
                            href={`/trading?symbol=${mover.symbol}`}
                            className="text-3xl font-bold text-white hover:text-purple-400 transition flex items-center gap-2"
                          >
                            {mover.base}
                          </Link>
                          <p className="text-slate-400 text-sm mt-1">{mover.symbol}</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-4xl font-bold text-white mb-2">
                          {mover.composite_score.toFixed(1)}
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold border ${getSignalBadgeColor(mover.signal)}`}>
                          {mover.signal}
                        </span>
                      </div>
                    </div>
                    
                    {/* Active Signals Pills */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      <span className="text-xs text-slate-400 mr-2">Active Signals:</span>
                      {mover.active_signals.map((sig, idx) => (
                        <span key={idx} className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs border border-purple-500/30">
                          {sig}
                        </span>
                      ))}
                    </div>
                    
                    {/* Score Breakdown Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <div className="text-xs text-slate-400 mb-1">Volume Score</div>
                        <div className="text-2xl font-bold text-cyan-400">
                          {mover.breakdown.volume_contribution.toFixed(1)}
                        </div>
                        {mover.individual_scores.volume_surge !== null && (
                          <div className="text-xs text-slate-500 mt-1">
                            {mover.individual_scores.volume_surge.toFixed(0)}% × 30%
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <div className="text-xs text-slate-400 mb-1">Breakout Score</div>
                        <div className="text-2xl font-bold text-green-400">
                          {mover.breakdown.breakout_contribution.toFixed(1)}
                        </div>
                        {mover.individual_scores.breakout !== null && (
                          <div className="text-xs text-slate-500 mt-1">
                            {mover.individual_scores.breakout.toFixed(0)}% × 30%
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <div className="text-xs text-slate-400 mb-1">Funding Score</div>
                        <div className="text-2xl font-bold text-yellow-400">
                          {mover.breakdown.funding_contribution.toFixed(1)}
                        </div>
                        {mover.individual_scores.funding_divergence !== null && (
                          <div className="text-xs text-slate-500 mt-1">
                            {mover.individual_scores.funding_divergence.toFixed(0)}% × 20%
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <div className="text-xs text-slate-400 mb-1">Momentum Score</div>
                        <div className="text-2xl font-bold text-orange-400">
                          {mover.breakdown.momentum_contribution.toFixed(1)}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {mover.price_change_24h > 0 ? '+' : ''}{mover.price_change_24h.toFixed(2)}% × 20%
                        </div>
                      </div>
                    </div>
                    
                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-xs text-slate-400">24h Change</div>
                        <div className={`text-lg font-bold ${mover.price_change_24h > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {mover.price_change_24h > 0 ? '+' : ''}{mover.price_change_24h.toFixed(2)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-slate-400">Market Cap</div>
                        <div className="text-lg font-bold text-white">
                          {formatMarketCap(mover.market_cap)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-slate-400">Signals</div>
                        <div className="text-lg font-bold text-purple-400">
                          {mover.signal_count}/3
                        </div>
                      </div>
                    </div>
                    
                    {/* Reason */}
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <div className="text-xs text-slate-400 mb-2">Analysis</div>
                      <p className="text-sm text-slate-300">{mover.reason}</p>
                    </div>
                    
                    {/* Signal Details Section */}
                    {signalLoading && (
                      <div className="bg-slate-900/50 rounded-lg p-6 mt-4">
                        <div className="flex items-center justify-center gap-3">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400"></div>
                          <p className="text-slate-400">Loading detailed signals...</p>
                        </div>
                      </div>
                    )}
                    
                    {signalError && (
                      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mt-4">
                        <p className="text-red-400 text-sm">⚠️ {signalError}</p>
                      </div>
                    )}
                    
                    {signalData && !signalLoading && (
                      <div className="mt-6 space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="h-1 flex-1 bg-gradient-to-r from-purple-500/20 to-transparent rounded"></div>
                          <h3 className="text-lg font-bold text-white">Detailed Signals</h3>
                          <div className="h-1 flex-1 bg-gradient-to-l from-purple-500/20 to-transparent rounded"></div>
                        </div>
                        
                        {/* Volume Signal */}
                        {signalData.volume && (
                          <div className="bg-gradient-to-br from-orange-900/20 to-slate-900/50 border border-orange-500/30 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">📊</span>
                                <div>
                                  <h4 className="text-white font-bold">Volume Surge</h4>
                                  <p className="text-xs text-slate-400">Unusual trading activity detected</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-orange-400">
                                  {signalData.volume.volume_surge_percentage?.toFixed(1)}%
                                </div>
                                <div className="text-xs text-slate-400">Surge</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-3">
                              <div className="bg-slate-800/50 rounded p-2">
                                <div className="text-xs text-slate-400">Current Vol</div>
                                <div className="text-sm font-bold text-white">
                                  ${(signalData.volume.current_volume_usd / 1_000_000).toFixed(2)}M
                                </div>
                              </div>
                              <div className="bg-slate-800/50 rounded p-2">
                                <div className="text-xs text-slate-400">Avg Vol</div>
                                <div className="text-sm font-bold text-slate-300">
                                  ${(signalData.volume.avg_volume_usd / 1_000_000).toFixed(2)}M
                                </div>
                              </div>
                              <div className="bg-slate-800/50 rounded p-2">
                                <div className="text-xs text-slate-400">Signal</div>
                                <div className={`text-sm font-bold ${
                                  signalData.volume.signal === 'VERY_STRONG' ? 'text-green-400' :
                                  signalData.volume.signal === 'STRONG' ? 'text-cyan-400' :
                                  signalData.volume.signal === 'MEDIUM' ? 'text-yellow-400' :
                                  'text-slate-400'
                                }`}>
                                  {signalData.volume.signal}
                                </div>
                              </div>
                            </div>
                            {signalData.volume.reason && (
                              <p className="text-xs text-slate-300 mt-3 p-2 bg-slate-800/30 rounded">
                                {signalData.volume.reason}
                              </p>
                            )}
                          </div>
                        )}
                        
                        {/* Breakout Signal */}
                        {signalData.breakout && (
                          <div className="bg-gradient-to-br from-green-900/20 to-slate-900/50 border border-green-500/30 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">🚀</span>
                                <div>
                                  <h4 className="text-white font-bold">Breakout Signal</h4>
                                  <p className="text-xs text-slate-400">Price breaking key resistance</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-green-400">
                                  {signalData.breakout.breakout_score?.toFixed(1)}
                                </div>
                                <div className="text-xs text-slate-400">Score</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-3">
                              <div className="bg-slate-800/50 rounded p-2">
                                <div className="text-xs text-slate-400">Price</div>
                                <div className="text-sm font-bold text-white">
                                  ${signalData.breakout.current_price?.toFixed(4)}
                                </div>
                              </div>
                              <div className="bg-slate-800/50 rounded p-2">
                                <div className="text-xs text-slate-400">Change</div>
                                <div className={`text-sm font-bold ${
                                  signalData.breakout.price_change_24h > 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {signalData.breakout.price_change_24h > 0 ? '+' : ''}
                                  {signalData.breakout.price_change_24h?.toFixed(2)}%
                                </div>
                              </div>
                              <div className="bg-slate-800/50 rounded p-2">
                                <div className="text-xs text-slate-400">Direction</div>
                                <div className="text-sm font-bold text-cyan-400">
                                  {signalData.breakout.direction || 'LONG'}
                                </div>
                              </div>
                            </div>
                            {signalData.breakout.reason && (
                              <p className="text-xs text-slate-300 mt-3 p-2 bg-slate-800/30 rounded">
                                {signalData.breakout.reason}
                              </p>
                            )}
                          </div>
                        )}
                        
                        {/* Funding Divergence Signal */}
                        {signalData.funding && (
                          <div className="bg-gradient-to-br from-yellow-900/20 to-slate-900/50 border border-yellow-500/30 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">⚡</span>
                                <div>
                                  <h4 className="text-white font-bold">Funding Divergence</h4>
                                  <p className="text-xs text-slate-400">Funding rate imbalance</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-yellow-400">
                                  {signalData.funding.divergence_score?.toFixed(1)}
                                </div>
                                <div className="text-xs text-slate-400">Score</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-3">
                              <div className="bg-slate-800/50 rounded p-2">
                                <div className="text-xs text-slate-400">Binance Rate</div>
                                <div className="text-sm font-bold text-white">
                                  {(signalData.funding.binance_funding_rate * 100)?.toFixed(4)}%
                                </div>
                              </div>
                              <div className="bg-slate-800/50 rounded p-2">
                                <div className="text-xs text-slate-400">Other Rate</div>
                                <div className="text-sm font-bold text-slate-300">
                                  {(signalData.funding.other_funding_rate * 100)?.toFixed(4)}%
                                </div>
                              </div>
                              <div className="bg-slate-800/50 rounded p-2">
                                <div className="text-xs text-slate-400">Diff</div>
                                <div className="text-sm font-bold text-yellow-400">
                                  {(signalData.funding.divergence_percentage)?.toFixed(2)}%
                                </div>
                              </div>
                            </div>
                            {signalData.funding.reason && (
                              <p className="text-xs text-slate-300 mt-3 p-2 bg-slate-800/30 rounded">
                                {signalData.funding.reason}
                              </p>
                            )}
                          </div>
                        )}
                        
                        {/* No signals found */}
                        {!signalData.volume && !signalData.breakout && !signalData.funding && (
                          <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-6 text-center">
                            <div className="text-4xl mb-2">🔍</div>
                            <p className="text-slate-400">No detailed signals available for this symbol</p>
                            <p className="text-xs text-slate-500 mt-1">
                              The composite score is calculated from aggregated data
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Trading Links */}
                    <div className="flex gap-3 mt-6">
                      <Link 
                        href={`/trading?symbol=${mover.symbol}&market=spot`}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-lg transition text-center"
                      >
                        Trade Spot
                      </Link>
                      <Link 
                        href={`/trading?symbol=${mover.symbol}&market=futures`}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold rounded-lg transition text-center"
                      >
                        Trade Futures
                      </Link>
                    </div>
                  </div>
                )}
                
                {/* Symbol Header for non-mover symbols */}
                {!mover && (
                  <div className="rounded-xl p-6 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-bold text-white">{selectedSymbol}</h3>
                        <p className="text-sm text-slate-400 mt-1">Real-time Signal Analysis</p>
                      </div>
                      <Link 
                        href={`/trading?symbol=${selectedSymbol}`}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition"
                      >
                        Trade Now →
                      </Link>
                    </div>
                  </div>
                )}
                
                {/* Signal Details Section - ALWAYS SHOW for selected symbol */}
                {signalLoading && (
                  <div className="bg-slate-900/50 rounded-lg p-6 mt-4 border border-slate-700">
                    <div className="flex items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400"></div>
                      <p className="text-slate-400">Loading detailed signals...</p>
                    </div>
                  </div>
                )}
                
                {signalError && (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mt-4">
                    <p className="text-red-400 text-sm">⚠️ {signalError}</p>
                  </div>
                )}
                
                {signalData && !signalLoading && (
                                     <div className="mt-6 space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-1 flex-1 bg-gradient-to-r from-purple-500/20 to-transparent rounded"></div>
                      <h3 className="text-lg font-bold text-white">Detailed Signals</h3>
                      <div className="h-1 flex-1 bg-gradient-to-l from-purple-500/20 to-transparent rounded"></div>
                    </div>
                    
                    {/* Volume Signal */}
                    {signalData.volume && (
                      <div className="bg-gradient-to-br from-orange-900/20 to-slate-900/50 border border-orange-500/30 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">📊</span>
                            <div>
                              <h4 className="text-white font-bold">Volume Surge</h4>
                              <p className="text-xs text-slate-400">Unusual trading activity detected</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-orange-400">
                              {signalData.volume.volume_surge_percentage?.toFixed(1)}%
                            </div>
                            <div className="text-xs text-slate-400">Surge</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-3">
                          <div className="bg-slate-800/50 rounded p-2">
                            <div className="text-xs text-slate-400">Current Vol</div>
                            <div className="text-sm font-bold text-white">
                              ${(signalData.volume.current_volume_usd / 1_000_000).toFixed(2)}M
                            </div>
                          </div>
                          <div className="bg-slate-800/50 rounded p-2">
                            <div className="text-xs text-slate-400">Avg Vol</div>
                            <div className="text-sm font-bold text-slate-300">
                              ${(signalData.volume.avg_volume_usd / 1_000_000).toFixed(2)}M
                            </div>
                          </div>
                          <div className="bg-slate-800/50 rounded p-2">
                            <div className="text-xs text-slate-400">Signal</div>
                            <div className={`text-sm font-bold ${
                              signalData.volume.signal === 'VERY_STRONG' ? 'text-green-400' :
                              signalData.volume.signal === 'STRONG' ? 'text-cyan-400' :
                              signalData.volume.signal === 'MEDIUM' ? 'text-yellow-400' :
                              'text-slate-400'
                            }`}>
                              {signalData.volume.signal}
                            </div>
                          </div>
                        </div>
                        {signalData.volume.reason && (
                          <p className="text-xs text-slate-300 mt-3 p-2 bg-slate-800/30 rounded">
                            {signalData.volume.reason}
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Breakout Signal */}
                    {signalData.breakout && (
                      <div className="bg-gradient-to-br from-green-900/20 to-slate-900/50 border border-green-500/30 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">🚀</span>
                            <div>
                              <h4 className="text-white font-bold">Breakout Signal</h4>
                              <p className="text-xs text-slate-400">Price breaking key levels</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-400">
                              {signalData.breakout.breakout_score?.toFixed(1)}
                            </div>
                            <div className="text-xs text-slate-400">Score</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-3">
                          <div className="bg-slate-800/50 rounded p-2">
                            <div className="text-xs text-slate-400">Price</div>
                            <div className="text-sm font-bold text-white">
                              ${signalData.breakout.current_price?.toFixed(2)}
                            </div>
                          </div>
                          <div className="bg-slate-800/50 rounded p-2">
                            <div className="text-xs text-slate-400">24h Change</div>
                            <div className={`text-sm font-bold ${
                              signalData.breakout.price_change_24h > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {signalData.breakout.price_change_24h > 0 ? '+' : ''}
                              {signalData.breakout.price_change_24h?.toFixed(2)}%
                            </div>
                          </div>
                          <div className="bg-slate-800/50 rounded p-2">
                            <div className="text-xs text-slate-400">Direction</div>
                            <div className={`text-sm font-bold ${
                              signalData.breakout.direction === 'LONG' ? 'text-green-400' :
                              signalData.breakout.direction === 'SHORT' ? 'text-red-400' :
                              'text-slate-400'
                            }`}>
                              {signalData.breakout.direction}
                            </div>
                          </div>
                        </div>
                        {signalData.breakout.reason && (
                          <p className="text-xs text-slate-300 mt-3 p-2 bg-slate-800/30 rounded">
                            {signalData.breakout.reason}
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Funding Divergence Signal */}
                    {signalData.funding && (
                      <div className="bg-gradient-to-br from-yellow-900/20 to-slate-900/50 border border-yellow-500/30 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">⚡</span>
                            <div>
                              <h4 className="text-white font-bold">Funding Divergence</h4>
                              <p className="text-xs text-slate-400">Funding rate analysis</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-yellow-400">
                              {signalData.funding.divergence_score?.toFixed(1)}
                            </div>
                            <div className="text-xs text-slate-400">Score</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-3">
                          <div className="bg-slate-800/50 rounded p-2">
                            <div className="text-xs text-slate-400">Funding Rate</div>
                            <div className={`text-sm font-bold ${
                              signalData.funding.binance_funding_rate > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {(signalData.funding.binance_funding_rate * 100)?.toFixed(4)}%
                            </div>
                          </div>
                          <div className="bg-slate-800/50 rounded p-2">
                            <div className="text-xs text-slate-400">Divergence</div>
                            <div className="text-sm font-bold text-yellow-400">
                              {signalData.funding.divergence_percentage?.toFixed(4)}%
                            </div>
                          </div>
                          <div className="bg-slate-800/50 rounded p-2">
                            <div className="text-xs text-slate-400">Open Interest</div>
                            <div className="text-sm font-bold text-white">
                              {signalData.funding.open_interest ? 
                                (signalData.funding.open_interest / 1000).toFixed(0) + 'K' : 
                                'N/A'
                              }
                            </div>
                          </div>
                        </div>
                        {signalData.funding.reason && (
                          <p className="text-xs text-slate-300 mt-3 p-2 bg-slate-800/30 rounded">
                            {signalData.funding.reason}
                          </p>
                        )}
                      </div>
                    )}
                    
                    
                    {/* No signals */}
                    {!signalData.volume && !signalData.breakout && !signalData.funding && (
                      <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-6 text-center">
                        <div className="text-4xl mb-2">🔍</div>
                        <p className="text-slate-400">No signals currently active for this symbol</p>
                        <p className="text-xs text-slate-500 mt-1">Check back later or try another pair</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      ) : movers.length > 0 ? (
        // Overview: Show all movers
        <div className="space-y-4">
          {movers.map((mover, index) => (
            <div
              key={mover.symbol}
              className="rounded-xl p-5 border-2 transition-all hover:border-purple-500/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 cursor-pointer"
              onClick={() => setSelectedSymbol(mover.symbol)}
              style={{
                borderImage: `linear-gradient(135deg, from-slate-500 to-slate-600) 1`
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold text-lg">
                    #{index + 1}
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white flex items-center gap-2">
                      {mover.base}
                      <span className="text-xs px-3 py-1 rounded-full font-semibold border bg-slate-500/30 text-slate-300 border-slate-400/70">
                        {mover.signal}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">
                        {mover.signal_count} signal{mover.signal_count > 1 ? 's' : ''} active
                      </span>
                      {mover.market_cap && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="text-xs font-semibold text-slate-400">
                            {formatMarketCap(mover.market_cap)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    {mover.composite_score.toFixed(0)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Composite</div>
                </div>
              </div>

              <p className="text-sm text-slate-300 mb-4 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                {mover.reason}
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                {mover.active_signals.map((sig, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  >
                    {sig}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Volume</div>
                  <div className="text-lg font-bold text-orange-400">
                    {mover.breakdown.volume_contribution.toFixed(1)}
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Breakout</div>
                  <div className="text-lg font-bold text-cyan-400">
                    {mover.breakdown.breakout_contribution.toFixed(1)}
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Funding</div>
                  <div className="text-lg font-bold text-pink-400">
                    {mover.breakdown.funding_contribution.toFixed(1)}
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Momentum</div>
                  <div className={`text-lg font-bold ${
                    mover.price_change_24h > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {mover.breakdown.momentum_contribution.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Info Footer */}
      <div className="mt-6 pt-4 border-t border-slate-700/50">
        <div className="text-xs text-slate-500 space-y-1">
          <p>💎 <strong>Signal Weighting:</strong> Volume (30%) + Breakouts (30%) + Funding (20%) + Momentum (20%)</p>
          <p>🎯 <strong>Score 90+:</strong> Ultimate signals - all scanners aligned</p>
          <p>⚡ <strong>Score 80+:</strong> Excellent opportunities - multiple confirmations</p>
          <p>✨ <strong>Score 70+:</strong> Strong signals - good probability</p>
        </div>
      </div>
    </div>
  )
}
