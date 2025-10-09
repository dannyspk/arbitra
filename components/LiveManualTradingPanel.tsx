'use client'

import React from 'react'
import { useLiveDashboardWebSocket } from '../hooks/useLiveDashboardWebSocket'

interface LiveManualTradeProps {
  symbol: string
  currentPrice: number
}

export default function LiveManualTradingPanel({ symbol, currentPrice }: LiveManualTradeProps) {
  const [leverage, setLeverage] = React.useState(1)
  // Track positions separately for hedge mode (can have both LONG and SHORT)
  const [hasLongPosition, setHasLongPosition] = React.useState(false)
  const [hasShortPosition, setHasShortPosition] = React.useState(false)
  const [longPosition, setLongPosition] = React.useState<any>(null)
  const [shortPosition, setShortPosition] = React.useState<any>(null)
  const [orderSize, setOrderSize] = React.useState(50) // USD
  const [takeProfitPct, setTakeProfitPct] = React.useState(2.0)
  const [stopLossPct, setStopLossPct] = React.useState(1.0)
  const [balance, setBalance] = React.useState(0) // Available balance
  const [balanceInfo, setBalanceInfo] = React.useState<any>(null) // Complete balance info
  const [loading, setLoading] = React.useState(false)
  const [loadingStatus, setLoadingStatus] = React.useState<string>('') // Loading status message
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = React.useState(false)
  const [pendingOrder, setPendingOrder] = React.useState<{ side: 'long' | 'short' } | null>(null)

  // Use WebSocket for real-time updates
  const liveWsData = useLiveDashboardWebSocket()

  const maxOrderSize = balance * leverage

  // Update balance and position from WebSocket in real-time
  React.useEffect(() => {
    if (liveWsData.connected && liveWsData.balance) {
      // Update balance info from WebSocket
      setBalance(liveWsData.balance.wallet_balance - (liveWsData.balance.unrealized_pnl < 0 ? Math.abs(liveWsData.balance.unrealized_pnl) : 0))
      setBalanceInfo({
        wallet_balance: liveWsData.balance.wallet_balance,
        unrealized_pnl: liveWsData.balance.unrealized_pnl,
        realized_pnl: liveWsData.balance.realized_pnl,
        total_fees_paid: liveWsData.balance.total_fees_paid,
        available: liveWsData.balance.wallet_balance,
        success: true,
      })
    }
  }, [liveWsData.balance, liveWsData.connected])

  // Update position from WebSocket - Handle hedge mode (can have LONG and SHORT simultaneously)
  // Use useMemo to prevent flickering by only updating when positions actually change
  React.useEffect(() => {
    if (liveWsData.connected && liveWsData.positions) {
      const longPos = liveWsData.positions.find((p) => p.symbol === symbol && p.side === 'long')
      const shortPos = liveWsData.positions.find((p) => p.symbol === symbol && p.side === 'short')
      
      // Only update LONG position if it actually changed
      const hasLong = !!longPos
      if (hasLong !== hasLongPosition) {
        setHasLongPosition(hasLong)
      }
      if (longPos && JSON.stringify(longPos) !== JSON.stringify(longPosition)) {
        setLongPosition({
          symbol: longPos.symbol,
          side: longPos.side,
          entry_price: longPos.entry_price,
          size: longPos.size,
          unrealized_pnl: longPos.unrealized_pnl,
        })
      } else if (!longPos && longPosition) {
        setLongPosition(null)
      }
      
      // Only update SHORT position if it actually changed
      const hasShort = !!shortPos
      if (hasShort !== hasShortPosition) {
        setHasShortPosition(hasShort)
      }
      if (shortPos && JSON.stringify(shortPos) !== JSON.stringify(shortPosition)) {
        setShortPosition({
          symbol: shortPos.symbol,
          side: shortPos.side,
          entry_price: shortPos.entry_price,
          size: shortPos.size,
          unrealized_pnl: shortPos.unrealized_pnl,
        })
      } else if (!shortPos && shortPosition) {
        setShortPosition(null)
      }
    }
  }, [liveWsData.positions, liveWsData.connected, symbol, hasLongPosition, hasShortPosition, longPosition, shortPosition])

  // Fallback: Poll for initial data if WebSocket not connected
  React.useEffect(() => {
    if (!liveWsData.connected) {
      const fetchData = async () => {
        try {
          const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
          
          // Fetch comprehensive Binance balance with fees and PNL
          const balanceResponse = await fetch(`${backend}/api/binance/balance`)
          if (balanceResponse.ok) {
            const balanceData = await balanceResponse.json()
            if (balanceData.success) {
              setBalance(balanceData.available || 0)
              setBalanceInfo(balanceData)
            }
          }
          
          // Fetch dashboard for positions
          const response = await fetch(`${backend}/api/dashboard?mode=live`)
          if (response.ok) {
            const data = await response.json()
            const longPos = data.positions?.find((p: any) => p.symbol === symbol && p.side === 'long')
            const shortPos = data.positions?.find((p: any) => p.symbol === symbol && p.side === 'short')
            
            if (longPos) {
              setLongPosition(longPos)
              setHasLongPosition(true)
            } else {
              setLongPosition(null)
              setHasLongPosition(false)
            }
            
            if (shortPos) {
              setShortPosition(shortPos)
              setHasShortPosition(true)
            } else {
              setShortPosition(null)
              setHasShortPosition(false)
            }
          }
        } catch (e) {
          console.error('Failed to fetch data:', e)
        }
      }

      fetchData()
      const interval = setInterval(fetchData, 2000) // Fallback polling
      return () => clearInterval(interval)
    }
  }, [liveWsData.connected, symbol])

  const handlePlaceOrderClick = (side: 'long' | 'short') => {
    // Validate price before showing confirmation
    if (!currentPrice || currentPrice <= 0) {
      setError('❌ Cannot place order: Invalid or missing price data. Please wait for price to load.')
      return
    }
    
    setPendingOrder({ side })
    setShowConfirmation(true)
  }

  const confirmPlaceOrder = async () => {
    if (!pendingOrder) return
    
    // Validate we have a valid price
    if (!currentPrice || currentPrice <= 0) {
      setError('❌ Invalid price. Please wait for price data to load.')
      setShowConfirmation(false)
      setPendingOrder(null)
      return
    }
    
    setLoading(true)
    setError(null)
    setSuccess(null)
    setShowConfirmation(false)
    setLoadingStatus('📡 Connecting to Binance via WebSocket...')

    try {
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      
      // Calculate position size in base asset WITHOUT leverage
      const positionValue = orderSize
      const sizeInAsset = positionValue / currentPrice
      
      setLoadingStatus('⚡ Placing market order via WebSocket...')
      
      const response = await fetch(`${backend}/api/manual-trade-ws`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          side: pendingOrder.side,
          size: sizeInAsset,
          leverage,
          take_profit_pct: takeProfitPct,
          stop_loss_pct: stopLossPct,
          entry_price: currentPrice,
          allow_live: true  // Enable live trading
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to place order')
      }

      setLoadingStatus('⚡ Placing TP/SL orders via WebSocket...')
      
      const result = await response.json()
      setSuccess(`✅ LIVE ${pendingOrder.side.toUpperCase()} position opened via WebSocket @ $${currentPrice.toFixed(2)}`)
      
      // Update position tracking based on side
      if (pendingOrder.side === 'long') {
        setHasLongPosition(true)
      } else {
        setHasShortPosition(true)
      }
      
      setPendingOrder(null)
      
    } catch (e: any) {
      setError(e.message)
      setPendingOrder(null)
    } finally {
      setLoading(false)
      setLoadingStatus('')
    }
  }

  const handleClosePosition = async (side: 'long' | 'short') => {
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
          side,  // Specify which position to close
          exit_price: currentPrice,
          allow_live: true  // Enable live trading for close
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to close position')
      }

      const result = await response.json()
      setSuccess(`✅ LIVE ${side.toUpperCase()} Position closed @ $${currentPrice.toFixed(2)} | P&L: $${result.pnl?.toFixed(2)}`)
      
      // Update position tracking
      if (side === 'long') {
        setHasLongPosition(false)
        setLongPosition(null)
      } else {
        setHasShortPosition(false)
        setShortPosition(null)
      }
      
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border-2 border-cyan-500/30 p-6">
      {/* Confirmation Modal */}
      {showConfirmation && pendingOrder && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border-2 border-cyan-500/50 p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center border-2 border-cyan-500/30">
                <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-cyan-400">⚡ LIVE ORDER CONFIRMATION</h3>
            </div>
            
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-300 font-semibold flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                This will execute a REAL trade on Binance with REAL money
              </p>
            </div>

            <div className="space-y-3 mb-6 bg-slate-800/50 rounded-lg p-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Symbol:</span>
                <span className="text-white font-semibold">{symbol}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Side:</span>
                <span className={`font-bold ${pendingOrder.side === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                  {pendingOrder.side === 'long' ? '📈 LONG' : '📉 SHORT'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Order Size:</span>
                <span className="text-white font-semibold">${orderSize}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Leverage:</span>
                <span className="text-amber-400 font-bold">{leverage}x</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Position Size:</span>
                <span className="text-white font-semibold">{(orderSize / currentPrice).toFixed(4)} {symbol.replace('USDT', '')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Entry Price:</span>
                <span className="text-white font-semibold">${currentPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Take Profit:</span>
                <span className="text-green-400 font-semibold">${(currentPrice * (1 + takeProfitPct / 100)).toFixed(2)} (+{takeProfitPct}%)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Stop Loss:</span>
                <span className="text-red-400 font-semibold">${(currentPrice * (1 - stopLossPct / 100)).toFixed(2)} (-{stopLossPct}%)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Est. Fee:</span>
                <span className="text-slate-300">~${(orderSize * 0.0005).toFixed(2)} (0.05%)</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmation(false)
                  setPendingOrder(null)
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmPlaceOrder}
                className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-500 hover:from-cyan-500 hover:to-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-cyan-500/50"
              >
                ✅ Confirm LIVE Order
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="flex items-center gap-2">
            Live Manual Trading
            <span className="px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/30 rounded text-xs text-cyan-400 font-bold">REAL</span>
            {/* WebSocket Status Indicator */}
            {liveWsData.connected ? (
              <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded text-xs text-green-400 font-bold flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                WS
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/30 rounded text-xs text-yellow-400 font-bold">
                HTTP
              </span>
            )}
          </span>
        </h3>
        {balanceInfo ? (
          <div className="flex flex-col gap-1 bg-cyan-500/10 rounded-lg px-3 py-2 border border-cyan-500/30 min-w-[200px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-cyan-300">Wallet:</span>
              <span className="text-sm font-bold text-cyan-400">${balanceInfo.wallet_balance?.toFixed(2) || '0.00'}</span>
            </div>
            {balanceInfo.unrealized_pnl !== 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-cyan-300">Unrealized PNL:</span>
                <span className={`text-sm font-bold ${balanceInfo.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {balanceInfo.unrealized_pnl >= 0 ? '+' : ''}${balanceInfo.unrealized_pnl?.toFixed(2) || '0.00'}
                </span>
              </div>
            )}
            {balanceInfo.total_fees_paid > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-cyan-300">Fees Paid:</span>
                <span className="text-sm font-bold text-orange-400">-${balanceInfo.total_fees_paid?.toFixed(4) || '0.00'}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-cyan-500/20">
              <span className="text-xs text-cyan-300">Available:</span>
              <span className="text-sm font-bold text-cyan-400">${balance.toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-cyan-500/10 rounded-lg px-3 py-1 border border-cyan-500/30">
            <span className="text-xs text-cyan-300">Live Balance:</span>
            <span className="text-sm font-bold text-cyan-400">${balance.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* LIVE INFO */}
      <div className={`mb-6 border rounded-lg p-4 ${
        liveWsData.connected 
          ? 'bg-green-500/10 border-green-500/30' 
          : 'bg-blue-500/10 border-blue-500/30'
      }`}>
        <div className="flex items-start gap-2">
          <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
            liveWsData.connected ? 'text-green-400' : 'text-blue-400'
          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className={`text-xs ${liveWsData.connected ? 'text-green-300' : 'text-blue-300'}`}>
            <strong className={liveWsData.connected ? 'text-green-400' : 'text-blue-400'}>
              {liveWsData.connected ? '⚡ WebSocket Connected:' : '🔄 LIVE TRADING:'}
            </strong>
            {liveWsData.connected 
              ? ' Real-time updates from Binance. Balance and positions update instantly.'
              : ' Connected to Binance. All orders execute in real-time. Manage your risk carefully and use stop-loss orders.'
            }
          </div>
        </div>
      </div>

      {/* Leverage Slider */}
      <div className="mb-6 bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-slate-300">Leverage (Futures)</label>
          <div className="flex items-center gap-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg px-3 py-1">
            <span className="text-lg font-bold text-cyan-400">{leverage}x</span>
          </div>
        </div>
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          value={leverage}
          onChange={(e) => setLeverage(parseInt(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
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
        
        {/* Custom Input Field */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cyan-400 text-lg font-bold">$</span>
          <input
            type="number"
            min="10"
            max={maxOrderSize}
            step="10"
            value={orderSize}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0
              // Enforce max based on leverage
              setOrderSize(Math.min(value, maxOrderSize))
            }}
            style={{
              MozAppearance: 'textfield'
            }}
            className="w-full bg-slate-800 text-white rounded-lg pl-9 pr-4 py-3 text-lg font-bold border-2 border-cyan-500/30 focus:outline-none focus:border-cyan-500 transition-colors no-spinner"
            placeholder="0"
          />
          <style jsx>{`
            input[type="number"]::-webkit-inner-spin-button,
            input[type="number"]::-webkit-outer-spin-button {
              -webkit-appearance: none;
              margin: 0;
              display: none;
            }
            input[type="number"] {
              -moz-appearance: textfield;
            }
          `}</style>
        </div>
        
        {/* Quick amount buttons */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setOrderSize(Math.min(25, maxOrderSize))}
            className="flex-1 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors border border-slate-600/50"
          >
            $25
          </button>
          <button
            onClick={() => setOrderSize(Math.min(50, maxOrderSize))}
            className="flex-1 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors border border-slate-600/50"
          >
            $50
          </button>
          <button
            onClick={() => setOrderSize(Math.min(100, maxOrderSize))}
            className="flex-1 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors border border-slate-600/50"
          >
            $100
          </button>
          <button
            onClick={() => setOrderSize(maxOrderSize)}
            className="flex-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 text-xs font-semibold py-2 rounded-lg transition-colors border border-cyan-500/50"
          >
            MAX
          </button>
        </div>
        
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-700/50">
          <span className="text-xs text-slate-500">Position size:</span>
          <span className="text-sm font-semibold text-cyan-400">
            {(orderSize / currentPrice).toFixed(4)} {symbol.replace('USDT', '')}
          </span>
        </div>
        
        {orderSize > maxOrderSize && (
          <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
            ⚠️ Amount exceeds max (${maxOrderSize.toFixed(2)} at {leverage}x leverage)
          </div>
        )}
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

      {/* Action Buttons - Always show for hedge mode (can have LONG + SHORT simultaneously) */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handlePlaceOrderClick('long')}
          disabled={loading || balance < 10}
          className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-slate-700 disabled:to-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-green-500/50 disabled:cursor-not-allowed"
        >
          {loading ? '...' : '📈 LONG'}
        </button>
        <button
          onClick={() => handlePlaceOrderClick('short')}
          disabled={loading || balance < 10}
          className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:from-slate-700 disabled:to-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-red-500/50 disabled:cursor-not-allowed"
        >
          {loading ? '...' : '📉 SHORT'}
        </button>
      </div>

      {/* LONG Position Strategy Panel */}
      {hasLongPosition && (
        <div className="space-y-3">
          <div className="bg-gradient-to-br from-green-900/30 to-blue-900/30 rounded-lg p-4 border-2 border-green-500/30">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h4 className="text-sm font-bold text-green-400">
                📈 LONG Position Strategy
              </h4>
            </div>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="bg-green-600/20 hover:bg-green-600/30 border border-green-500/40 text-green-300 text-xs font-semibold py-2 px-3 rounded-lg transition-all"
                  onClick={() => {
                    setSuccess('📈 Add-to-LONG: Execute when price breaks above resistance')
                  }}
                >
                  ➕ Scale In (Add More)
                </button>
                
                <button
                  className="bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/40 text-yellow-300 text-xs font-semibold py-2 px-3 rounded-lg transition-all"
                  onClick={() => {
                    setSuccess('📊 Trail SL: Moving stop-loss up as price increases')
                  }}
                >
                  📈 Trail Stop-Loss
                </button>
              </div>
              
              <button
                className="w-full bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold py-2 px-3 rounded-lg transition-all"
                onClick={() => {
                  setSuccess('🎯 Partial Exit: Sell 50% at +3%, let rest run')
                }}
              >
                💰 Scale Out (Take Partial Profit)
              </button>
              
              <div className="bg-green-500/10 border border-green-500/20 rounded p-2 text-xs text-green-300">
                <strong>💡 LONG Strategy Suggestions:</strong>
                <ul className="mt-1 space-y-1 ml-4 list-disc">
                  <li>Add to position on breakout confirmation</li>
                  <li>Trail SL at 50% of current profit</li>
                  <li>Take 50% profit at key resistance</li>
                </ul>
              </div>
              
              <button
                onClick={() => handleClosePosition('long')}
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:from-slate-700 disabled:to-slate-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-purple-500/50 disabled:cursor-not-allowed"
              >
                {loading ? '...' : '🔒 Close LONG Position'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHORT Position Strategy Panel */}
      {hasShortPosition && (
        <div className="space-y-3">
          <div className="bg-gradient-to-br from-red-900/30 to-purple-900/30 rounded-lg p-4 border-2 border-red-500/30">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h4 className="text-sm font-bold text-red-400">
                📉 SHORT Position Strategy
              </h4>
            </div>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 text-xs font-semibold py-2 px-3 rounded-lg transition-all"
                  onClick={() => {
                    setSuccess('📉 Add-to-SHORT: Execute when price breaks below support')
                  }}
                >
                  ➕ Scale In (Add More)
                </button>
                
                <button
                  className="bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/40 text-yellow-300 text-xs font-semibold py-2 px-3 rounded-lg transition-all"
                  onClick={() => {
                    setSuccess('📊 Trail SL: Moving stop-loss down as price decreases')
                  }}
                >
                  📉 Trail Stop-Loss
                </button>
              </div>
              
              <button
                className="w-full bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold py-2 px-3 rounded-lg transition-all"
                onClick={() => {
                  setSuccess('🎯 Partial Exit: Cover 50% at -3%, let rest run')
                }}
              >
                💰 Scale Out (Take Partial Profit)
              </button>
              
              <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-xs text-red-300">
                <strong>💡 SHORT Strategy Suggestions:</strong>
                <ul className="mt-1 space-y-1 ml-4 list-disc">
                  <li>Add to position on breakdown confirmation</li>
                  <li>Trail SL at 50% of current profit</li>
                  <li>Cover 50% at key support break</li>
                </ul>
              </div>
              
              <button
                onClick={() => handleClosePosition('short')}
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:from-slate-700 disabled:to-slate-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-purple-500/50 disabled:cursor-not-allowed"
              >
                {loading ? '...' : '🔒 Close SHORT Position'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info message when positions exist */}
      {(hasLongPosition || hasShortPosition) && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-300">
          ℹ️ View position details and live P&L in the <strong>Open Positions</strong> section above
        </div>
      )}

      {/* Status Messages */}
      {loading && loadingStatus && (
        <div className="mt-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin h-5 w-5 border-2 border-cyan-500 border-t-transparent rounded-full"></div>
            <span className="text-cyan-400 font-medium">{loadingStatus}</span>
          </div>
        </div>
      )}

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
    </div>
  )
}
