"use client"

import React from 'react'
import Link from 'next/link'

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
  const [view, setView] = React.useState<'cards' | 'table'>('cards')
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
        <div className="relative p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-1 bg-gradient-to-b from-cyan-400 via-blue-400 to-purple-400 rounded-full"></div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Market Overview
                </h3>
                <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 text-xs font-semibold rounded-full border border-cyan-500/30">
                  LIVE
                </span>
              </div>
              <div className="text-sm text-slate-400 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Top by 24h volume (USDT spot) excluding top market-cap coins
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50">
                <div className="text-xs text-slate-500 uppercase tracking-wider">Active Markets</div>
                <div className="text-xl font-bold text-white">{hot.length}</div>
              </div>
              <div className="flex gap-2 bg-slate-800/50 backdrop-blur-sm rounded-xl p-1 border border-slate-700/50">
                <button 
                  onClick={() => setView('cards')} 
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    view === 'cards' 
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/50' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    Cards
                  </span>
                </button>
                <button 
                  onClick={() => setView('table')} 
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    view === 'table' 
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/50' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    Table
                  </span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Filter Controls */}
          <div className="mt-4 flex items-center gap-3 bg-slate-800/30 backdrop-blur-sm rounded-lg p-3 border border-slate-700/30">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <label className="text-sm font-medium text-slate-300">Minimum Volatility:</label>
            <select 
              className="px-3 py-1.5 bg-slate-700/50 text-slate-200 border border-slate-600/50 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all cursor-pointer" 
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
        </div>
      </div>

      {view === 'cards' ? (
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {hot.slice(0, 20).map((h, i) => (
            <div 
              key={i} 
              className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/10 hover:-translate-y-1"
            >
              {/* Glow effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-purple-500/0 group-hover:from-cyan-500/5 group-hover:to-purple-500/5 rounded-xl transition-all duration-300"></div>
              
              <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-bold text-white text-lg">{h.base}</div>
                    <div className="text-xs text-slate-400">/ USDT</div>
                  </div>
                  <div className="px-2 py-0.5 bg-slate-700/50 rounded text-xs text-slate-400">
                    #{h.rank}
                  </div>
                </div>

                {/* Price */}
                <div className="mb-3 pb-3 border-b border-slate-700/50">
                  <div className="text-xs text-slate-500 mb-1">Last Price</div>
                  <div className="text-xl font-bold text-white">
                    {h.last ? Number(h.last).toLocaleString(undefined, { maximumFractionDigits: 8 }) : 'N/A'}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">24h Volume</span>
                    <span className="text-xs font-semibold text-slate-300">
                      ${h.quoteVolume ? (Number(h.quoteVolume) / 1e6).toFixed(2) + 'M' : '0'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Market Cap</span>
                    <span className="text-xs font-semibold text-slate-300">
                      {(() => {
                        const mc = getMarketCap(h)
                        return mc ? '$' + (mc / 1e6).toFixed(1) + 'M' : '—'
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">24h Change</span>
                    <span className={`text-sm font-bold flex items-center gap-1 ${
                      h.change24h && h.change24h > 0 
                        ? 'text-green-400' 
                        : (h.change24h && h.change24h < 0 ? 'text-red-400' : 'text-slate-400')
                    }`}>
                      {h.change24h && h.change24h > 0 ? '↑' : (h.change24h && h.change24h < 0 ? '↓' : '')}
                      {h.change24h != null ? Math.abs(Number(h.change24h)).toFixed(2) + '%' : '—'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-3 border-t border-slate-700/50">
                  {h.symbol ? (
                    <>
                      <Link 
                        href={`/trading?symbol=${encodeURIComponent(String(h.symbol))}&market=spot`} 
                        className="flex-1 px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold rounded-lg transition-all duration-200 text-center shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40"
                      >
                        Spot
                      </Link>
                      <Link 
                        href={`/trading?symbol=${encodeURIComponent(String(h.symbol))}&market=futures`} 
                        className="flex-1 px-3 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-semibold rounded-lg transition-all duration-200 text-center shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40"
                      >
                        Futures
                      </Link>
                    </>
                  ) : (
                    <div className="text-xs text-slate-500 text-center py-2">Not tradable</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 overflow-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Pair</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Price</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">24h Volume</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Market Cap</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <button 
                    className="flex items-center gap-2 ml-auto hover:text-cyan-400 transition-colors" 
                    onClick={() => {
                      if (sortByChangeDesc === null) setSortByChangeDesc(true)
                      else if (sortByChangeDesc === true) setSortByChangeDesc(false)
                      else setSortByChangeDesc(null)
                    }}
                  >
                    <span>24h Change</span>
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
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <button 
                    className="flex items-center gap-2 ml-auto hover:text-cyan-400 transition-colors" 
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
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Rank</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {(() => {
                let list = hot.slice(0, 20)
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
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-xs font-bold text-cyan-400">
                        {h.base?.substring(0, 2) || '??'}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{h.base}</div>
                        <div className="text-xs text-slate-500">/ USDT</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="font-mono text-white font-medium">
                      {h.last ? Number(h.last).toLocaleString(undefined, { maximumFractionDigits: 8 }) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="text-slate-300 font-medium">
                      ${h.quoteVolume ? (Number(h.quoteVolume) / 1e6).toFixed(2) + 'M' : '0'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="text-slate-300 font-medium">
                      {(() => {
                        const mc = getMarketCap(h)
                        return mc ? '$' + (mc / 1e6).toFixed(1) + 'M' : '—'
                      })()}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold text-sm ${
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
                  <td className="px-4 py-4 text-right">
                    <span className="text-purple-400 font-semibold">{(() => {
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
                  <td className="px-4 py-4 text-center">
                    <span className="px-2 py-1 bg-slate-700/30 rounded-lg text-slate-400 text-sm font-medium">
                      #{h.rank}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {h.symbol ? (
                      <div className="flex gap-2 justify-center">
                        <Link 
                          href={`/trading?symbol=${encodeURIComponent(String(h.symbol))}&market=spot`} 
                          className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold transition-all duration-200 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40"
                        >
                          Spot
                        </Link>
                        <Link 
                          href={`/trading?symbol=${encodeURIComponent(String(h.symbol))}&market=futures`} 
                          className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-xs font-semibold transition-all duration-200 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40"
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
