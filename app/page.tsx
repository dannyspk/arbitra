'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useWallet } from '../components/WalletProvider'

type DashboardStats = {
  total_volume_24h: number
  active_pairs: number
  hot_coins_count: number
  avg_spread: number
  top_opportunity: {
    symbol: string
    profit_pct: number
  } | null
  portfolio_value: number
}

export default function Page() {
  const { address: connectedWallet } = useWallet()
  const [stats, setStats] = useState<DashboardStats>({
    total_volume_24h: 0,
    active_pairs: 0,
    hot_coins_count: 0,
    avg_spread: 0,
    top_opportunity: null,
    portfolio_value: 0
  })
  const [topGainers, setTopGainers] = useState<any[]>([])
  const [topLosers, setTopLosers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const API = 'http://127.0.0.1:8000'
        
        // Fetch portfolio balance from exchanges
        let exchangePortfolioValue = 0
        let walletPortfolioValue = 0
        
        try {
          const [binanceBalRes, mexcBalRes, binanceTickersRes, mexcTickersRes] = await Promise.all([
            fetch(API + '/api/balances/binance'),
            fetch(API + '/api/balances/mexc'),
            fetch(API + '/api/tickers/binance'),
            fetch(API + '/api/tickers/mexc')
          ])
          
          const binanceBalances = await binanceBalRes.json()
          const mexcBalances = await mexcBalRes.json()
          const binanceTickers = binanceTickersRes.ok ? await binanceTickersRes.json() : {}
          const mexcTickers = mexcTickersRes.ok ? await mexcTickersRes.json() : {}
          
          // Helper to get USD price for an asset
          const getUsdPrice = (asset: string) => {
            const sym = asset.toUpperCase()
            const direct1 = sym + 'USDT'
            const direct2 = sym + '/USDT'
            if (binanceTickers[direct1]) return binanceTickers[direct1]
            if (binanceTickers[direct2]) return binanceTickers[direct2]
            if (mexcTickers[direct1]) return mexcTickers[direct1]
            if (mexcTickers[direct2]) return mexcTickers[direct2]
            if (sym === 'USDT' || sym === 'USD') return 1.0
            return 0
          }
          
          // Calculate portfolio value from balances
          const calculatePortfolioValue = (balances: any) => {
            if (!balances || typeof balances !== 'object') return 0
            const balData = balances.balances || balances
            let total = 0
            for (const [asset, v] of Object.entries(balData as any)) {
              try {
                const amt = Number((v as any).free || 0) + Number((v as any).locked || 0)
                const price = getUsdPrice(asset)
                total += amt * price
              } catch (e) { continue }
            }
            return total
          }
          
          exchangePortfolioValue = calculatePortfolioValue(binanceBalances) + calculatePortfolioValue(mexcBalances)
        } catch (e) {
          console.error('Failed to fetch exchange portfolio balance:', e)
        }
        
        // Fetch Web3 wallet balance if connected
        if (connectedWallet) {
          try {
            const walletBalRes = await fetch(`${API}/api/wallet/balance/${connectedWallet}`)
            if (walletBalRes.ok) {
              const walletData = await walletBalRes.json()
              walletPortfolioValue = walletData.total_usd || 0
              console.log(`Wallet balance: $${walletPortfolioValue.toFixed(2)}`)
            }
          } catch (e) {
            console.error('Failed to fetch wallet balance:', e)
          }
        }
        
        const totalPortfolioValue = exchangePortfolioValue + walletPortfolioValue
        
        // Fetch Binance Futures exchange info to get active trading symbols
        const exchangeInfoRes = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo')
        const exchangeInfo = await exchangeInfoRes.json()
        
        // Get list of actively trading symbols
        const activeTradingSymbols = new Set(
          exchangeInfo.symbols
            .filter((s: any) => 
              s.status === 'TRADING' && 
              s.contractType === 'PERPETUAL' &&
              s.symbol.endsWith('USDT')
            )
            .map((s: any) => s.symbol)
        )
        
        // Fetch Binance Futures 24h ticker data
        const binanceRes = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr')
        const binanceData = await binanceRes.json()
        
        // Filter for legitimate, actively trading USDT perpetual pairs
        const usdtPairs = binanceData
          .filter((ticker: any) => 
            ticker.symbol.endsWith('USDT') &&
            activeTradingSymbols.has(ticker.symbol) // Only include active trading symbols
          )
          .map((ticker: any) => ({
            symbol: ticker.symbol,
            last: parseFloat(ticker.lastPrice),
            change24h: parseFloat(ticker.priceChangePercent),
            quoteVolume: parseFloat(ticker.quoteVolume),
            high24h: parseFloat(ticker.highPrice),
            low24h: parseFloat(ticker.lowPrice),
          }))
          .filter((ticker: any) => 
            !isNaN(ticker.change24h) && 
            !isNaN(ticker.last) &&
            ticker.last > 0 &&
            ticker.quoteVolume > 5000000 // Filter volume > 5M for more liquid pairs
          )
        
        // Sort and get top 5 gainers and losers
        const sortedByGain = [...usdtPairs].sort((a, b) => b.change24h - a.change24h)
        const sortedByLoss = [...usdtPairs].sort((a, b) => a.change24h - b.change24h)
        
        setTopGainers(sortedByGain.slice(0, 5))
        setTopLosers(sortedByLoss.slice(0, 5))
        
        // Calculate stats
        const totalVolume = usdtPairs.reduce((sum: number, coin: any) => 
          sum + (coin.quoteVolume || 0), 0
        )
        
        const topOpp = sortedByGain.length > 0 ? {
          symbol: sortedByGain[0].symbol,
          profit_pct: sortedByGain[0].change24h
        } : null
        
        setStats({
          total_volume_24h: totalVolume,
          active_pairs: usdtPairs.length,
          hot_coins_count: usdtPairs.length,
          avg_spread: 0.15,
          top_opportunity: topOpp,
          portfolio_value: totalPortfolioValue
        })
        
        setLoading(false)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
        setLoading(false)
      }
    }

    fetchDashboardData()
    const interval = setInterval(fetchDashboardData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [connectedWallet]) // Re-fetch when wallet connection changes

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Arbitra Dashboard
          </h1>
          <p className="text-slate-400">Real-time market insights and opportunities</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Volume */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 border border-slate-700/50 shadow-xl hover:shadow-cyan-500/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-full">24h</span>
            </div>
            <h3 className="text-sm font-medium text-slate-400 mb-1">Total Volume</h3>
            <p className="text-2xl font-bold text-white">
              ${loading ? '...' : (stats.total_volume_24h / 1e6).toFixed(2)}M
            </p>
          </div>

          {/* Your Portfolio */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 border border-slate-700/50 shadow-xl hover:shadow-blue-500/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-green-400 bg-green-500/10 px-2 py-1 rounded-full">Live</span>
            </div>
            <h3 className="text-sm font-medium text-slate-400 mb-1">Your Portfolio</h3>
            <p className="text-2xl font-bold text-white">
              {loading ? '...' : (stats.portfolio_value || 0).toLocaleString(undefined, {style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </p>
            {connectedWallet && (
              <p className="text-xs text-slate-500 mt-2">
                <span className="text-slate-400">Wallet: </span>
                {connectedWallet.slice(0, 6)}...{connectedWallet.slice(-4)}
              </p>
            )}
          </div>

          {/* Hot Coins */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 border border-slate-700/50 shadow-xl hover:shadow-amber-500/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">Hot</span>
            </div>
            <h3 className="text-sm font-medium text-slate-400 mb-1">Trending Coins</h3>
            <p className="text-2xl font-bold text-white">{loading ? '...' : stats.hot_coins_count}</p>
          </div>

          {/* Top Opportunity */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 border border-slate-700/50 shadow-xl hover:shadow-purple-500/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full">Top</span>
            </div>
            <h3 className="text-sm font-medium text-slate-400 mb-1">Best Performer</h3>
            {stats.top_opportunity ? (
              <div>
                <p className="text-xl font-bold text-white mb-1">{stats.top_opportunity.symbol}</p>
                <p className={`text-sm font-semibold ${stats.top_opportunity.profit_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {stats.top_opportunity.profit_pct >= 0 ? '+' : ''}{stats.top_opportunity.profit_pct.toFixed(2)}%
                </p>
              </div>
            ) : (
              <p className="text-xl text-slate-500">—</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href="/trading" className="group">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 border border-slate-700/50 hover:border-cyan-500/50 shadow-xl hover:shadow-cyan-500/20 transition-all duration-300 cursor-pointer">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-4 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl border border-cyan-500/30 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Trading</h3>
                    <p className="text-sm text-slate-400">Execute trades</p>
                  </div>
                </div>
                <p className="text-slate-500 text-sm">Place orders and manage positions in real-time</p>
              </div>
            </Link>

            <Link href="/opportunities" className="group">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 border border-slate-700/50 hover:border-amber-500/50 shadow-xl hover:shadow-amber-500/20 transition-all duration-300 cursor-pointer">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-4 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl border border-amber-500/30 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Opportunities</h3>
                    <p className="text-sm text-slate-400">View hot coins</p>
                  </div>
                </div>
                <p className="text-slate-500 text-sm">Discover trending pairs and market movers</p>
              </div>
            </Link>

            <Link href="/execution" className="group">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 border border-slate-700/50 hover:border-red-500/50 shadow-xl hover:shadow-red-500/20 transition-all duration-300 cursor-pointer">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-4 bg-gradient-to-br from-red-500/20 to-rose-500/20 rounded-xl border border-red-500/30 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Liquidations</h3>
                    <p className="text-sm text-slate-400">Monitor events</p>
                  </div>
                </div>
                <p className="text-slate-500 text-sm">Track liquidation streams and market volatility</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Top Gainers and Losers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 5 Gainers */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-green-400">🚀</span> Top 5 Gainers
              </h2>
              <span className="text-xs text-slate-400">Binance Futures 24h</span>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-green-500/20 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50 bg-green-500/5">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Symbol</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Price</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">24h Change</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <div className="flex items-center justify-center gap-3">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </td>
                      </tr>
                    ) : topGainers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                          No data available
                        </td>
                      </tr>
                    ) : (
                      topGainers.map((coin, idx) => (
                        <tr key={idx} className="hover:bg-green-500/5 transition-colors">
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center justify-center w-7 h-7 bg-gradient-to-br from-green-500/20 to-emerald-500/20 text-green-400 rounded-full font-bold text-sm">
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-white">{coin.symbol}</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-slate-300 font-mono text-sm">
                              ${coin.last.toFixed(coin.last < 1 ? 6 : 2)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold text-sm bg-green-500/10 text-green-400 border border-green-500/20">
                              ↑ +{coin.change24h.toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Link 
                              href={`/trading?symbol=${encodeURIComponent(coin.symbol)}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-green-500/20 transition-all duration-200"
                            >
                              Trade
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Top 5 Losers */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-red-400">📉</span> Top 5 Losers
              </h2>
              <span className="text-xs text-slate-400">Binance Futures 24h</span>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-red-500/20 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50 bg-red-500/5">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Symbol</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Price</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">24h Change</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <div className="flex items-center justify-center gap-3">
                            <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </td>
                      </tr>
                    ) : topLosers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                          No data available
                        </td>
                      </tr>
                    ) : (
                      topLosers.map((coin, idx) => (
                        <tr key={idx} className="hover:bg-red-500/5 transition-colors">
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center justify-center w-7 h-7 bg-gradient-to-br from-red-500/20 to-rose-500/20 text-red-400 rounded-full font-bold text-sm">
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-white">{coin.symbol}</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-slate-300 font-mono text-sm">
                              ${coin.last.toFixed(coin.last < 1 ? 6 : 2)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold text-sm bg-red-500/10 text-red-400 border border-red-500/20">
                              ↓ {coin.change24h.toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Link 
                              href={`/trading?symbol=${encodeURIComponent(coin.symbol)}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-red-500/20 transition-all duration-200"
                            >
                              Trade
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
