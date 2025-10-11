'use client'

import { useEffect } from 'react'

interface StrategyTrade {
  id: number
  symbol: string
  strategy_type: string
  side: 'LONG' | 'SHORT'
  quantity: number
  entry_price: number
  entry_time: string
  exit_price: number | null
  exit_time: string | null
  pnl: number | null
  pnl_pct: number | null
  fees: number
  status: 'OPEN' | 'CLOSED'
}

interface StrategyTradeHistoryData {
  trades: StrategyTrade[]
  statistics: {
    total_trades: number
    winning_trades: number
    losing_trades: number
    win_rate: number
    total_pnl: number
    net_pnl: number
    total_fees: number
  }
}

interface Props {
  strategyTrades: StrategyTradeHistoryData | null
  strategyTradesLoading: boolean
  strategyTradeSymbolFilter: string
  setStrategyTradeSymbolFilter: (filter: string) => void
  strategyTradeTab: 'all' | 'closed' | 'stats'
  setStrategyTradeTab: (tab: 'all' | 'closed' | 'stats') => void
  setStrategyTrades: (data: StrategyTradeHistoryData | null) => void
  setStrategyTradesLoading: (loading: boolean) => void
}

export default function StrategyTradeHistorySection({
  strategyTrades,
  strategyTradesLoading,
  strategyTradeSymbolFilter,
  setStrategyTradeSymbolFilter,
  strategyTradeTab,
  setStrategyTradeTab,
  setStrategyTrades,
  setStrategyTradesLoading
}: Props) {

  // Fetch strategy trades from API
  useEffect(() => {
    const fetchStrategyTrades = async () => {
      setStrategyTradesLoading(true)
      try {
        const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
        const url = strategyTradeSymbolFilter
          ? `${backend}/api/strategy/trade-history?symbol=${strategyTradeSymbolFilter}&limit=200`
          : `${backend}/api/strategy/trade-history?limit=200`
        
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setStrategyTrades(data)
        }
      } catch (error) {
        console.error('Failed to fetch strategy trades:', error)
      } finally {
        setStrategyTradesLoading(false)
      }
    }

    fetchStrategyTrades()
    // Refresh every 30 seconds
    const interval = setInterval(fetchStrategyTrades, 30000)
    return () => clearInterval(interval)
  }, [strategyTradeSymbolFilter, setStrategyTrades, setStrategyTradesLoading])

  // Get unique symbols for filter dropdown
  const uniqueSymbols = strategyTrades?.trades
    ? Array.from(new Set(strategyTrades.trades.map(t => t.symbol))).sort()
    : []

  // Filter trades based on current tab
  const filteredTrades = strategyTrades?.trades.filter(trade => {
    if (strategyTradeTab === 'closed') {
      return trade.status === 'CLOSED'
    }
    return true
  }) || []

  // Format timestamp
  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '-'
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <>
      {/* Header with Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white">Strategy Order History</h2>
        
        {/* Symbol Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Symbol:</label>
          <select
            value={strategyTradeSymbolFilter}
            onChange={(e) => setStrategyTradeSymbolFilter(e.target.value)}
            className="bg-gray-800 text-white px-3 py-1.5 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
          >
            <option value="">All Symbols</option>
            {uniqueSymbols.map(symbol => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setStrategyTradeTab('all')}
          className={`px-4 py-2 font-medium transition-colors ${
            strategyTradeTab === 'all'
              ? 'text-orange-400 border-b-2 border-orange-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          All Trades
        </button>
        <button
          onClick={() => setStrategyTradeTab('closed')}
          className={`px-4 py-2 font-medium transition-colors ${
            strategyTradeTab === 'closed'
              ? 'text-orange-400 border-b-2 border-orange-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Closed
        </button>
        <button
          onClick={() => setStrategyTradeTab('stats')}
          className={`px-4 py-2 font-medium transition-colors ${
            strategyTradeTab === 'stats'
              ? 'text-orange-400 border-b-2 border-orange-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Statistics
        </button>
      </div>

      {/* Statistics Cards - Show on Stats Tab */}
      {strategyTradeTab === 'stats' && strategyTrades?.statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Total Trades</div>
            <div className="text-2xl font-bold text-white">
              {strategyTrades.statistics.total_trades}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {strategyTrades.statistics.winning_trades}W / {strategyTrades.statistics.losing_trades}L
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Win Rate</div>
            <div className={`text-2xl font-bold ${
              strategyTrades.statistics.win_rate >= 50 ? 'text-green-400' : 'text-red-400'
            }`}>
              {strategyTrades.statistics.win_rate.toFixed(1)}%
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Total P&L</div>
            <div className={`text-2xl font-bold ${
              strategyTrades.statistics.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              ${strategyTrades.statistics.total_pnl.toFixed(2)}
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Net P&L (after fees)</div>
            <div className={`text-2xl font-bold ${
              strategyTrades.statistics.net_pnl >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              ${strategyTrades.statistics.net_pnl.toFixed(2)}
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Total Fees</div>
            <div className="text-2xl font-bold text-yellow-400">
              ${strategyTrades.statistics.total_fees.toFixed(2)}
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Avg P&L per Trade</div>
            <div className={`text-2xl font-bold ${
              (strategyTrades.statistics.net_pnl / strategyTrades.statistics.total_trades) >= 0
                ? 'text-green-400' : 'text-red-400'
            }`}>
              ${(strategyTrades.statistics.net_pnl / strategyTrades.statistics.total_trades).toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Trades Table - Show on All/Closed Tabs */}
      {strategyTradeTab !== 'stats' && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          {strategyTradesLoading ? (
            <div className="p-8 text-center text-gray-400">Loading trades...</div>
          ) : filteredTrades.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No trades found {strategyTradeSymbolFilter && `for ${strategyTradeSymbolFilter}`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-900 text-gray-400 text-sm">
                    <th className="px-4 py-3 text-left">Time</th>
                    <th className="px-4 py-3 text-left">Symbol</th>
                    <th className="px-4 py-3 text-left">Strategy</th>
                    <th className="px-4 py-3 text-center">Side</th>
                    <th className="px-4 py-3 text-right">Quantity</th>
                    <th className="px-4 py-3 text-right">Entry</th>
                    <th className="px-4 py-3 text-right">Exit</th>
                    <th className="px-4 py-3 text-right">P&L $</th>
                    <th className="px-4 py-3 text-right">P&L %</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map((trade, idx) => (
                    <tr
                      key={trade.id}
                      className={`border-t border-gray-700 hover:bg-gray-750 transition-colors ${
                        idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'
                      }`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {formatTime(trade.entry_time)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-white">
                        {trade.symbol}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 capitalize">
                        {trade.strategy_type}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          trade.side === 'LONG'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-300">
                        {trade.quantity.toFixed(4)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-300">
                        ${trade.entry_price.toFixed(6)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-300">
                        {trade.exit_price ? `$${trade.exit_price.toFixed(6)}` : '-'}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${
                        trade.pnl
                          ? trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                          : 'text-gray-400'
                      }`}>
                        {trade.pnl !== null
                          ? `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}`
                          : '-'
                        }
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${
                        trade.pnl_pct
                          ? trade.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'
                          : 'text-gray-400'
                      }`}>
                        {trade.pnl_pct !== null
                          ? `${trade.pnl_pct >= 0 ? '+' : ''}${trade.pnl_pct.toFixed(2)}%`
                          : '-'
                        }
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          trade.status === 'OPEN'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {trade.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  )
}
