'use client'

import React from 'react'

interface ManualTradeProps {
  symbol: string
  currentPrice: number
}

export default function ManualTradingPanel({ symbol, currentPrice }: ManualTradeProps) {
  const [leverage, setLeverage] = React.useState(1)
  const [position, setPosition] = React.useState<'long' | 'short' | null>(null)
  const [orderSize, setOrderSize] = React.useState(50) // USD
  const [takeProfitPct, setTakeProfitPct] = React.useState(2.0)
  const [stopLossPct, setStopLossPct] = React.useState(1.0)
  const [balance, setBalance] = React.useState(500) // Test balance from backend
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [livePosition, setLivePosition] = React.useState<any>(null)

  const maxOrderSize = balance * leverage

  // Poll for position updates and balance
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
        const response = await fetch(`${backend}/api/dashboard`)
        if (response.ok) {
          const data = await response.json()
          
          // Update balance from backend
          if (data.balance) {
            setBalance(data.balance.current)
          }
          
          // Update position if exists
          const pos = data.positions?.find((p: any) => p.symbol === symbol)
          setLivePosition(pos)
          
          // Update position state
          if (pos && !position) {
            setPosition(pos.side)
          } else if (!pos && position) {
            setPosition(null)
          }
        }
      } catch (e) {
        console.error('Failed to fetch dashboard:', e)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 2000) // Update every 2 seconds
    return () => clearInterval(interval)
  }, [position, symbol])

  const handlePlaceOrder = async (side: 'long' | 'short') => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      
      // Calculate position size in base asset WITHOUT leverage
      // Backend will apply leverage to the size
      const positionValue = orderSize  // Just the dollar amount from slider
      const sizeInAsset = positionValue / currentPrice  // Convert to base asset
      
      const response = await fetch(`${backend}/api/manual-trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          side,
          size: sizeInAsset,  // This is WITHOUT leverage
          leverage,
          take_profit_pct: takeProfitPct,
          stop_loss_pct: stopLossPct,
          entry_price: currentPrice
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to place order')
      }

      const result = await response.json()
      setSuccess(`✅ ${side.toUpperCase()} position opened @ $${currentPrice.toFixed(2)}`)
      setPosition(side)
      
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClosePosition = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      
      const response = await fetch(`${backend}/api/manual-trade/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          exit_price: currentPrice
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to close position')
      }

      const result = await response.json()
      setSuccess(`✅ Position closed @ $${currentPrice.toFixed(2)} | P&L: $${result.pnl?.toFixed(2)}`)
      setPosition(null)
      
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Manual Trading Panel
        </h3>
        <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-1 border border-slate-700">
          <span className="text-xs text-slate-400">Test Balance:</span>
          <span className="text-sm font-bold text-green-400">${balance.toFixed(2)}</span>
        </div>
      </div>

      {/* Leverage Slider */}
      <div className="mb-6 bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-slate-300">Leverage (Futures)</label>
          <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-lg px-3 py-1">
            <span className="text-lg font-bold text-amber-400">{leverage}x</span>
          </div>
        </div>
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          value={leverage}
          onChange={(e) => setLeverage(parseInt(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>1x</span>
          <span>5x</span>
          <span>10x</span>
        </div>
      </div>

      {/* Order Size */}
      <div className="mb-6 bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-slate-300">Order Size (USDT)</label>
          <span className="text-sm text-slate-400">Max: ${maxOrderSize.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="10"
          max={maxOrderSize}
          step="10"
          value={orderSize}
          onChange={(e) => setOrderSize(parseInt(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-slate-500">$10</span>
          <span className="text-lg font-bold text-blue-400">${orderSize}</span>
          <span className="text-xs text-slate-500">${maxOrderSize.toFixed(0)}</span>
        </div>
        <div className="text-xs text-slate-500 mt-2">
          Position size: {(orderSize / currentPrice).toFixed(4)} {symbol.replace('USDT', '')}
        </div>
      </div>

      {/* Take Profit / Stop Loss */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/30">
          <label className="text-xs font-semibold text-green-400 mb-2 block">Take Profit %</label>
          <input
            type="number"
            min="0.5"
            max="10"
            step="0.5"
            value={takeProfitPct}
            onChange={(e) => setTakeProfitPct(parseFloat(e.target.value))}
            className="w-full bg-slate-800 text-white rounded px-3 py-2 text-sm border border-green-500/30 focus:outline-none focus:border-green-500"
          />
          <div className="text-xs text-green-400/70 mt-1">
            ${(currentPrice * (1 + takeProfitPct / 100)).toFixed(2)}
          </div>
        </div>

        <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/30">
          <label className="text-xs font-semibold text-red-400 mb-2 block">Stop Loss %</label>
          <input
            type="number"
            min="0.5"
            max="10"
            step="0.5"
            value={stopLossPct}
            onChange={(e) => setStopLossPct(parseFloat(e.target.value))}
            className="w-full bg-slate-800 text-white rounded px-3 py-2 text-sm border border-red-500/30 focus:outline-none focus:border-red-500"
          />
          <div className="text-xs text-red-400/70 mt-1">
            ${(currentPrice * (1 - stopLossPct / 100)).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {!position ? (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handlePlaceOrder('long')}
            disabled={loading}
            className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-slate-700 disabled:to-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-green-500/50 disabled:cursor-not-allowed"
          >
            {loading ? '...' : '📈 LONG'}
          </button>
          <button
            onClick={() => handlePlaceOrder('short')}
            disabled={loading}
            className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:from-slate-700 disabled:to-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-red-500/50 disabled:cursor-not-allowed"
          >
            {loading ? '...' : '📉 SHORT'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleClosePosition}
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:from-slate-700 disabled:to-slate-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-purple-500/50 disabled:cursor-not-allowed"
            >
              {loading ? '...' : `🔒 Close ${position?.toUpperCase()}`}
            </button>
            <button
              disabled={true}
              className="bg-slate-700/50 text-slate-400 font-semibold py-3 px-4 rounded-lg cursor-not-allowed border border-slate-600/50"
            >
              ⚙️ Adjust SL/TP
            </button>
          </div>
          
          {/* Position managed in main dashboard */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-300">
            ℹ️ View position details and live P&L in the <strong>Open Positions</strong> section above
          </div>
        </div>
      )}

      {/* Status Messages */}
      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          ⚠️ {error}
        </div>
      )}
      
      {success && (
        <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-400">
          {success}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs text-blue-300">
            <strong>Test Mode:</strong> This uses paper trading with a virtual ${balance} balance. 
            Orders execute instantly at current market price. Perfect for testing the UI and strategy flow!
          </div>
        </div>
      </div>
    </div>
  )
}
