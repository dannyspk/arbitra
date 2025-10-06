'use client'

import React from 'react'

interface Position {
  symbol: string
  side: string
  entry_price: number
  size: number
  entry_time: number
  stop_loss?: number
  take_profit?: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
}

interface Signal {
  id: string
  timestamp: number
  symbol: string
  action: string
  price: number
  size?: number
  reason: string
  status: string
  order_id?: string
  error?: string
}

interface Trade {
  symbol: string
  side: string
  entry_price: number
  exit_price: number
  size: number
  entry_time: number
  exit_time: number
  pnl: number
  pnl_pct: number
  reason: string
}

interface DashboardData {
  strategy: {
    running: boolean
    mode: string
    symbol: string
    type: string
  }
  positions: Position[]
  signals: Signal[]
  trades: Trade[]
  statistics: {
    total_trades: number
    winning_trades: number
    losing_trades: number
    win_rate: number
    realized_pnl: number
    unrealized_pnl: number
    total_pnl: number
    active_positions: number
  }
  timestamp: number
}

function formatPrice(price?: number) {
  if (price === undefined || price === null) return '--'
  return `$${price.toFixed(2)}`
}

function formatPercent(pct?: number) {
  if (pct === undefined || pct === null) return '--'
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

function formatTime(ts?: number) {
  if (!ts) return '--'
  return new Date(ts).toLocaleTimeString()
}

export default function LiveDashboard() {
  const [data, setData] = React.useState<DashboardData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const fetchDashboard = React.useCallback(async () => {
    try {
      // Use environment variable for API URL
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

      const res = await fetch(`${backend}/api/dashboard`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-refresh every 2 seconds
  React.useEffect(() => {
    fetchDashboard()
    const interval = setInterval(fetchDashboard, 2000)
    return () => clearInterval(interval)
  }, [fetchDashboard])

  if (loading && !data) {
    return <div className="text-sm text-slate-400 animate-pulse">Loading dashboard...</div>
  }

  if (error && !data) {
    return <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">Error: {error}</div>
  }

  if (!data) {
    return <div className="text-sm text-slate-400">No data</div>
  }

  const { strategy, positions, signals, trades, statistics } = data

  return (
    <div className="space-y-4">
      {/* Strategy Status Bar */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 flex items-center justify-between border border-slate-700/50">
        <div className="flex items-center gap-4">
          <div>
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              strategy.running 
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-500/20' 
                : 'bg-slate-700 text-slate-400'
            }`}>
              {strategy.running ? '● LIVE' : '○ STOPPED'}
            </span>
          </div>
          {strategy.running && (
            <>
              <div className="text-sm">
                <span className="text-slate-500">Symbol:</span>{' '}
                <span className="font-semibold text-cyan-400">{strategy.symbol || '--'}</span>
              </div>
              <div className="text-sm">
                <span className="text-slate-500">Strategy:</span>{' '}
                <span className="font-semibold text-white uppercase">{strategy.type || '--'}</span>
              </div>
              <div className="text-sm">
                <span className="text-slate-500">Mode:</span>{' '}
                <span className="font-semibold text-purple-400">{strategy.mode || '--'}</span>
              </div>
            </>
          )}
        </div>
        <div className="text-xs text-slate-500">
          Updated: {formatTime(data.timestamp)}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-lg p-4 hover:border-cyan-500/30 transition-all">
          <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Total Trades</div>
          <div className="text-2xl font-bold text-white">{statistics.total_trades}</div>
        </div>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-lg p-4 hover:border-cyan-500/30 transition-all">
          <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Win Rate</div>
          <div className="text-2xl font-bold text-white">{statistics.win_rate.toFixed(1)}%</div>
        </div>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-lg p-4 hover:border-cyan-500/30 transition-all">
          <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Realized P&L</div>
          <div className={`text-2xl font-bold ${statistics.realized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPrice(statistics.realized_pnl)}
          </div>
        </div>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-lg p-4 hover:border-cyan-500/30 transition-all">
          <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Unrealized P&L</div>
          <div className={`text-2xl font-bold ${statistics.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPrice(statistics.unrealized_pnl)}
          </div>
        </div>
      </div>

      {/* Open Positions */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-slate-300 uppercase tracking-wide">Open Positions ({positions.length})</h3>
        {positions.length === 0 ? (
          <div className="text-sm text-slate-500 bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">No open positions</div>
        ) : (
          <div className="overflow-x-auto bg-slate-800/30 rounded-lg border border-slate-700/50">
            <table className="w-full text-xs">
              <thead className="bg-slate-800/50 text-slate-300 border-b border-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Symbol</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Side</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Entry</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Size</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">P&L</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">P&L %</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">SL</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">TP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {positions.map((pos, i) => (
                  <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{pos.symbol}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-lg text-xs font-semibold ${
                        pos.side === 'long' 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {pos.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">{formatPrice(pos.entry_price)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">{pos.size.toFixed(4)}</td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${
                      pos.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatPrice(pos.unrealized_pnl)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${
                      pos.unrealized_pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatPercent(pos.unrealized_pnl_pct)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">{formatPrice(pos.stop_loss)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">{formatPrice(pos.take_profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Signals */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-slate-300 uppercase tracking-wide">Recent Signals</h3>
        {signals.length === 0 ? (
          <div className="text-sm text-slate-500 bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">No signals yet</div>
        ) : (
          <div className="overflow-x-auto max-h-48 overflow-y-auto bg-slate-800/30 rounded-lg border border-slate-700/50">
            <table className="w-full text-xs">
              <thead className="bg-slate-800/50 text-slate-300 sticky top-0 border-b border-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Symbol</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Reason</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {signals.slice(0, 10).map((sig, i) => (
                  <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 text-slate-400">{formatTime(sig.timestamp)}</td>
                    <td className="px-4 py-3 font-medium text-white">{sig.symbol}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-lg text-xs font-semibold ${
                        sig.action.includes('long') ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {sig.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">{formatPrice(sig.price)}</td>
                    <td className="px-4 py-3 text-slate-400">{sig.reason}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-lg text-xs font-semibold ${
                        sig.status === 'executed' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                        sig.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                        'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {sig.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Completed Trades */}
      {trades.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-slate-300 uppercase tracking-wide">Recent Trades</h3>
          <div className="overflow-x-auto max-h-48 overflow-y-auto bg-slate-800/30 rounded-lg border border-slate-700/50">
            <table className="w-full text-xs">
              <thead className="bg-slate-800/50 text-slate-300 sticky top-0 border-b border-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Symbol</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Side</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Entry</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Exit</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">P&L</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">P&L %</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {trades.slice(0, 10).map((trade, i) => (
                  <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 text-slate-400">{formatTime(trade.exit_time)}</td>
                    <td className="px-4 py-3 font-medium text-white">{trade.symbol}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-lg text-xs font-semibold ${
                        trade.side === 'long' 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {trade.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">{formatPrice(trade.entry_price)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">{formatPrice(trade.exit_price)}</td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${
                      trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatPrice(trade.pnl)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${
                      trade.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatPercent(trade.pnl_pct)}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{trade.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
