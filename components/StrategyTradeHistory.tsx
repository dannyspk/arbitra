'use client'

import React from 'react'

interface StrategyTrade {
  symbol: string
  strategy_type: string
  exchange: string
  side: string
  order_type: string
  quantity: number
  entry_price: number
  exit_price?: number
  order_id?: string
  status: string
  fee?: number
  fee_currency?: string
  pnl?: number
  pnl_pct?: number
  timestamp: string
}

interface TradeHistoryStats {
  total_trades: number
  total_pnl: number
  total_fees: number
  winning_trades: number
  losing_trades: number
  win_rate: number
  symbols_traded: string[]
  net_pnl: number
}

interface TradeHistoryData {
  trades: StrategyTrade[]
  statistics: TradeHistoryStats
}

function formatPrice(price?: number) {
  if (price === undefined || price === null) return '--'
  return `$${price.toFixed(4)}`
}

function formatPercent(pct?: number) {
  if (pct === undefined || pct === null) return '--'
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

function formatDateTime(ts: string) {
  if (!ts) return '--'
  return new Date(ts).toLocaleString()
}

function formatSide(side: string) {
  const lower = side.toLowerCase()
  if (lower === 'long' || lower === 'buy') {
    return { text: 'LONG', color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30' }
  } else {
    return { text: 'SHORT', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' }
  }
}

export default function StrategyTradeHistory() {
  const [data, setData] = React.useState<TradeHistoryData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedSymbol, setSelectedSymbol] = React.useState<string>('all')
  const [activeTab, setActiveTab] = React.useState<'all' | 'closed' | 'stats'>('all')

  const fetchTradeHistory = React.useCallback(async (symbol?: string) => {
    try {
      setLoading(true)
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      const url = symbol && symbol !== 'all' 
        ? `${backend}/api/strategy/trade-history?symbol=${symbol}&limit=200`
        : `${backend}/api/strategy/trade-history?limit=200`
      
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: TradeHistoryData = await res.json()
      setData(json)
      setError(null)
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchTradeHistory(selectedSymbol === 'all' ? undefined : selectedSymbol)
    
    // Refresh every 10 seconds
    const interval = setInterval(() => {
      fetchTradeHistory(selectedSymbol === 'all' ? undefined : selectedSymbol)
    }, 10000)
    
    return () => clearInterval(interval)
  }, [selectedSymbol, fetchTradeHistory])

  const closedTrades = data?.trades.filter(t => t.exit_price && t.pnl !== null && t.pnl !== undefined) || []
  const openTrades = data?.trades.filter(t => !t.exit_price || t.pnl === null || t.pnl === undefined) || []
  
  const displayTrades = activeTab === 'all' ? (data?.trades || []) : closedTrades

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-400">Loading trade history...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <p className="text-red-400">Error loading trade history: {error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Strategy Trade History</h1>
          <p className="text-slate-400 text-sm">Complete record of all executed trades from persisted database</p>
        </div>
          
          {/* Symbol Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs sm:text-sm text-slate-400 whitespace-nowrap">Filter by Symbol:</label>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Symbols</option>
              {data?.statistics.symbols_traded.map(symbol => (
                <option key={symbol} value={symbol}>{symbol}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Statistics Cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
              <div className="text-sm text-slate-400 mb-1">Total Trades</div>
              <div className="text-2xl font-bold text-white">{data.statistics.total_trades}</div>
            </div>
            
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
              <div className="text-sm text-slate-400 mb-1">Win Rate</div>
              <div className={`text-2xl font-bold ${data.statistics.win_rate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                {data.statistics.win_rate.toFixed(1)}%
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {data.statistics.winning_trades}W / {data.statistics.losing_trades}L
              </div>
            </div>
            
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
              <div className="text-sm text-slate-400 mb-1">Total P&L</div>
              <div className={`text-2xl font-bold ${data.statistics.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatPrice(data.statistics.total_pnl)}
              </div>
            </div>
            
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
              <div className="text-sm text-slate-400 mb-1">Net P&L (after fees)</div>
              <div className={`text-2xl font-bold ${data.statistics.net_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatPrice(data.statistics.net_pnl)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Fees: {formatPrice(data.statistics.total_fees)}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700/50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 sm:px-6 py-3 font-semibold transition-all whitespace-nowrap text-sm ${
              activeTab === 'all'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Trades ({data?.trades.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('closed')}
            className={`px-4 sm:px-6 py-3 font-semibold transition-all whitespace-nowrap text-sm ${
              activeTab === 'closed'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Closed Only ({closedTrades.length})
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 sm:px-6 py-3 font-semibold transition-all whitespace-nowrap text-sm ${
              activeTab === 'stats'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Statistics
          </button>
        </div>

        {/* Trade Table */}
        {(activeTab === 'all' || activeTab === 'closed') && (
          <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 overflow-hidden -mx-4 sm:mx-0">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead className="bg-slate-800/70 text-slate-300 sticky top-0 border-b border-slate-700/50">
                  <tr>
                    <th className="px-2 sm:px-4 py-3 text-left font-semibold uppercase tracking-wider text-xs whitespace-nowrap">Time</th>
                    <th className="px-2 sm:px-4 py-3 text-left font-semibold uppercase tracking-wider text-xs whitespace-nowrap">Symbol</th>
                    <th className="px-2 sm:px-4 py-3 text-left font-semibold uppercase tracking-wider text-xs whitespace-nowrap">Strategy</th>
                    <th className="px-2 sm:px-4 py-3 text-left font-semibold uppercase tracking-wider text-xs whitespace-nowrap">Side</th>
                    <th className="px-2 sm:px-4 py-3 text-right font-semibold uppercase tracking-wider text-xs whitespace-nowrap">Qty</th>
                    <th className="px-2 sm:px-4 py-3 text-right font-semibold uppercase tracking-wider text-xs whitespace-nowrap">Entry</th>
                    <th className="px-2 sm:px-4 py-3 text-right font-semibold uppercase tracking-wider text-xs whitespace-nowrap">Exit</th>
                    <th className="px-2 sm:px-4 py-3 text-right font-semibold uppercase tracking-wider text-xs whitespace-nowrap">P&L $</th>
                    <th className="px-2 sm:px-4 py-3 text-right font-semibold uppercase tracking-wider text-xs whitespace-nowrap">P&L %</th>
                    <th className="px-2 sm:px-4 py-3 text-left font-semibold uppercase tracking-wider text-xs whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {displayTrades.map((trade, i) => {
                    const sideStyle = formatSide(trade.side)
                    const isProfitable = (trade.pnl || 0) >= 0
                    const isClosed = trade.exit_price && trade.pnl !== null && trade.pnl !== undefined
                    
                    return (
                      <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                        <td className="px-2 sm:px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {new Date(trade.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-2 sm:px-4 py-3 font-bold text-white text-xs sm:text-sm whitespace-nowrap">{trade.symbol}</td>
                        <td className="px-2 sm:px-4 py-3 text-slate-300">
                          <span className="px-1.5 sm:px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold border border-blue-500/30 whitespace-nowrap">
                            {trade.strategy_type.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-3">
                          <span className={`inline-block px-1.5 sm:px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${sideStyle.bg} ${sideStyle.color} border ${sideStyle.border}`}>
                            {sideStyle.text}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-right font-mono text-slate-300 text-xs whitespace-nowrap">{trade.quantity.toFixed(4)}</td>
                        <td className="px-2 sm:px-4 py-3 text-right font-mono text-slate-300 text-xs whitespace-nowrap">{formatPrice(trade.entry_price)}</td>
                        <td className="px-2 sm:px-4 py-3 text-right font-mono text-slate-300 text-xs whitespace-nowrap">
                          {trade.exit_price ? formatPrice(trade.exit_price) : 
                            <span className="text-yellow-400 text-xs">OPEN</span>
                          }
                        </td>
                        <td className={`px-2 sm:px-4 py-3 text-right font-mono font-semibold text-xs whitespace-nowrap ${
                          isClosed ? (isProfitable ? 'text-green-400' : 'text-red-400') : 'text-slate-500'
                        }`}>
                          {trade.pnl !== null && trade.pnl !== undefined ? formatPrice(trade.pnl) : '--'}
                        </td>
                        <td className={`px-2 sm:px-4 py-3 text-right font-mono font-semibold text-xs whitespace-nowrap ${
                          isClosed ? (isProfitable ? 'text-green-400' : 'text-red-400') : 'text-slate-500'
                        }`}>
                          {trade.pnl_pct !== null && trade.pnl_pct !== undefined ? formatPercent(trade.pnl_pct) : '--'}
                        </td>
                        <td className="px-2 sm:px-4 py-3">
                          <span className={`text-xs px-1.5 sm:px-2 py-1 rounded whitespace-nowrap ${
                            trade.status === 'FILLED' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {trade.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              
              {displayTrades.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  No trades found
                </div>
              )}
            </div>
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === 'stats' && data && (
          <div className="space-y-6">
            <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-6">
              <h3 className="text-xl font-bold text-white mb-4">Detailed Statistics</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Trade Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Trades:</span>
                      <span className="text-white font-semibold">{data.statistics.total_trades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Winning Trades:</span>
                      <span className="text-green-400 font-semibold">{data.statistics.winning_trades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Losing Trades:</span>
                      <span className="text-red-400 font-semibold">{data.statistics.losing_trades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Win Rate:</span>
                      <span className={`font-semibold ${data.statistics.win_rate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                        {data.statistics.win_rate.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Financial Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total P&L:</span>
                      <span className={`font-semibold ${data.statistics.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPrice(data.statistics.total_pnl)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Fees:</span>
                      <span className="text-orange-400 font-semibold">{formatPrice(data.statistics.total_fees)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Net P&L:</span>
                      <span className={`font-semibold ${data.statistics.net_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPrice(data.statistics.net_pnl)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Average P&L:</span>
                      <span className={`font-semibold ${
                        (data.statistics.total_pnl / Math.max(closedTrades.length, 1)) >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formatPrice(data.statistics.total_pnl / Math.max(closedTrades.length, 1))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Symbols Traded</h4>
                <div className="flex flex-wrap gap-2">
                  {data.statistics.symbols_traded.map(symbol => (
                    <span key={symbol} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-semibold border border-blue-500/30">
                      {symbol}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

