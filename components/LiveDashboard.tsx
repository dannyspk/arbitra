'use client'

import React from 'react'
import { useLiveDashboardWebSocket } from '../hooks/useLiveDashboardWebSocket'

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
  balance: {
    current: number
    initial: number
    pnl: number
    pnl_pct: number
    live?: boolean
    wallet_balance?: number
    unrealized_pnl?: number
    realized_pnl?: number
    total_fees_paid?: number
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

interface LiveDashboardProps {
  isLiveMode?: boolean
  hideSignals?: boolean
  hideHeader?: boolean
  sharedWsData?: any // Allow passing WebSocket data from parent to avoid multiple connections
}

export default function LiveDashboard({ isLiveMode = false, hideSignals = false, hideHeader = false, sharedWsData }: LiveDashboardProps) {
  const [data, setData] = React.useState<DashboardData | null>(null)
  const [loading, setLoading] = React.useState(!isLiveMode) // Don't show loading in live mode - WebSocket will populate instantly
  const [error, setError] = React.useState<string | null>(null)
  const [adjustingPosition, setAdjustingPosition] = React.useState<Position | null>(null)
  const [closingPosition, setClosingPosition] = React.useState<Position | null>(null)
  const [newStopLoss, setNewStopLoss] = React.useState('')
  const [newTakeProfit, setNewTakeProfit] = React.useState('')

  // Use shared WebSocket data if provided (to avoid creating multiple connections)
  // Otherwise create own connection ONLY if in live mode AND no shared data
  const shouldUseOwnWebSocket = !sharedWsData && isLiveMode
  const localWsData = shouldUseOwnWebSocket ? useLiveDashboardWebSocket() : {
    balance: null,
    positions: [],
    orders: [],
    connected: false,
    error: null,
    lastUpdate: 0,
  }
  
  // Use shared data if provided, otherwise use local connection
  const liveWsData = sharedWsData || localWsData
  const useWebSocket = isLiveMode // Enable WebSocket only in live mode

  // Initialize with empty state for live mode to avoid loading screen
  React.useEffect(() => {
    if (isLiveMode && !data) {
      setData({
        strategy: { running: false, mode: '', symbol: '', type: '' },
        positions: [],
        signals: [],
        trades: [],
        statistics: {
          total_trades: 0,
          winning_trades: 0,
          losing_trades: 0,
          win_rate: 0,
          realized_pnl: 0,
          unrealized_pnl: 0,
          total_pnl: 0,
          active_positions: 0,
        },
        balance: {
          current: 0,
          initial: 0,
          pnl: 0,
          pnl_pct: 0,
        },
        timestamp: Date.now(),
      })
    }
  }, [isLiveMode, data])

  const fetchDashboard = React.useCallback(async () => {
    try {
      // Use environment variable for API URL
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

      // Add query parameter to indicate if we want live or test data
      const url = `${backend}/api/dashboard?mode=${isLiveMode ? 'live' : 'test'}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [isLiveMode])

  const handleClosePosition = async (position: Position) => {
    setClosingPosition(position)
  }

  const confirmClosePosition = async () => {
    if (!closingPosition) return

    try {
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      
      // Fetch current market price from the backend
      let currentPrice: number
      try {
        const priceResponse = await fetch(`${backend}/api/price/${closingPosition.symbol}`)
        if (priceResponse.ok) {
          const priceData = await priceResponse.json()
          currentPrice = priceData.price
        } else {
          // Fallback: calculate from unrealized P&L (less accurate)
          if (closingPosition.side === 'long') {
            currentPrice = closingPosition.entry_price + (closingPosition.unrealized_pnl / closingPosition.size)
          } else {
            // For SHORT: if price went down, pnl is positive, so current_price = entry - (pnl/size)
            currentPrice = closingPosition.entry_price - (closingPosition.unrealized_pnl / closingPosition.size)
          }
        }
      } catch {
        // Fallback calculation
        if (closingPosition.side === 'long') {
          currentPrice = closingPosition.entry_price + (closingPosition.unrealized_pnl / closingPosition.size)
        } else {
          currentPrice = closingPosition.entry_price - (closingPosition.unrealized_pnl / closingPosition.size)
        }
      }
      
      console.log(`[CLOSE POSITION] ${closingPosition.symbol} ${closingPosition.side} at ${currentPrice}`)
      
      const response = await fetch(`${backend}/api/manual-trade/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: closingPosition.symbol,
          exit_price: currentPrice,
          allow_live: isLiveMode  // Use isLiveMode prop instead of always true
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to close position')
      }

      // Refresh dashboard immediately and close modal
      await fetchDashboard()
      setClosingPosition(null)
      
    } catch (e: any) {
      alert(`Error closing position: ${e.message}`)
      setClosingPosition(null)
    }
  }

  const handleAdjustClick = (position: Position) => {
    setAdjustingPosition(position)
    setNewStopLoss(position.stop_loss?.toFixed(2) || '')
    setNewTakeProfit(position.take_profit?.toFixed(2) || '')
  }

  const handleAdjustSubmit = async () => {
    if (!adjustingPosition) return

    try {
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      
      const response = await fetch(`${backend}/api/manual-trade/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: adjustingPosition.symbol,
          stop_loss: parseFloat(newStopLoss),
          take_profit: parseFloat(newTakeProfit),
          allow_live: isLiveMode  // Use isLiveMode prop instead of always true
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to adjust SL/TP')
      }

      // Refresh dashboard and close modal
      await fetchDashboard()
      setAdjustingPosition(null)
      
    } catch (e: any) {
      alert(`Error adjusting SL/TP: ${e.message}`)
    }
  }

  // Update data from WebSocket if in live mode, otherwise poll
  React.useEffect(() => {
    if (useWebSocket && liveWsData.connected) {
      // Debug: Log what we're receiving from WebSocket
      console.log('[LiveDashboard] WebSocket data:', {
        hasBalance: !!liveWsData.balance,
        balance: liveWsData.balance,
        positionsCount: liveWsData.positions.length,
        connected: liveWsData.connected,
        lastUpdate: liveWsData.lastUpdate
      })

      // Update whenever WebSocket has any data (balance, positions, or last update changes)
      setData((prev) => {
        if (!prev) return prev

        // Always update balance if available from WebSocket
        const updatedBalance = liveWsData.balance
          ? {
              current: liveWsData.balance.net_balance,
              initial: liveWsData.balance.wallet_balance,
              pnl: liveWsData.balance.realized_pnl,
              pnl_pct: liveWsData.balance.wallet_balance > 0 
                ? ((liveWsData.balance.net_balance - liveWsData.balance.wallet_balance) / liveWsData.balance.wallet_balance) * 100
                : 0,
              live: true,  // Critical: Mark as live balance
              wallet_balance: liveWsData.balance.wallet_balance,
              unrealized_pnl: liveWsData.balance.unrealized_pnl,
              realized_pnl: liveWsData.balance.realized_pnl,
              total_fees_paid: liveWsData.balance.total_fees_paid,
            }
          : prev.balance

        console.log('[LiveDashboard] Updated balance:', updatedBalance)

        // Update positions from WebSocket
        const updatedPositions = liveWsData.positions.length > 0
          ? liveWsData.positions.map((p: any) => ({
              symbol: p.symbol,
              side: p.side,
              entry_price: p.entry_price,
              size: p.size,
              entry_time: p.entry_time || 0,
              stop_loss: p.stop_loss,
              take_profit: p.take_profit,
              unrealized_pnl: p.unrealized_pnl,
              unrealized_pnl_pct: p.unrealized_pnl_pct || (p.entry_price > 0 && p.size > 0 ? (p.unrealized_pnl / (p.entry_price * p.size)) * 100 : 0),
            }))
          : prev.positions

        return {
          ...prev,
          balance: updatedBalance,
          positions: updatedPositions,
          statistics: {
            ...prev.statistics,
            active_positions: updatedPositions.length,
            unrealized_pnl: updatedPositions.reduce((sum: number, p: any) => sum + p.unrealized_pnl, 0),
          },
          timestamp: liveWsData.lastUpdate || prev.timestamp,
        }
      })
      setLoading(false)
      setError(null)
    }
  }, [useWebSocket, liveWsData.connected, liveWsData.balance, liveWsData.positions, liveWsData.lastUpdate])

  // Fallback polling for test mode ONLY
  React.useEffect(() => {
    if (!useWebSocket) {
      // Test mode - use HTTP polling only
      fetchDashboard()
      const interval = setInterval(fetchDashboard, 2000)
      return () => clearInterval(interval)
    }
    // Live mode with WebSocket - NO HTTP polling needed
    // WebSocket provides real-time balance, positions, and orders
    // Trades/signals/stats are fetched on-demand or via separate endpoints if needed
  }, [fetchDashboard, useWebSocket])

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
      {/* WebSocket Connection Status (Live Mode Only) */}
      {isLiveMode && (
        <div className={`text-xs px-3 py-2 rounded-lg border flex items-center gap-2 ${
          liveWsData.connected
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${liveWsData.connected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
          {liveWsData.connected ? '⚡ WebSocket Connected - Real-time updates active' : '📡 Connecting to WebSocket...'}
          {liveWsData.error && <span className="text-red-400 ml-2">({liveWsData.error})</span>}
        </div>
      )}

      {/* Strategy Status Bar */}
      {!hideHeader && (
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
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-lg p-3 sm:p-4 hover:border-cyan-500/30 transition-all">
          <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide flex items-center gap-2">
            {data.balance?.live ? (
              <>
                Live Balance
              </>
            ) : (
              'Test Balance'
            )}
          </div>
          <div className={`text-lg sm:text-2xl font-bold ${(data.balance?.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.balance?.live ? (
              // Live: Show wallet_balance + unrealized_pnl
              `$${((data.balance.wallet_balance || 0) + (data.balance.unrealized_pnl || 0)).toFixed(2)}`
            ) : (
              // Test: Show current balance
              `$${data.balance?.current.toFixed(2) || '500.00'}`
            )}
          </div>
          {data.balance?.live ? (
            <div className="text-xs text-slate-500 mt-1 space-y-0.5">
              {data.balance.unrealized_pnl !== undefined && data.balance.unrealized_pnl !== 0 && (
                <div className={data.balance.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                  Unrealized: {data.balance.unrealized_pnl >= 0 ? '+' : ''}${data.balance.unrealized_pnl.toFixed(2)}
                </div>
              )}
              {data.balance.total_fees_paid !== undefined && data.balance.total_fees_paid > 0 && (
                <div className="text-orange-400">
                  Fees: -${data.balance.total_fees_paid.toFixed(4)}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 mt-1">
              {(data.balance?.pnl || 0) >= 0 ? '+' : ''}${data.balance?.pnl.toFixed(2) || '0.00'} ({(data.balance?.pnl_pct || 0).toFixed(1)}%)
            </div>
          )}
        </div>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-lg p-3 sm:p-4 hover:border-cyan-500/30 transition-all">
          <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Total Trades</div>
          <div className="text-lg sm:text-2xl font-bold text-white">{statistics.total_trades}</div>
        </div>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-lg p-3 sm:p-4 hover:border-cyan-500/30 transition-all">
          <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Win Rate</div>
          <div className="text-lg sm:text-2xl font-bold text-white">{statistics.win_rate.toFixed(1)}%</div>
        </div>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-lg p-3 sm:p-4 hover:border-cyan-500/30 transition-all">
          <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Realized P&L</div>
          <div className={`text-lg sm:text-2xl font-bold ${statistics.realized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPrice(statistics.realized_pnl)}
          </div>
        </div>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-lg p-3 sm:p-4 hover:border-cyan-500/30 transition-all">
          <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Unrealized P&L</div>
          <div className={`text-lg sm:text-2xl font-bold ${statistics.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPrice(statistics.unrealized_pnl)}
          </div>
        </div>
      </div>

      {/* My Positions */}
      <div>
        <h3 className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3 text-slate-300 uppercase tracking-wide">My Positions ({positions.length})</h3>
        {positions.length === 0 ? (
          <div className="text-xs sm:text-sm text-slate-500 bg-slate-800/30 rounded-lg p-3 sm:p-4 border border-slate-700/30">No open positions</div>
        ) : (
          <div className="overflow-x-auto bg-slate-800/30 rounded-lg border border-slate-700/50 -mx-4 sm:mx-0">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-800/50 text-slate-300 border-b border-slate-700/50">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Symbol</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Side</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold uppercase tracking-wider whitespace-nowrap">Entry</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold uppercase tracking-wider whitespace-nowrap">Size</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold uppercase tracking-wider whitespace-nowrap">P&L</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold uppercase tracking-wider whitespace-nowrap">P&L %</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold uppercase tracking-wider whitespace-nowrap">SL</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold uppercase tracking-wider whitespace-nowrap">TP</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold uppercase tracking-wider whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {positions.map((pos, i) => (
                  <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-white whitespace-nowrap">{pos.symbol}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                      <span className={`inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                        pos.side === 'long' 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {pos.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-mono text-slate-300 whitespace-nowrap">{formatPrice(pos.entry_price)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-mono text-slate-300 whitespace-nowrap">{pos.size.toFixed(4)}</td>
                    <td className={`px-2 sm:px-4 py-2 sm:py-3 text-right font-mono font-semibold whitespace-nowrap ${
                      pos.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatPrice(pos.unrealized_pnl)}
                    </td>
                    <td className={`px-2 sm:px-4 py-2 sm:py-3 text-right font-mono font-semibold whitespace-nowrap ${
                      pos.unrealized_pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatPercent(pos.unrealized_pnl_pct)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-mono text-slate-500 whitespace-nowrap">{formatPrice(pos.stop_loss)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-mono text-slate-500 whitespace-nowrap">{formatPrice(pos.take_profit)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                      <div className="flex items-center justify-center gap-1 sm:gap-2">
                        <button
                          onClick={() => handleClosePosition(pos)}
                          className="px-2 sm:px-3 py-1 sm:py-1.5 bg-purple-600/80 hover:bg-purple-500 text-white text-xs font-semibold rounded transition-colors whitespace-nowrap"
                          title="Close position"
                        >
                          Close
                        </button>
                        <button
                          onClick={() => handleAdjustClick(pos)}
                          className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded transition-colors"
                          title="Adjust SL/TP"
                        >
                          ⚙️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Signals */}
      {!hideSignals && (
      <div>
        <h3 className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3 text-slate-300 uppercase tracking-wide">Recent Signals</h3>
        {signals.length === 0 ? (
          <div className="text-xs sm:text-sm text-slate-500 bg-slate-800/30 rounded-lg p-3 sm:p-4 border border-slate-700/30">No signals yet</div>
        ) : (
          <div className="overflow-x-auto max-h-48 overflow-y-auto bg-slate-800/30 rounded-lg border border-slate-700/50 -mx-4 sm:mx-0">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-800/50 text-slate-300 sticky top-0 border-b border-slate-700/50">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Time</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Symbol</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Action</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold uppercase tracking-wider whitespace-nowrap">Price</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Reason</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {signals.slice(0, 10).map((sig, i) => (
                  <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-slate-400 whitespace-nowrap">{formatTime(sig.timestamp)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-white whitespace-nowrap">{sig.symbol}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                      <span className={`inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                        sig.action.includes('long') ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {sig.action}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-mono text-slate-300 whitespace-nowrap">{formatPrice(sig.price)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-slate-400 whitespace-nowrap">{sig.reason}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                      <span className={`inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
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
      )}

      {/* Completed Trades */}
      {trades.length > 0 && (
        <div>
          <h3 className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3 text-slate-300 uppercase tracking-wide">Recent Trades</h3>
          <div className="overflow-x-auto max-h-48 overflow-y-auto bg-slate-800/30 rounded-lg border border-slate-700/50 -mx-4 sm:mx-0">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-800/50 text-slate-300 sticky top-0 border-b border-slate-700/50">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Time</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Symbol</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Side</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold uppercase tracking-wider whitespace-nowrap">Entry</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold uppercase tracking-wider whitespace-nowrap">Exit</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold uppercase tracking-wider whitespace-nowrap">P&L</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold uppercase tracking-wider whitespace-nowrap">P&L %</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold uppercase tracking-wider whitespace-nowrap">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {trades.slice(0, 10).map((trade, i) => (
                  <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-slate-400 whitespace-nowrap">{formatTime(trade.exit_time)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-white whitespace-nowrap">{trade.symbol}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                      <span className={`inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                        trade.side === 'long' 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {trade.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-mono text-slate-300 whitespace-nowrap">{formatPrice(trade.entry_price)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-mono text-slate-300 whitespace-nowrap">{formatPrice(trade.exit_price)}</td>
                    <td className={`px-2 sm:px-4 py-2 sm:py-3 text-right font-mono font-semibold whitespace-nowrap ${
                      trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatPrice(trade.pnl)}
                    </td>
                    <td className={`px-2 sm:px-4 py-2 sm:py-3 text-right font-mono font-semibold whitespace-nowrap ${
                      trade.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatPercent(trade.pnl_pct)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-slate-400 whitespace-nowrap">{trade.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Close Position Confirmation Modal */}
      {closingPosition && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setClosingPosition(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Close Position</h3>
              <button onClick={() => setClosingPosition(null)} className="text-slate-400 hover:text-white transition-colors">✕</button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-400">Symbol</span>
                  <span className="text-lg font-bold text-white">{closingPosition.symbol}</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-400">Side</span>
                  <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                    closingPosition.side === 'long' 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {closingPosition.side.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/50">
                  <div>
                    <div className="text-xs text-slate-500">Entry Price</div>
                    <div className="text-sm font-mono text-white">${closingPosition.entry_price.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Current P&L</div>
                    <div className={`text-sm font-mono font-bold ${
                      closingPosition.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      ${closingPosition.unrealized_pnl.toFixed(2)} ({closingPosition.unrealized_pnl_pct.toFixed(2)}%)
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <span className="text-yellow-400 text-lg">⚠️</span>
                  <div className="text-sm text-yellow-300">
                    This will close your position at the current market price. This action cannot be undone.
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setClosingPosition(null)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 px-4 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmClosePosition}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-semibold py-2.5 px-4 rounded transition-all shadow-lg hover:shadow-purple-500/50"
                >
                  Close Position
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Adjust SL/TP Modal */}
      {adjustingPosition && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setAdjustingPosition(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Adjust SL/TP</h3>
              <button onClick={() => setAdjustingPosition(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="text-sm text-slate-400 mb-2">
                  Position: <span className="text-white font-semibold">{adjustingPosition.symbol}</span>{' '}
                  <span className={adjustingPosition.side === 'long' ? 'text-green-400' : 'text-red-400'}>
                    {adjustingPosition.side.toUpperCase()}
                  </span>
                </div>
                <div className="text-sm text-slate-400">
                  Entry: <span className="text-white">${adjustingPosition.entry_price.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Stop Loss ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newStopLoss}
                  onChange={(e) => setNewStopLoss(e.target.value)}
                  className="w-full bg-slate-900 text-white rounded px-3 py-2 border border-red-500/30 focus:outline-none focus:border-red-500"
                  placeholder="Stop loss price"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Take Profit ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newTakeProfit}
                  onChange={(e) => setNewTakeProfit(e.target.value)}
                  className="w-full bg-slate-900 text-white rounded px-3 py-2 border border-green-500/30 focus:outline-none focus:border-green-500"
                  placeholder="Take profit price"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setAdjustingPosition(null)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustSubmit}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-2 px-4 rounded transition-all"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
