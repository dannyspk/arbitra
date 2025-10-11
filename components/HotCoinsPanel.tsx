"use client"

import React from 'react'
import Link from 'next/link'
import SocialTractionPredictions from './SocialTractionPredictions'
import VolumeSurgeDetector from './VolumeSurgeDetector'
import BreakoutScanner from './BreakoutScanner'
import FundingDivergence from './FundingDivergence'
import CompositeMoverScore from './CompositeMoverScore'
import ReversalDetection from './ReversalDetection'

function useHotCoins() {
  const [hot, setHot] = React.useState<any[]>([])
  React.useEffect(() => {
    // Get backend URL from environment variable
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
    const url = new URL(apiUrl)
    const proto = (url.protocol === 'https:') ? 'wss:' : 'ws:'
    const wsUrl = `${proto}//${url.host}/ws/hotcoins`
    
    const ws = new WebSocket(wsUrl)
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        if (Array.isArray(data)) setHot(data)
      } catch (e) {
        // ignore
      }
    }
    ws.onopen = () => console.debug('hotcoins ws open')
    ws.onclose = () => console.debug('hotcoins ws close')
    return () => ws.close()
  }, [])
  return hot
}

export default function HotCoinsPanel() {
  const hot = useHotCoins()
  const [view, setView] = React.useState<'table' | 'predictions' | 'surges' | 'breakouts' | 'funding' | 'composite' | 'reversals'>('table')
  const [sortByChangeDesc, setSortByChangeDesc] = React.useState<boolean | null>(null)
  const [sortByVolDesc, setSortByVolDesc] = React.useState<boolean | null>(null)
  const [volMap, setVolMap] = React.useState<Record<string, { volatility?: number; ewma_volatility?: number }>>({})
  const [minVolFilterPct, setMinVolFilterPct] = React.useState<number>(0) // percent, 0 = no filter
  const [marketCapMap, setMarketCapMap] = React.useState<Record<string, number>>({})

  // helper: compute raw volatility value for a hot row using volMap matching logic
  const getVolForHot = (h: any): number | null => {
    try {
      const norm = (s: string | undefined | null) => (String(s || '')).toUpperCase().replace(/[^A-Z0-9]/g, '')
      const candidates: string[] = []
      if (h.symbol) candidates.push(norm(h.symbol))
      const base = (h.base || '') as string
      const commonQuotes = ['USDT', 'USDC', 'BUSD', 'BTC', 'ETH', 'USD']
      if (base) {
        for (const q of commonQuotes) {
          candidates.push(norm(base + q))
          candidates.push(norm(base + '/' + q))
          candidates.push(norm(base + '_' + q))
        }
        candidates.push(norm(base))
      }
      let foundKey: string | null = null
      for (const c of candidates) {
        if (!c) continue
        if (volMap[c]) { foundKey = c; break }
      }
      if (!foundKey && base) {
        const baseNorm = norm(base)
        const keys = Object.keys(volMap).filter(k => k.includes(baseNorm))
        if (keys.length > 0) {
          keys.sort((a, b) => a.length - b.length)
          foundKey = keys[0]
        }
      }
      if (!foundKey) return null
      const found = volMap[foundKey]
      const v = found?.volatility ?? found?.ewma_volatility ?? null
      if (v == null) return null
      return Number(v)
    } catch (e) { return null }
  }

  // helper: compute volatility as percentage number (e.g. 100.0 for 100%) for sorting/filtering
  const getVolPctForHot = (h: any): number | null => {
    const v = getVolForHot(h)
    if (v == null) return null
    try {
      const n = Number(v)
      if (isNaN(n)) return null
      // backend uses raw volatility; if it's small (<5) it's treated as fraction (e.g. 1.23 -> 123%)
      return (n > 0 && n < 5) ? (n * 100) : n
    } catch (e) { return null }
  }

  React.useEffect(() => {
    let mounted = true
    const base = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')) || 'http://localhost:8000'

    async function fetchVolIndex() {
      try {
        const res = await fetch(`${base}/api/hotcoins/vol_index?limit=200`)
        if (!res.ok) return
        const data = await res.json()
        if (!mounted) return
        const rows = Array.isArray(data) ? data : (Array.isArray((data || {}).items) ? data.items : [])
        if (!rows || !Array.isArray(rows)) return
        const map: Record<string, { volatility?: number; ewma_volatility?: number }> = {}
        for (const r of rows) {
          try {
            const sym = String(r.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
            if (!sym) continue
            map[sym] = { volatility: r.volatility, ewma_volatility: r.ewma_volatility }
          } catch (e) { continue }
        }
        if (mounted) setVolMap(map)
      } catch (e) {
        // ignore
      }
    }

    fetchVolIndex()
    const id = setInterval(fetchVolIndex, 60_000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  // Fetch market cap data from CoinGecko as fallback with localStorage caching
  React.useEffect(() => {
    let mounted = true
    const CACHE_KEY = 'marketcap_cache'
    const CACHE_TIMESTAMP_KEY = 'marketcap_cache_timestamp'
    const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds

    // Load from cache on mount
    const loadFromCache = () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY)
        const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
        
        if (cached && timestamp) {
          const age = Date.now() - parseInt(timestamp, 10)
          if (age < CACHE_DURATION) {
            const map = JSON.parse(cached)
            console.debug('Loaded market caps from cache:', map)
            setMarketCapMap(map)
            return true
          }
        }
      } catch (e) {
        console.debug('Failed to load market cap cache:', e)
      }
      return false
    }

    async function fetchMarketCaps() {
      if (!hot || hot.length === 0) return
      
      try {
        // Extract unique base currencies
        const symbols = Array.from(new Set(
          hot.map((h: any) => {
            const base = String(h.base || h.symbol || '').toUpperCase()
            // Remove common quote currencies from symbol
            return base.replace(/USDT|USDC|BUSD|USD|BTC|ETH$/i, '')
          }).filter(Boolean)
        )).slice(0, 100) // Limit to 100 symbols

        if (symbols.length === 0) return

        // Use CoinGecko markets endpoint with symbol filtering
        const symbolsParam = symbols.join(',').toLowerCase()
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&symbols=${symbolsParam}&order=market_cap_desc&per_page=250&sparkline=false`
        
        console.debug('Fetching market caps for:', symbols)
        
        const res = await fetch(url)
        if (!res.ok) {
          console.debug('CoinGecko API error:', res.status)
          return
        }

        const data = await res.json()
        if (!mounted) return

        console.debug('CoinGecko response:', data)

        const map: Record<string, number> = {}
        if (Array.isArray(data)) {
          for (const coin of data) {
            const sym = String(coin.symbol || '').toUpperCase()
            if (coin.market_cap && sym) {
              map[sym] = coin.market_cap
              console.debug(`Mapped ${sym} -> ${coin.market_cap}`)
            }
          }
        }
        
        console.debug('Final marketCapMap:', map)
        
        // Save to cache
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(map))
          localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
          console.debug('Saved market caps to cache')
        } catch (e) {
          console.debug('Failed to save market cap cache:', e)
        }
        
        if (mounted) setMarketCapMap(map)
      } catch (e) {
        console.error('Failed to fetch market caps:', e)
      }
    }

    // Try to load from cache first
    const cacheLoaded = loadFromCache()
    
    // Fetch fresh data if cache is old/missing or after component mounts
    if (!cacheLoaded) {
      fetchMarketCaps()
    }
    
    // Set up periodic refresh every 5 minutes
    const id = setInterval(fetchMarketCaps, CACHE_DURATION)
    return () => { mounted = false; clearInterval(id) }
  }, [hot])

  // Helper to get market cap with fallback
  const getMarketCap = (h: any): number | null => {
    // First try from WebSocket data
    if (h.marketCap) return Number(h.marketCap)
    
    // Fallback to our fetched data
    const base = String(h.base || h.symbol || '').toUpperCase().replace(/USDT|USDC|BUSD|USD|BTC|ETH$/i, '')
    console.debug(`Looking up market cap for ${h.symbol}, base: ${base}, available:`, Object.keys(marketCapMap))
    
    if (base && marketCapMap[base]) {
      console.debug(`Found market cap for ${base}: ${marketCapMap[base]}`)
      return marketCapMap[base]
    }
    
    console.debug(`No market cap found for ${base}`)
    return null
  }

  if (!hot || hot.length === 0) {
    return (
      <div className="mb-6 p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-700/50">
        <div className="text-sm text-slate-400 flex items-center gap-2">
          <span className="animate-pulse">⚡</span>
          <span>No hot coins currently detected.</span>
        </div>
      </div>
    )
  }
  return (
    <div className="mb-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
      {/* Header with gradient overlay */}
      <div className="relative bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 backdrop-blur-sm border-b border-slate-700/50">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 animate-pulse"></div>
        <div className="relative p-3 sm:p-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="h-8 sm:h-10 w-1 bg-gradient-to-b from-cyan-400 via-blue-400 to-purple-400 rounded-full"></div>
              <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                Market Signals
              </h3>
            </div>
            
            {/* Tab Navigation - Full width on mobile with better spacing */}
            <div className="w-full overflow-x-auto scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
              <div className="flex gap-2 bg-slate-800/50 backdrop-blur-sm rounded-xl p-2 border border-slate-700/50 min-w-max">
                <button 
                  onClick={() => setView('composite')} 
                  className={`px-3 py-2 rounded-lg font-medium text-xs transition-all duration-200 whitespace-nowrap ${
                    view === 'composite' 
                      ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white shadow-lg shadow-pink-500/50' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  🎯 Composite
                </button>
                
                <button 
                  onClick={() => setView('predictions')} 
                  className={`px-3 py-2 rounded-lg font-medium text-xs transition-all duration-200 whitespace-nowrap ${
                    view === 'predictions' 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/50' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  💎 Gems
                </button>
                
                <button 
                  onClick={() => setView('surges')} 
                  className={`px-3 py-2 rounded-lg font-medium text-xs transition-all duration-200 whitespace-nowrap ${
                    view === 'surges' 
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/50' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  🔥 Volume
                </button>
                
                <button 
                  onClick={() => setView('breakouts')} 
                  className={`px-3 py-2 rounded-lg font-medium text-xs transition-all duration-200 whitespace-nowrap ${
                    view === 'breakouts' 
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/50' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  💥 Breakouts
                </button>
                
                <button 
                  onClick={() => setView('funding')} 
                  className={`px-3 py-2 rounded-lg font-medium text-xs transition-all duration-200 whitespace-nowrap ${
                    view === 'funding' 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/50' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  💰 Funding
                </button>
                
                <button 
                  onClick={() => setView('reversals')} 
                  className={`px-3 py-2 rounded-lg font-medium text-xs transition-all duration-200 whitespace-nowrap ${
                    view === 'reversals' 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/50' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  🔄 Reversals
                </button>
              </div>
            </div>
          </div>
          
          {/* Filter Controls - only show for table view */}
          {view === 'table' && (
            <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 bg-slate-800/30 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-slate-700/30">
              <svg className="w-4 h-4 text-slate-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <label className="text-xs sm:text-sm font-medium text-slate-300">Minimum Volatility:</label>
              <select 
                className="w-full sm:w-auto px-3 py-1.5 bg-slate-700/50 text-slate-200 border border-slate-600/50 rounded-lg text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all cursor-pointer" 
                value={String(minVolFilterPct)} 
                onChange={(e) => setMinVolFilterPct(Number(e.target.value))}
              >
                <option value={0}>Any</option>
                <option value={25}>25%</option>
                <option value={50}>50%</option>
                <option value={100}>100%</option>
                <option value={200}>200%</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Social Traction Predictions */}
      {view === 'predictions' && (
        <div className="p-3 sm:p-6">
          <SocialTractionPredictions />
        </div>
      )}

      {/* Volume Surge Detection */}
      {view === 'surges' && (
        <div className="p-3 sm:p-6">
          <VolumeSurgeDetector />
        </div>
      )}

      {/* Breakout Scanner */}
      {view === 'breakouts' && (
        <div className="p-3 sm:p-6">
          <BreakoutScanner />
        </div>
      )}

      {/* Funding Divergence */}
      {view === 'funding' && (
        <div className="p-3 sm:p-6">
          <FundingDivergence />
        </div>
      )}

      {/* Reversal Detection */}
      {view === 'reversals' && (
        <div className="p-3 sm:p-6">
          <ReversalDetection />
        </div>
      )}

      {/* Composite Big Mover Score */}
      {view === 'composite' && (
        <div className="p-3 sm:p-6">
          <CompositeMoverScore />
        </div>
      )}

      {view === 'table' && (
        <div className="p-3 sm:p-6 overflow-auto">
          <table className="w-full table-auto min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Pair</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Price</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">24h Volume</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Market Cap</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <button 
                    className="flex items-center gap-1 sm:gap-2 ml-auto hover:text-cyan-400 transition-colors" 
                    onClick={() => {
                      if (sortByChangeDesc === null) setSortByChangeDesc(true)
                      else if (sortByChangeDesc === true) setSortByChangeDesc(false)
                      else setSortByChangeDesc(null)
                    }}
                  >
                    <span className="hidden sm:inline">24h Change</span>
                    <span className="sm:hidden">Change</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path 
                        d="M6 9l6 6 6-6" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        transform={sortByChangeDesc === null ? '' : (sortByChangeDesc ? 'rotate(0 12 12)' : 'rotate(180 12 12)')} 
                      />
                    </svg>
                  </button>
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">
                  <button 
                    className="flex items-center gap-1 sm:gap-2 ml-auto hover:text-cyan-400 transition-colors" 
                    onClick={() => {
                      if (sortByVolDesc === null) setSortByVolDesc(true)
                      else if (sortByVolDesc === true) setSortByVolDesc(false)
                      else setSortByVolDesc(null)
                    }}
                  >
                    <span>Volatility</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path 
                        d="M6 9l6 6 6-6" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        transform={sortByVolDesc === null ? '' : (sortByVolDesc ? 'rotate(0 12 12)' : 'rotate(180 12 12)')} 
                      />
                    </svg>
                  </button>
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Rank</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {(() => {
                let list = hot.slice(0, 4)
                // apply min-vol filter first
                if (minVolFilterPct > 0) {
                  list = list.filter((it: any) => {
                    const vp = getVolPctForHot(it)
                    if (vp == null) return false
                    return vp >= minVolFilterPct
                  })
                }

                if (sortByChangeDesc !== null) {
                  list = [...list].sort((a: any, b: any) => {
                    const va = (a && typeof a.change24h === 'number') ? a.change24h : (a && a.change24h ? Number(a.change24h) : 0)
                    const vb = (b && typeof b.change24h === 'number') ? b.change24h : (b && b.change24h ? Number(b.change24h) : 0)
                    return sortByChangeDesc ? (vb - va) : (va - vb)
                  })
                } else if (sortByVolDesc !== null) {
                  // sort by Vol according to toggle
                  list = [...list].sort((a: any, b: any) => {
                    const va = getVolPctForHot(a)
                    const vb = getVolPctForHot(b)
                    if (va == null && vb == null) return 0
                    if (va == null) return 1
                    if (vb == null) return -1
                    return sortByVolDesc ? (vb - va) : (va - vb)
                  })
                } else {
                  // default: sort by Vol (descending). Items without Vol appear at the end.
                  list = [...list].sort((a: any, b: any) => {
                    const va = getVolForHot(a)
                    const vb = getVolForHot(b)
                    if (va == null && vb == null) return 0
                    if (va == null) return 1
                    if (vb == null) return -1
                    return vb - va
                  })
                }
                return list.map((h, i) => (
                <tr key={i} className="group hover:bg-slate-800/50 transition-colors">
                  <td className="px-2 sm:px-4 py-3 sm:py-4">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-xs font-bold text-cyan-400">
                        {h.base?.substring(0, 2) || '??'}
                      </div>
                      <div>
                        <div className="font-semibold text-white text-sm sm:text-base">{h.base}</div>
                        <div className="text-xs text-slate-500">/ USDT</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 text-right">
                    <span className="font-mono text-white font-medium text-xs sm:text-sm">
                      {h.last ? Number(h.last).toLocaleString(undefined, { maximumFractionDigits: 8 }) : '—'}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 text-right hidden sm:table-cell">
                    <span className="text-slate-300 font-medium text-xs sm:text-sm">
                      ${h.quoteVolume ? (Number(h.quoteVolume) / 1e6).toFixed(2) + 'M' : '0'}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 text-right hidden lg:table-cell">
                    <span className="text-slate-300 font-medium text-xs sm:text-sm">
                      {(() => {
                        const mc = getMarketCap(h)
                        return mc ? '$' + (mc / 1e6).toFixed(1) + 'M' : '—'
                      })()}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 text-right">
                    <div className={`inline-flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full font-bold text-xs sm:text-sm ${
                      h.change24h && h.change24h > 0 
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                        : (h.change24h && h.change24h < 0 
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                          : 'bg-slate-700/30 text-slate-400 border border-slate-600/20')
                    }`}>
                      {h.change24h && h.change24h > 0 ? '↑' : (h.change24h && h.change24h < 0 ? '↓' : '')}
                      {h.change24h != null ? Math.abs(Number(h.change24h)).toFixed(2) + '%' : '—'}
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 text-right hidden md:table-cell">
                    <span className="text-purple-400 font-semibold text-xs sm:text-sm">{(() => {
                    try {
                      const norm = (s: string | undefined | null) => (String(s || '')).toUpperCase().replace(/[^A-Z0-9]/g, '')
                      const candidates: string[] = []
                      // direct symbol if provided
                      if (h.symbol) candidates.push(norm(h.symbol))
                      // try base combined with common quote suffixes
                      const base = (h.base || '') as string
                      const commonQuotes = ['USDT', 'USDC', 'BUSD', 'BTC', 'ETH', 'USD']
                      if (base) {
                        for (const q of commonQuotes) {
                          candidates.push(norm(base + q))
                          candidates.push(norm(base + '/' + q))
                          candidates.push(norm(base + '_' + q))
                        }
                        // also try plain base
                        candidates.push(norm(base))
                      }

                      let foundKey: string | null = null
                      for (const c of candidates) {
                        if (!c) continue
                        if (volMap[c]) { foundKey = c; break }
                      }

                      // fallback: scan volMap keys for partial matches (prefer shortest)
                      if (!foundKey && base) {
                        const baseNorm = norm(base)
                        const keys = Object.keys(volMap).filter(k => k.includes(baseNorm))
                        if (keys.length > 0) {
                          keys.sort((a, b) => a.length - b.length)
                          foundKey = keys[0]
                        }
                      }

                      if (!foundKey) return '—'
                      const found = volMap[foundKey]
                      const v = found?.volatility ?? found?.ewma_volatility ?? null
                      if (v == null) return '—'
                      if (v > 0 && v < 5) return (v * 100).toFixed(2) + '%'
                      return Number(v).toFixed(2)
                    } catch (e) { return '—' }
                  })()}</span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 text-center hidden lg:table-cell">
                    <span className="px-2 py-1 bg-slate-700/30 rounded-lg text-slate-400 text-xs sm:text-sm font-medium">
                      #{h.rank}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4">
                    {h.symbol ? (
                      <div className="flex gap-1 sm:gap-2 justify-center">
                        <Link 
                          href={`/trading?symbol=${encodeURIComponent(String(h.symbol))}&market=spot`} 
                          className="px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold transition-all duration-200 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40"
                        >
                          Spot
                        </Link>
                        <Link 
                          href={`/trading?symbol=${encodeURIComponent(String(h.symbol))}&market=futures`} 
                          className="px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-xs font-semibold transition-all duration-200 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40"
                        >
                          Futures
                        </Link>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-xs">—</span>
                    )}
                  </td>
                </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
