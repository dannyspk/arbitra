'use client'

import React from 'react'
import Link from 'next/link'

interface ReversalSignal {
  score: number
  rsi: number
  dist_from_ma20_pct: number
  dist_from_ma50_pct: number
  position_in_range: number
  volume_ratio: number
  recommendation: string
  reasons: string[]
}

interface ReversalData {
  symbol: string
  bottom_signal: ReversalSignal | null
  top_signal: ReversalSignal | null
  timestamp: number
}

interface ReversalResponse {
  success: boolean
  data: ReversalData
}

export default function ReversalDetection() {
  const [reversal, setReversal] = React.useState<ReversalData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = React.useState<number>(0)
  const [autoRefresh, setAutoRefresh] = React.useState(false)
  const [signalType, setSignalType] = React.useState<'bottom' | 'top' | 'both'>('both')
  const [selectedSymbol, setSelectedSymbol] = React.useState<string | null>(null)
  
  // All Binance symbols for search
  const [allBinanceSymbols, setAllBinanceSymbols] = React.useState<string[]>([])
  const [searchTerm, setSearchTerm] = React.useState('')
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false)
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Fetch all Binance Futures symbols on mount
  React.useEffect(() => {
    const fetchBinanceSymbols = async () => {
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
        // Fallback to a basic list
        setAllBinanceSymbols(['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','SOLUSDT','ADAUSDT'])
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

  const fetchReversalForSymbol = async (sym: string) => {
    try {
      setLoading(true)
      setError(null)
      setReversal(null)
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      const response = await fetch(`${backend}/api/reversal-detection/${encodeURIComponent(sym)}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data: ReversalResponse = await response.json()
      
      console.log('Reversal API response:', data) // Debug log
      
      if (data.success && data.data) {
        setReversal(data.data)
        setLastUpdate(Date.now())
        setError(null) // Clear any previous errors
      } else {
        setError('No reversal signals found for this symbol')
      }
    } catch (err: any) {
      console.error('Error fetching reversal for symbol:', err)
      setError(err.message || 'Failed to load reversal data')
    } finally {
      setLoading(false)
    }
  }

  // Load reversal data when symbol is selected
  React.useEffect(() => {
    if (selectedSymbol) {
      fetchReversalForSymbol(selectedSymbol)
    } else {
      setReversal(null)
      setError(null)
    }
  }, [selectedSymbol])

  // Auto-refresh
  React.useEffect(() => {
    if (autoRefresh && selectedSymbol) {
      const interval = setInterval(() => fetchReversalForSymbol(selectedSymbol), 10 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, selectedSymbol])

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
        setHighlightedIndex(prev => Math.min(prev + 1, filteredSymbols.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && filteredSymbols[highlightedIndex]) {
          setSelectedSymbol(filteredSymbols[highlightedIndex])
          setIsDropdownOpen(false)
          setSearchTerm('')
          setHighlightedIndex(-1)
        }
        break
      case 'Escape':
        setIsDropdownOpen(false)
        setSearchTerm('')
        setHighlightedIndex(-1)
        break
    }
  }

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  if (loading && !reversal) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
          <p className="text-slate-400">Fetching reversal data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="text-red-400 text-4xl">⚠️</div>
          <p className="text-slate-300">Failed to load reversal signals</p>
          <p className="text-sm text-slate-500">{error}</p>
          <button
            onClick={() => selectedSymbol && fetchReversalForSymbol(selectedSymbol)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
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
            🔄 Reversal Detection
            <span className="text-xs font-normal text-slate-400 ml-2">
              (Bottom & Top Signals)
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            RSI + Moving Averages + Volume Analysis + Price Patterns
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Symbol Search Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder={selectedSymbol || "Search symbol (e.g., BTCUSDT)"}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setIsDropdownOpen(true)
                  setHighlightedIndex(-1)
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={handleKeyDown}
                className="px-3 py-1.5 bg-slate-800/50 text-white rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/50 min-w-[200px]"
              />
              {selectedSymbol && (
                <button
                  onClick={() => {
                    setSelectedSymbol(null)
                    setSearchTerm('')
                  }}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
            
            {isDropdownOpen && filteredSymbols.length > 0 && (
              <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
                {filteredSymbols.map((symbol, idx) => (
                  <div
                    key={symbol}
                    onClick={() => {
                      setSelectedSymbol(symbol)
                      setIsDropdownOpen(false)
                      setSearchTerm('')
                      setHighlightedIndex(-1)
                    }}
                    className={`px-3 py-2 cursor-pointer text-sm ${
                      idx === highlightedIndex
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    {symbol}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Signal Type Filter */}
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-1.5">
            <span className="text-xs text-slate-400">Type:</span>
            <select
              value={signalType}
              onChange={(e) => setSignalType(e.target.value as 'bottom' | 'top' | 'both')}
              className="bg-slate-700 text-white text-xs rounded px-2 py-1 outline-none"
            >
              <option value="both">Both</option>
              <option value="bottom">Bottoms Only</option>
              <option value="top">Tops Only</option>
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
        </div>
      </div>

      {/* Last Update */}
      {lastUpdate > 0 && (
        <div className="text-xs text-slate-500 mb-4">
          Last updated: {formatTimeAgo(lastUpdate)}
        </div>
      )}

      {/* No Results */}
      {!reversal && !loading && !error && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-slate-400">Search for a symbol to analyze</p>
          <p className="text-sm text-slate-500 mt-2">Select a symbol from the dropdown to view reversal signals</p>
        </div>
      )}

      {/* Results Grid */}
      {reversal && (
        <div className="space-y-4">
          <div className="space-y-4">
            {/* Bottom Signal */}
            {reversal.bottom_signal && (signalType === 'both' || signalType === 'bottom') && (
              <div className="bg-gradient-to-br from-blue-900/20 to-slate-900/50 border border-blue-500/30 rounded-lg p-5 hover:border-blue-500/50 transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-bold text-lg">
                      📉
                    </div>
                    <div>
                      <Link 
                        href={`/trading?symbol=${reversal.symbol}`}
                        className="text-2xl font-bold text-white hover:text-blue-400 transition"
                      >
                        {reversal.symbol.replace('USDT', '')}
                      </Link>
                      <p className="text-xs text-slate-400 mt-1">Potential BOTTOM - Buy Opportunity</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold text-blue-400">
                      {reversal.bottom_signal.score.toFixed(0)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Score</div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">RSI</div>
                    <div className={`text-lg font-bold ${
                      reversal.bottom_signal.rsi < 30 ? 'text-green-400' :
                      reversal.bottom_signal.rsi < 40 ? 'text-yellow-400' :
                      'text-slate-400'
                    }`}>
                      {reversal.bottom_signal.rsi.toFixed(1)}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">vs 20 MA</div>
                    <div className={`text-lg font-bold ${
                      reversal.bottom_signal.dist_from_ma20_pct < -10 ? 'text-green-400' :
                      reversal.bottom_signal.dist_from_ma20_pct < 0 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {reversal.bottom_signal.dist_from_ma20_pct.toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Range Pos</div>
                    <div className="text-lg font-bold text-white">
                      {reversal.bottom_signal.position_in_range.toFixed(0)}%
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Volume</div>
                    <div className="text-lg font-bold text-cyan-400">
                      {reversal.bottom_signal.volume_ratio.toFixed(1)}x
                    </div>
                  </div>
                </div>

                {/* Recommendation */}
                <div className={`p-3 rounded-lg mb-3 ${
                  reversal.bottom_signal.score >= 60 
                    ? 'bg-green-900/30 border border-green-500/30' 
                    : 'bg-blue-900/30 border border-blue-500/30'
                }`}>
                  <p className={`text-sm font-semibold ${
                    reversal.bottom_signal.score >= 60 ? 'text-green-300' : 'text-blue-300'
                  }`}>
                    💡 {reversal.bottom_signal.recommendation}
                  </p>
                </div>

                {/* Reasons */}
                <div className="space-y-1">
                  <div className="text-xs text-slate-400 mb-2">Key Indicators:</div>
                  {reversal.bottom_signal.reasons.map((reason, idx) => (
                    <div key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-blue-400">•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Signal */}
            {reversal.top_signal && (signalType === 'both' || signalType === 'top') && (
              <div className="bg-gradient-to-br from-red-900/20 to-slate-900/50 border border-red-500/30 rounded-lg p-5 hover:border-red-500/50 transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-500 text-white font-bold text-lg">
                      📈
                    </div>
                    <div>
                      <Link 
                        href={`/trading?symbol=${reversal.symbol}`}
                        className="text-2xl font-bold text-white hover:text-red-400 transition"
                      >
                        {reversal.symbol.replace('USDT', '')}
                      </Link>
                      <p className="text-xs text-slate-400 mt-1">Potential TOP - Sell Warning</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold text-red-400">
                      {reversal.top_signal.score.toFixed(0)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Score</div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">RSI</div>
                    <div className={`text-lg font-bold ${
                      reversal.top_signal.rsi > 70 ? 'text-red-400' :
                      reversal.top_signal.rsi > 60 ? 'text-yellow-400' :
                      'text-slate-400'
                    }`}>
                      {reversal.top_signal.rsi.toFixed(1)}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">vs 20 MA</div>
                    <div className={`text-lg font-bold ${
                      reversal.top_signal.dist_from_ma20_pct > 10 ? 'text-red-400' :
                      reversal.top_signal.dist_from_ma20_pct > 0 ? 'text-yellow-400' :
                      'text-green-400'
                    }`}>
                      +{reversal.top_signal.dist_from_ma20_pct.toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Range Pos</div>
                    <div className="text-lg font-bold text-white">
                      {reversal.top_signal.position_in_range.toFixed(0)}%
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Volume</div>
                    <div className="text-lg font-bold text-cyan-400">
                      {reversal.top_signal.volume_ratio.toFixed(1)}x
                    </div>
                  </div>
                </div>

                {/* Recommendation */}
                <div className={`p-3 rounded-lg mb-3 ${
                  reversal.top_signal.score >= 60 
                    ? 'bg-red-900/30 border border-red-500/30' 
                    : 'bg-orange-900/30 border border-orange-500/30'
                }`}>
                  <p className={`text-sm font-semibold ${
                    reversal.top_signal.score >= 60 ? 'text-red-300' : 'text-orange-300'
                  }`}>
                    ⚠️ {reversal.top_signal.recommendation}
                  </p>
                </div>

                {/* Reasons */}
                <div className="space-y-1">
                  <div className="text-xs text-slate-400 mb-2">Key Indicators:</div>
                  {reversal.top_signal.reasons.map((reason, idx) => (
                    <div key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-red-400">•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className="mt-6 pt-4 border-t border-slate-700/50">
        <div className="text-xs text-slate-500 space-y-1">
          <p>📊 <strong>Bottom Signal:</strong> RSI {'<'} 40 + Below 20MA + Low range position + High volume</p>
          <p>📈 <strong>Top Signal:</strong> RSI {'>'} 60 + Above 20MA + High range position + Volume exhaustion</p>
          <p>⚡ <strong>Score 60+:</strong> Strong reversal probability - High confidence</p>
          <p>✨ <strong>Score 40-60:</strong> Moderate reversal signal - Watch for confirmation</p>
        </div>
      </div>
    </div>
  )
}
