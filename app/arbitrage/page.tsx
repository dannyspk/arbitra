'use client'

import React from 'react'

interface FundingOpportunity {
  symbol: string
  fundingRate: number
  fundingRatePct: string
  nextFundingTime: string
  markPrice: number
  annualizedRate: number
  estimatedIncome3d: number
  profitability: 'high' | 'medium' | 'low'
}

interface SpotOpportunity {
  symbol: string
  buy_exchange: string
  buy_price: number
  buy_volume: number
  buy_withdraw_enabled: boolean
  sell_exchange: string
  sell_price: number
  sell_volume: number
  sell_deposit_enabled: boolean
  spread_pct: number
  avg_price: number
  total_volume: number
  exchanges_available: number
  is_executable: boolean
  profitability: 'high' | 'medium' | 'low'
  // PnL fields for $100 trade
  net_profit_usd: number
  roi_percent: number
  trading_fees_usd: number
  withdrawal_fee_usd: number
  slippage_cost_usd: number
  is_profitable_after_fees: boolean
}

export default function ArbitragePage() {
  const [opportunities, setOpportunities] = React.useState<FundingOpportunity[]>([])
  const [spotOpportunities, setSpotOpportunities] = React.useState<SpotOpportunity[]>([])
  const [loading, setLoading] = React.useState(true)
  const [spotLoading, setSpotLoading] = React.useState(false)
  const [sortBy, setSortBy] = React.useState<'rate' | 'annual'>('rate')
  const [filterBy, setFilterBy] = React.useState<'all' | 'positive' | 'negative'>('all')
  const [totalSymbolsScanned, setTotalSymbolsScanned] = React.useState(0)

  React.useEffect(() => {
    fetchFundingOpportunities()
    const interval = setInterval(fetchFundingOpportunities, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  async function fetchFundingOpportunities() {
    try {
      setLoading(true)
      let backend = ''
      try {
        const hn = location.hostname
        const p = location.port
        if ((hn === 'localhost' || hn === '127.0.0.1') && p === '3000') {
          backend = 'http://127.0.0.1:8000'
        }
      } catch (e) {}
      
      const res = await fetch(`${backend}/api/preview-top`)
      if (!res.ok) throw new Error('Failed to fetch')
      
      const data = await res.json()
      
      // Fetch current prices from Binance
      const priceRes = await fetch('https://fapi.binance.com/fapi/v1/ticker/price')
      const priceData = await priceRes.json()
      const priceMap = new Map(priceData.map((p: any) => [p.symbol, parseFloat(p.price)]))
      
      // Transform the data to match our interface
      const transformed = (data.preview_candidates_top || data.candidates || []).map((item: any) => {
        const symbol = item.symbol || item.bin_symbol || ''
        const fundingRate = item.funding_rate_pct ? item.funding_rate_pct / 100 : 0
        const annualizedRate = item.apr_pct || (fundingRate * 3 * 365 * 100) // 3 times per day
        
        // Get actual current price from Binance
        const markPrice = priceMap.get(symbol) || 0
        
        // Use revenue_usdt from backend which is calculated for 3 days
        // Backend formula: abs(total_funding_rate) * notional / 2.0
        const estimatedIncome3d = item.revenue_usdt || 0
        
        // Convert next_funding_time from Unix timestamp (ms) to ISO string
        let nextFundingTime: string
        if (item.next_funding_time) {
          nextFundingTime = new Date(item.next_funding_time).toISOString()
        } else {
          nextFundingTime = new Date(Date.now() + 8 * 3600000).toISOString()
        }
        
        return {
          symbol,
          fundingRate,
          fundingRatePct: (fundingRate * 100).toFixed(4) + '%',
          nextFundingTime,
          markPrice,
          annualizedRate,
          estimatedIncome3d,
          profitability: Math.abs(fundingRate) > 0.0008 ? 'high' : Math.abs(fundingRate) > 0.0004 ? 'medium' : 'low'
        }
      })
      
      setOpportunities(transformed)
    } catch (e) {
      console.error('Failed to fetch funding opportunities:', e)
      // Generate mock data for demo
      generateMockData()
    } finally {
      setLoading(false)
    }
  }

  function generateMockData() {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ARBUSDT', 'OPUSDT', 'MATICUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT', 'UNIUSDT']
    const mockData = symbols.map(symbol => {
      const fundingRate = (Math.random() - 0.5) * 0.002 // -0.1% to +0.1%
      const annualizedRate = fundingRate * 3 * 365 * 100 // 3 times per day, annualized
      const cumulativeFundingRate = fundingRate * 3 * 3 // 3 payments per day * 3 days
      const profitability: 'high' | 'medium' | 'low' = Math.abs(fundingRate) > 0.0008 ? 'high' : Math.abs(fundingRate) > 0.0004 ? 'medium' : 'low'
      return {
        symbol,
        fundingRate,
        fundingRatePct: (fundingRate * 100).toFixed(4) + '%',
        nextFundingTime: new Date(Date.now() + Math.random() * 8 * 3600000).toISOString(),
        markPrice: 1000 + Math.random() * 50000,
        annualizedRate,
        estimatedIncome3d: Math.abs(cumulativeFundingRate) * 10000 / 2, // 3-day revenue with $10k position
        profitability
      }
    })
    setOpportunities(mockData)
  }

  async function fetchSpotArbitrage() {
    try {
      setSpotLoading(true)
      let backend = ''
      try {
        const hn = location.hostname
        const p = location.port
        if ((hn === 'localhost' || hn === '127.0.0.1') && p === '3000') {
          backend = 'http://127.0.0.1:8000'
        }
      } catch (e) {}
      
      const res = await fetch(`${backend}/api/spot-arbitrage`)
      if (!res.ok) throw new Error('Failed to fetch')
      
      const data = await res.json()
      // Filter out blocked opportunities (only show executable ones)
      // Sort by net PnL (highest first), then by volume
      const filtered = (data.opportunities || [])
        .filter((opp: SpotOpportunity) => opp.is_executable)
        .sort((a: SpotOpportunity, b: SpotOpportunity) => {
          const pnlDiff = (b.net_profit_usd || 0) - (a.net_profit_usd || 0)
          if (Math.abs(pnlDiff) > 0.01) return pnlDiff
          return (b.total_volume || 0) - (a.total_volume || 0)
        })
      setSpotOpportunities(filtered)
      setTotalSymbolsScanned(data.total_symbols_scanned || 0)
    } catch (e) {
      console.error('Failed to fetch spot arbitrage:', e)
      setSpotOpportunities([])
    } finally {
      setSpotLoading(false)
    }
  }

  const filteredOpps = React.useMemo(() => {
    // Only show positive funding rates (executable strategy: SHORT futures + LONG spot)
    let filtered = opportunities.filter(o => o.fundingRate > 0)
    
    // Sort by absolute rate (most lucrative first)
    filtered.sort((a, b) => {
      if (sortBy === 'rate') {
        return b.fundingRate - a.fundingRate
      } else {
        return b.annualizedRate - a.annualizedRate
      }
    })
    
    return filtered
  }, [opportunities, sortBy])

  return (
    <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="p-6">
        <header className="mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
            Arbitrage Opportunities
          </h1>
          <p className="text-slate-400">Cross-exchange spot arbitrage and funding rate opportunities</p>
        </header>

        {/* Spot Arbitrage Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Spot Market Arbitrage
            </h2>
            <button
              onClick={fetchSpotArbitrage}
              disabled={spotLoading}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-medium shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {spotLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Scanning...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Scan Now
                </>
              )}
            </button>
          </div>

          {/* Explanation */}
          <div className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-red-500/10 rounded-xl p-4 border border-purple-500/30 mb-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-slate-300">
                <strong className="text-purple-400">Cross-Exchange Spot Arbitrage</strong>
                <p className="mt-1 text-slate-400">
                  Find price differences for the same trading pairs across Binance, MEXC, Gate.io, KuCoin, and Bitget. 
                  Buy on the exchange with the lowest price and sell on the exchange with the highest price to capture the spread.
                  <strong className="text-white"> Status Check:</strong> Automatically verifies deposit/withdrawal status across all 5 exchanges (cached for 1 hour).
                  Only actively trading pairs with {'>'} $10k daily volume and {'>'} 0.5% spread are shown.
                  <strong className="text-green-400"> ✓ Full Coverage:</strong> All exchanges checked with API authentication.
                </p>
              </div>
            </div>
          </div>

          {/* Spot Opportunities Table */}
          {spotOpportunities.length > 0 && (
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden mb-4">
              <div className="p-4 border-b border-slate-700/50 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-300">
                    Found <span className="font-bold text-purple-400">{spotOpportunities.length}</span> opportunities 
                    from <span className="font-bold text-cyan-400">{totalSymbolsScanned}</span> symbols scanned
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">Binance</span>
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded border border-green-500/30">MEXC</span>
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">Gate.io</span>
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded border border-purple-500/30">KuCoin</span>
                    <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded border border-orange-500/30">Bitget</span>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-b border-slate-700">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Symbol</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Buy From</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Buy Price</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Sell To</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Sell Price</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Spread</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Net PnL ($100)</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">ROI</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {spotOpportunities.slice(0, 20).map((opp, idx) => (
                      <tr key={`${opp.symbol}-${idx}`} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{opp.symbol}</span>
                            {opp.profitability === 'high' && (
                              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-bold rounded-full border border-purple-500/30">
                                HIGH
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-1 text-xs font-semibold rounded ${
                              opp.buy_exchange === 'Binance' ? 'bg-amber-500/20 text-amber-400' :
                              opp.buy_exchange === 'MEXC' ? 'bg-green-500/20 text-green-400' :
                              opp.buy_exchange === 'Gate.io' ? 'bg-blue-500/20 text-blue-400' :
                              opp.buy_exchange === 'KuCoin' ? 'bg-purple-500/20 text-purple-400' :
                              'bg-orange-500/20 text-orange-400'
                            }`}>
                              {opp.buy_exchange}
                            </span>
                            {opp.buy_withdraw_enabled === false && (
                              <span className="text-[10px] text-red-400">⚠️ Withdraw Off</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-green-400 font-semibold">
                          ${opp.buy_price.toFixed(4)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-1 text-xs font-semibold rounded ${
                              opp.sell_exchange === 'Binance' ? 'bg-amber-500/20 text-amber-400' :
                              opp.sell_exchange === 'MEXC' ? 'bg-green-500/20 text-green-400' :
                              opp.sell_exchange === 'Gate.io' ? 'bg-blue-500/20 text-blue-400' :
                              opp.sell_exchange === 'KuCoin' ? 'bg-purple-500/20 text-purple-400' :
                              'bg-orange-500/20 text-orange-400'
                            }`}>
                              {opp.sell_exchange}
                            </span>
                            {opp.sell_deposit_enabled === false && (
                              <span className="text-[10px] text-red-400">⚠️ Deposit Off</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-red-400 font-semibold">
                          ${opp.sell_price.toFixed(4)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`font-bold text-lg ${
                            opp.spread_pct > 2 ? 'text-purple-400' :
                            opp.spread_pct > 1 ? 'text-cyan-400' :
                            'text-slate-300'
                          }`}>
                            +{opp.spread_pct.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`font-bold ${
                              opp.net_profit_usd > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              ${opp.net_profit_usd.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Fees: ${(opp.trading_fees_usd + opp.withdrawal_fee_usd + opp.slippage_cost_usd).toFixed(2)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`font-bold text-lg ${
                            opp.roi_percent > 1 ? 'text-green-400' :
                            opp.roi_percent > 0 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {opp.roi_percent > 0 ? '+' : ''}{opp.roi_percent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {opp.is_executable && opp.is_profitable_after_fees ? (
                            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full border border-green-500/30 inline-flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Profitable
                            </span>
                          ) : !opp.is_executable ? (
                            <span className="px-3 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-full border border-red-500/30 inline-flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Blocked
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full border border-yellow-500/30 inline-flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Unprofitable
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {spotOpportunities.length === 0 && !spotLoading && (
            <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 p-12 text-center">
              <div className="text-slate-500 mb-4">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Click "Scan Now" to find spot arbitrage opportunities across exchanges
              </div>
            </div>
          )}
        </div>

        {/* Funding Rate Arbitrage Section */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
            Funding Rate Arbitrage
          </h2>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <div className="text-xs text-slate-500">Total Opportunities</div>
                <div className="text-2xl font-bold text-white">{filteredOpps.length}</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="text-xs text-slate-500">Executable Opportunities</div>
                <div className="text-2xl font-bold text-green-400">{opportunities.filter(o => o.fundingRate > 0).length}</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div>
                <div className="text-xs text-slate-500">Avg Rate (Top 5)</div>
                <div className="text-2xl font-bold text-cyan-400">
                  {filteredOpps.length > 0 ? `+${(filteredOpps.slice(0, 5).reduce((sum, o) => sum + o.fundingRate, 0) / Math.min(5, filteredOpps.length) * 100).toFixed(3)}%` : '0%'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <div className="text-xs text-slate-500">High Profit</div>
                <div className="text-2xl font-bold text-purple-400">{opportunities.filter(o => o.profitability === 'high').length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Explanation Card */}
        <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-cyan-500/30 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-slate-300">
              <strong className="text-cyan-400">What is Funding Rate Arbitrage?</strong>
              <p className="mt-1 text-slate-400">
                Funding rates are periodic payments between long and short traders in perpetual futures (paid every 8 hours). 
                <strong className="text-green-400"> Positive rates (shown below):</strong> Longs pay shorts (bullish sentiment) - profit by <strong className="text-white">SHORT futures + LONG spot</strong>. 
                This strategy is easily executable since you can buy spot with cash on any exchange.
                <strong className="text-yellow-400"> ⚠️ Note:</strong> Negative rate arbitrage requires margin trading to short spot (not shown here).
                Estimated revenue shows potential 3-day earnings based on current funding rates.
              </p>
            </div>
          </div>
        </div>

        {/* Filters and Sort */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden mb-6">
          <div className="p-4 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters & Sort
              </h3>
              <button
                onClick={fetchFundingOpportunities}
                disabled={loading}
                className="text-xs px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <svg className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
          
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs text-slate-400 block mb-2">Sort by</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSortBy('rate')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      sortBy === 'rate'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Current Rate
                  </button>
                  <button
                    onClick={() => setSortBy('annual')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      sortBy === 'annual'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Annual Rate
                  </button>
                </div>
              </div>
              <div className="text-xs text-green-400 bg-green-500/10 px-3 py-2 rounded-lg border border-green-500/30">
                ✓ Showing positive rates only (executable strategy)
              </div>
            </div>
          </div>
        </div>

        {/* Opportunities Table */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-b border-slate-700">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Symbol</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Mark Price</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Funding Rate</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Annualized</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Est. Revenue (3d)</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Strategy</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Next Funding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {loading && filteredOpps.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-3 text-slate-400">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400"></div>
                        Loading opportunities...
                      </div>
                    </td>
                  </tr>
                ) : filteredOpps.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No positive funding rate opportunities found
                    </td>
                  </tr>
                ) : (
                  filteredOpps.slice(0, 5).map((opp) => (
                    <tr key={opp.symbol} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{opp.symbol}</span>
                          {opp.profitability === 'high' && (
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-bold rounded-full border border-purple-500/30">
                              HIGH
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-white">
                        ${opp.markPrice.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-lg text-green-400">
                          +{(opp.fundingRate * 100).toFixed(4)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-semibold ${opp.annualizedRate > 30 ? 'text-purple-400' : 'text-slate-300'}`}>
                          +{opp.annualizedRate.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-cyan-400">
                        ${opp.estimatedIncome3d.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          <span className="px-3 py-1 bg-green-500/10 text-green-400 text-xs font-semibold rounded-full border border-green-500/30">
                            SHORT Futures + LONG Spot
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-xs text-slate-400">
                        {new Date(opp.nextFundingTime).toLocaleTimeString()}
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
  )
}
