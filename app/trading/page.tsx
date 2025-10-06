'use client'

import React from 'react'
import { useSearchParams } from 'next/navigation'
import LiveDashboard from '../../components/LiveDashboard'
import SocialSentiment from '../../components/SocialSentiment'

function useHotWs() {
  const [hot, setHot] = React.useState<any[]>([])
  React.useEffect(() => {
    const proto = (location.protocol === 'https:') ? 'wss:' : 'ws:'
    let host = location.host
    try {
      const hn = location.hostname
      const p = location.port
      if ((hn === 'localhost' || hn === '127.0.0.1') && p === '3000') {
        host = hn + ':8000'
      }
    } catch (e) {}
    const url = proto + '//' + host + '/ws/hotcoins'
    const ws = new WebSocket(url)
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        if (Array.isArray(data)) setHot(data)
      } catch (e) {}
    }
    ws.onopen = () => console.debug('hotcoins ws open')
    ws.onclose = () => console.debug('hotcoins ws close')
    return () => ws.close()
  }, [])
  return hot
}

export default function TradingPage() {
  const params = useSearchParams()
  const initialSymbol = params?.get('symbol') || 'BTCUSDT'
  const initialMarket = params?.get('market') || 'spot'

  const hot = useHotWs()

  const [symbol, setSymbol] = React.useState(initialSymbol)
  const [market, setMarket] = React.useState(initialMarket)
  const [price, setPrice] = React.useState('')
  const [qty, setQty] = React.useState('')
  const [bids, setBids] = React.useState<Array<[string,string]>>([])
  const [asks, setAsks] = React.useState<Array<[string,string]>>([])
  const [bookTs, setBookTs] = React.useState<string | null>(null)
   const [bookConn, setBookConn] = React.useState<'closed'|'connecting'|'open'|'error'>('closed')
  const [execLoading, setExecLoading] = React.useState(false)
  const [execResult, setExecResult] = React.useState<any | null>(null)
  const [liveCheckLoading, setLiveCheckLoading] = React.useState(false)
  const [liveCheckResult, setLiveCheckResult] = React.useState<any | null>(null)
  
  // Live strategy state
  const [strategyRunning, setStrategyRunning] = React.useState(false)
  const [strategyMode, setStrategyMode] = React.useState<'bear' | 'bull' | 'scalp' | 'range'>('bear')
  const [strategyLoading, setStrategyLoading] = React.useState(false)
  const [strategyError, setStrategyError] = React.useState<string | null>(null)

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = React.useState<any | null>(null)
  const [aiLoading, setAiLoading] = React.useState(false)

  // Searchable dropdown state
  const [searchTerm, setSearchTerm] = React.useState('')
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false)
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  
  // All Binance Futures symbols state
  const [allBinanceSymbols, setAllBinanceSymbols] = React.useState<string[]>([])
  const [binanceSymbolsLoading, setBinanceSymbolsLoading] = React.useState(false)

  React.useEffect(() => {
    setSymbol(initialSymbol)
    setMarket(initialMarket)
  }, [initialSymbol, initialMarket])

  // Fetch all Binance Futures symbols on mount
  React.useEffect(() => {
    const fetchBinanceSymbols = async () => {
      setBinanceSymbolsLoading(true)
      try {
        const response = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo')
        const data = await response.json()
        
        if (data.symbols && Array.isArray(data.symbols)) {
          // Filter for USDT perpetual contracts that are trading
          const usdtSymbols = data.symbols
            .filter((s: any) => 
              s.status === 'TRADING' && 
              s.contractType === 'PERPETUAL' &&
              s.symbol.endsWith('USDT')
            )
            .map((s: any) => s.symbol)
            .sort()
          
          setAllBinanceSymbols(usdtSymbols)
        }
      } catch (error) {
        console.error('Failed to fetch Binance symbols:', error)
      } finally {
        setBinanceSymbolsLoading(false)
      }
    }
    
    fetchBinanceSymbols()
  }, [])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
        setSearchTerm('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsDropdownOpen(true)
      }
      return
    }

    const allFilteredSymbols = [...filteredSymbols.hot, ...filteredSymbols.all]

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < allFilteredSymbols.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && allFilteredSymbols[highlightedIndex]) {
          handleSelectSymbol(allFilteredSymbols[highlightedIndex])
        }
        break
      case 'Escape':
        setIsDropdownOpen(false)
        setSearchTerm('')
        setHighlightedIndex(-1)
        break
    }
  }

  const handleSelectSymbol = (sym: string) => {
    setSymbol(sym)
    setSearchTerm('')
    setIsDropdownOpen(false)
    setHighlightedIndex(-1)
  }

  const handleInputClick = () => {
    setIsDropdownOpen(true)
    if (inputRef.current) {
      inputRef.current.select()
    }
  }

  async function executeTest(dryRun: boolean) {
    if (!symbol) return alert('select a symbol')
    const buy_price = asks.length ? parseFloat(asks[0][0]) : undefined
    const sell_price = bids.length ? parseFloat(bids[0][0]) : undefined
    const opp = {
      buy_exchange: market === 'futures' ? 'CEX-FUT' : 'CEX-SPOT',
      sell_exchange: market === 'futures' ? 'CEX-FUT' : 'CEX-SPOT',
      symbol: symbol,
      buy_price: buy_price || 0,
      sell_price: sell_price || 0,
      profit_pct: ((sell_price || 0) - (buy_price || 0)) / ((buy_price || 1)) * 100
    }
    setExecLoading(true); setExecResult(null)
    try {
      const res = await executeTestInternal({ opportunity: opp, amount: parseFloat(qty) || 1.0, dry_run: dryRun, allow_live: false })
      setExecResult(res)
    } catch (e: any) {
      setExecResult({ error: String(e) })
    } finally {
      setExecLoading(false)
    }
  }

  async function previewHedge() {
    if (!symbol) return alert('select a symbol')
    const notional = parseFloat(qty) || 10000
    setExecLoading(true); setExecResult(null)
    try {
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      const res = await fetch(`${backend}/api/preview-hedge`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbol, notional }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || JSON.stringify(data))
      setExecResult(data)
    } catch (e: any) {
      setExecResult({ error: String(e) })
    } finally {
      setExecLoading(false)
    }
  }

  // run live-check and update component state
  async function runLiveCheckHandler() {
    setLiveCheckLoading(true)
    setLiveCheckResult(null)
    try {
      const data = await runLiveCheckInternal(symbol || undefined)
      setLiveCheckResult(data)
    } catch (e: any) {
      setLiveCheckResult({ error: String(e) })
    } finally {
      setLiveCheckLoading(false)
    }
  }

  function previewLocal() {
    const buy_price = asks.length ? parseFloat(asks[0][0]) : undefined
    const sell_price = bids.length ? parseFloat(bids[0][0]) : undefined
    const opp = { buy_exchange: 'LOCAL', sell_exchange: 'LOCAL', symbol, buy_price, sell_price }
    setExecResult({ preview: opp })
  }

  // AI Analysis fetch
  async function fetchAiAnalysis() {
    if (!symbol) return
    setAiLoading(true)
    try {
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      
      const res = await fetch(`${backend}/api/ai-analysis/${symbol}`)
      if (!res.ok) {
        setAiAnalysis(null)
        return
      }
      const data = await res.json()
      setAiAnalysis(data)
    } catch (e) {
      console.error('Failed to fetch AI analysis:', e)
      setAiAnalysis(null)
    } finally {
      setAiLoading(false)
    }
  }

  // Fetch AI analysis when symbol changes
  React.useEffect(() => {
    if (symbol) {
      fetchAiAnalysis()
    } else {
      setAiAnalysis(null)
    }
  }, [symbol])

  // Fetch funding rate analysis when symbol changes
  React.useEffect(() => {
    if (symbol) {
      previewHedge()
    } else {
      setExecResult(null)
    }
  }, [symbol])

  // Live strategy controls
  async function startStrategy() {
    if (!symbol) return alert('Please select a symbol first')
    setStrategyLoading(true)
    setStrategyError(null)
    try {
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      
      const res = await fetch(`${backend}/api/live-strategy/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbol, mode: strategyMode })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || JSON.stringify(data))
      
      if (data.started) {
        setStrategyRunning(true)
        setStrategyError(null)
      } else {
        setStrategyError(data.message || 'Failed to start strategy')
      }
    } catch (e: any) {
      setStrategyError(String(e))
    } finally {
      setStrategyLoading(false)
    }
  }

  async function stopStrategy() {
    setStrategyLoading(true)
    setStrategyError(null)
    try {
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      
      const res = await fetch(`${backend}/api/live-strategy/stop`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || JSON.stringify(data))
      
      if (data.stopped) {
        setStrategyRunning(false)
        setStrategyError(null)
      } else {
        setStrategyError(data.message || 'Failed to stop strategy')
      }
    } catch (e: any) {
      setStrategyError(String(e))
    } finally {
      setStrategyLoading(false)
    }
  }

  async function checkStrategyStatus() {
    try {
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      
      const res = await fetch(`${backend}/api/live-strategy/status`)
      const data = await res.json()
      if (res.ok && data.running !== undefined) {
        setStrategyRunning(data.running)
        if (data.symbol) setSymbol(data.symbol)
        if (data.mode) setStrategyMode(data.mode)
      }
    } catch (e) {
      // Silently fail status check
    }
  }

  // Check strategy status on mount and periodically
  React.useEffect(() => {
    checkStrategyStatus()
    const interval = setInterval(checkStrategyStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  // live order book websocket to Binance public streams (depth5)
  React.useEffect(() => {
    let ws: WebSocket | null = null
    if (!symbol) {
      setBids([]); setAsks([]); setBookTs(null)
      return
    }
    try {
  const rawSym = String(symbol)
  // normalize symbol to Binance stream format: remove separators like '/', '-', etc. and lowercase
       const sym = rawSym.replace(/[^A-Za-z0-9]/g, '').toLowerCase()
       setBookConn('connecting')
      const spotHost = 'wss://stream.binance.com:9443/ws'
      const futHost = 'wss://fstream.binance.com/ws'
      const host = market === 'futures' ? futHost : spotHost
      // depth5 stream gives top 5 levels
      const url = `${host}/${sym}@depth5@100ms`
      ws = new WebSocket(url)
       ws.onopen = () => { console.debug('orderbook ws open', url); setBookConn('open') }
       ws.onmessage = (ev) => {
         try {
           const msg = JSON.parse(ev.data)
           // possible shapes:
           // 1) raw depth: { e, E, s, U, u, b: [[price,qty],...], a: [[price,qty],...] }
           // 2) wrapped: { stream, data: { e, E, s, U, u, b, a } }
           // 3) other naming conventions
           const payload = msg.data && typeof msg.data === 'object' ? msg.data : msg
           const b = Array.isArray(payload.b) ? payload.b.slice(0, 20) : (Array.isArray(payload.bids) ? payload.bids.slice(0,20) : [])
           const a = Array.isArray(payload.a) ? payload.a.slice(0, 20) : (Array.isArray(payload.asks) ? payload.asks.slice(0,20) : [])
           setBids(b)
           setAsks(a)
           try { setBookTs(new Date(payload.E || Date.now()).toLocaleTimeString()) } catch { setBookTs(null) }
           if ((!b || b.length === 0) && (!a || a.length === 0)) {
             // debug unexpected empty payloads
             console.debug('orderbook: empty b/a payload', { symbol: rawSym, url, msg })
           }
         } catch (e) {
           console.debug('orderbook: parse error', e)
         }
       }
       ws.onerror = (ev) => { console.debug('orderbook ws error', ev); setBookConn('error'); try { ws?.close() } catch {} }
       ws.onclose = () => { console.debug('orderbook ws closed'); setBookConn('closed') }
    } catch (e) {
      setBids([]); setAsks([]); setBookTs(null)
    }
    return () => { try { ws?.close() } catch {} }
  }, [symbol, market])

  // Generate options from hot list + all Binance Futures symbols
  const symOptions = React.useMemo(() => {
    try {
      const seen = new Set<string>()
      const out: string[] = []
      
      // First, add hot coins (they appear at the top)
      for (const h of hot) {
        const s = String(h.symbol || '').toUpperCase()
        if (!s) continue
        if (seen.has(s)) continue
        seen.add(s)
        out.push(s)
      }
      
      // Then add all Binance Futures symbols (not already in hot list)
      for (const s of allBinanceSymbols) {
        if (!seen.has(s)) {
          seen.add(s)
          out.push(s)
        }
      }
      
      return out
    } catch {
      return []
    }
  }, [hot, allBinanceSymbols])

  // Filter symbols based on search term and separate hot vs all
  const filteredSymbols = React.useMemo(() => {
    const hotSymbolsSet = new Set(hot.map(h => String(h.symbol || '').toUpperCase()))
    
    if (!searchTerm) {
      return {
        hot: symOptions.filter(s => hotSymbolsSet.has(s)),
        all: symOptions.filter(s => !hotSymbolsSet.has(s))
      }
    }
    
    const term = searchTerm.toUpperCase()
    const filtered = symOptions.filter(s => s.toUpperCase().includes(term))
    
    return {
      hot: filtered.filter(s => hotSymbolsSet.has(s)),
      all: filtered.filter(s => !hotSymbolsSet.has(s))
    }
  }, [searchTerm, symOptions, hot])

  // TradingView chart widget
  const chartContainerRef = React.useRef<HTMLDivElement>(null)
  
  React.useEffect(() => {
    if (!symbol || !chartContainerRef.current) return

    // Clear previous chart
    if (chartContainerRef.current) {
      chartContainerRef.current.innerHTML = ''
    }

    // Load TradingView widget script
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/tv.js'
    script.async = true
    script.onload = () => {
      if (typeof (window as any).TradingView !== 'undefined' && chartContainerRef.current) {
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: `BINANCE:${symbol}`,
          interval: '15',
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#0f172a',
          enable_publishing: false,
          allow_symbol_change: false,
          container_id: 'tradingview_chart',
          hide_side_toolbar: false,
          studies: [
            'MASimple@tv-basicstudies',
            'RSI@tv-basicstudies'
          ],
          backgroundColor: 'rgba(15, 23, 42, 1)',
          gridColor: 'rgba(51, 65, 85, 0.3)',
          hide_top_toolbar: false,
          save_image: false,
        })
      }
    }
    
    document.head.appendChild(script)

    return () => {
      // Cleanup script on unmount
      const scripts = document.head.querySelectorAll('script[src*="tradingview"]')
      scripts.forEach(s => s.remove())
    }
  }, [symbol])

  return (
    <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-screen">
      <div className="p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent ml-0 lg:ml-0">Trading</h2>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 space-y-4">
            {/* TradingView Chart */}
            {symbol && (
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl md:rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
                <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 backdrop-blur-sm border-b border-slate-700/50 px-4 md:px-6 py-3 md:py-4">
                  <h3 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
                    <svg className="w-4 h-4 md:w-5 md:h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    {symbol} Chart
                  </h3>
                </div>
                <div className="relative" style={{ height: '400px' }}>
                  <div 
                    id="tradingview_chart" 
                    ref={chartContainerRef}
                    className="w-full h-full"
                  />
                </div>
              </div>
            )}
            
            {/* Order Placement Panel */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl md:rounded-2xl shadow-2xl border border-slate-700/50 overflow-visible">
              <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 backdrop-blur-sm border-b border-slate-700/50 px-4 md:px-6 py-3 md:py-4">
                <h3 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="w-4 h-4 md:w-5 md:h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Order Placement
                </h3>
              </div>
              
              <div className="p-4 md:p-6 space-y-4">
                {/* Symbol & Market Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Trading Pair</label>
                    {/* Symbol count indicator */}
                    {symOptions.length > 0 && (
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        {hot.length > 0 && (
                          <span className="flex items-center gap-1 text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" />
                            </svg>
                            {hot.length} hot
                          </span>
                        )}
                        {allBinanceSymbols.length > 0 && (
                          <span className="flex items-center gap-1 text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            {allBinanceSymbols.length} total pairs available
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <div className="relative flex-1 group" ref={dropdownRef}>
                      <div className="relative">
                        <input
                          ref={inputRef}
                          type="text"
                          className="w-full px-4 py-3 pr-10 border-2 border-slate-600/50 bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm rounded-xl font-semibold text-base text-white shadow-xl cursor-pointer
                          hover:border-cyan-500/70 hover:shadow-cyan-500/20 hover:shadow-2xl
                          focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/30 focus:outline-none 
                          transition-all duration-300 ease-out
                          placeholder:text-slate-500 placeholder:font-normal
                          tracking-wide"
                          style={{ fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace" }}
                          placeholder={symbol || "✨ Search trading pair..."}
                          value={isDropdownOpen ? searchTerm : symbol}
                          onChange={(e) => {
                            setSearchTerm(e.target.value)
                            if (!isDropdownOpen) setIsDropdownOpen(true)
                          }}
                          onClick={handleInputClick}
                          onKeyDown={handleKeyDown}
                        />
                        
                        {/* Custom dropdown arrow with animation */}
                        <div 
                          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-300"
                          style={{ transform: `translateY(-50%) ${isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'}` }}
                        >
                          <svg className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        
                        {/* Subtle glow effect */}
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      </div>
                      
                      {/* Dropdown Menu */}
                      {isDropdownOpen && (
                        <div className="absolute z-50 w-full mt-2 bg-slate-900 border-2 border-cyan-500/30 rounded-xl shadow-2xl shadow-cyan-500/10 overflow-hidden backdrop-blur-xl">
                          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                            {filteredSymbols.hot.length === 0 && filteredSymbols.all.length === 0 ? (
                              <div className="px-4 py-3 text-slate-500 text-center text-sm">
                                {binanceSymbolsLoading ? 'Loading symbols...' : 'No trading pairs found'}
                              </div>
                            ) : (
                              <>
                                {/* Hot Coins Section */}
                                {filteredSymbols.hot.length > 0 && (
                                  <>
                                    <div className="px-3 py-2 bg-gradient-to-r from-amber-900/30 to-orange-900/30 border-b border-amber-700/30 sticky top-0 z-10">
                                      <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" />
                                        </svg>
                                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Hot Coins ({filteredSymbols.hot.length})</span>
                                      </div>
                                    </div>
                                    {filteredSymbols.hot.map((sym, idx) => {
                                      const globalIdx = idx
                                      return (
                                        <div
                                          key={`hot-${sym}`}
                                          className={`px-4 py-3 cursor-pointer transition-all duration-150 border-b border-slate-800/50
                                            ${highlightedIndex === globalIdx || symbol === sym
                                              ? 'bg-gradient-to-r from-amber-600/25 to-orange-600/25 text-amber-300 font-bold'
                                              : 'text-white hover:bg-gradient-to-r hover:from-amber-600/15 hover:to-orange-600/15 hover:text-amber-200'
                                            }`}
                                          style={{ fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace", letterSpacing: '0.5px', fontSize: '15px', fontWeight: 600 }}
                                          onClick={() => handleSelectSymbol(sym)}
                                          onMouseEnter={() => setHighlightedIndex(globalIdx)}
                                        >
                                          <div className="flex items-center justify-between">
                                            <span>{sym}</span>
                                            <span className="text-xs text-amber-500/70">🔥</span>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </>
                                )}

                                {/* All Binance Futures Section */}
                                {filteredSymbols.all.length > 0 && (
                                  <>
                                    <div className="px-3 py-2 bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-b border-slate-700/30 sticky top-0 z-10">
                                      <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                        </svg>
                                        <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">All Binance Futures ({filteredSymbols.all.length})</span>
                                      </div>
                                    </div>
                                    {filteredSymbols.all.map((sym, idx) => {
                                      const globalIdx = filteredSymbols.hot.length + idx
                                      return (
                                        <div
                                          key={`all-${sym}`}
                                          className={`px-4 py-3 cursor-pointer transition-all duration-150 border-b border-slate-800/50 last:border-b-0
                                            ${highlightedIndex === globalIdx || symbol === sym
                                              ? 'bg-gradient-to-r from-cyan-600/25 to-blue-600/25 text-cyan-400 font-bold'
                                              : 'text-white hover:bg-gradient-to-r hover:from-cyan-600/15 hover:to-blue-600/15 hover:text-cyan-300'
                                            }`}
                                          style={{ fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace", letterSpacing: '0.5px', fontSize: '15px', fontWeight: 600 }}
                                          onClick={() => handleSelectSymbol(sym)}
                                          onMouseEnter={() => setHighlightedIndex(globalIdx)}
                                        >
                                          {sym}
                                        </div>
                                      )
                                    })}
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <style jsx>{`
                        .custom-scrollbar::-webkit-scrollbar {
                          width: 8px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-track {
                          background: rgba(15, 23, 42, 0.5);
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb {
                          background: linear-gradient(to bottom, rgba(6, 182, 212, 0.5), rgba(59, 130, 246, 0.5));
                          border-radius: 4px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                          background: linear-gradient(to bottom, rgba(6, 182, 212, 0.8), rgba(59, 130, 246, 0.8));
                        }
                      `}</style>
                    </div>
                    
                    <div className="flex gap-2 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
                      <button 
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                        market === 'spot' 
                          ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                      onClick={() => setMarket('spot')}
                    >
                      Spot
                    </button>
                    <button 
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                        market === 'futures' 
                          ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/20' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                      onClick={() => setMarket('futures')}
                    >
                      Futures
                    </button>
                  </div>
                </div>
              </div>

              {/* Price & Quantity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Price (USDT)</label>
                  <input 
                    className="w-full px-4 py-2.5 border border-slate-700 bg-slate-800/50 rounded-lg font-medium text-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/50 transition"
                    placeholder="0.00" 
                    value={price} 
                    onChange={(e) => setPrice(e.target.value)}
                    type="number"
                    step="0.01"
                  />
                  {asks.length > 0 && (
                    <div className="text-xs text-slate-400">
                      Best Ask: <span className="font-semibold text-red-400">{asks[0][0]}</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Quantity</label>
                  <input 
                    className="w-full px-4 py-2.5 border border-slate-700 bg-slate-800/50 rounded-lg font-medium text-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/50 transition"
                    placeholder="0.00" 
                    value={qty} 
                    onChange={(e) => setQty(e.target.value)}
                    type="number"
                    step="0.001"
                  />
                  {bids.length > 0 && (
                    <div className="text-xs text-slate-400">
                      Best Bid: <span className="font-semibold text-green-400">{bids[0][0]}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Estimated Total */}
              {price && qty && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-300">Estimated Total</span>
                    <span className="text-lg font-bold text-cyan-400">
                      {(parseFloat(price) * parseFloat(qty)).toFixed(2)} USDT
                    </span>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                <button 
                  className="w-full px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed text-medium"
                  onClick={() => executeTest(false)}
                  disabled={!symbol}
                >
                  Execute Live Order
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-6 mb-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Live Strategy Control
            </h3>
            {!symbol && (
              <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-sm text-cyan-300">
                💡 <strong>First step:</strong> Select a symbol from the Order Entry dropdown above to enable strategy controls
              </div>
            )}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-xs text-slate-400 block mb-1">Strategy Type</label>
                  <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
                    <button 
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        strategyMode === 'bear' 
                          ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-500/20' 
                          : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                      onClick={() => setStrategyMode('bear')}
                      disabled={strategyRunning}
                    >
                      🐻 Bear
                    </button>
                    <button 
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        strategyMode === 'bull' 
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-500/20' 
                          : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                      onClick={() => setStrategyMode('bull')}
                      disabled={strategyRunning}
                    >
                      🐂 Bull
                    </button>
                    <button 
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        strategyMode === 'scalp' 
                          ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20' 
                          : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                      onClick={() => setStrategyMode('scalp')}
                      disabled={strategyRunning}
                    >
                      ⚡ Scalp
                    </button>
                    <button 
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        strategyMode === 'range' 
                          ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-lg shadow-purple-500/20' 
                          : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                      onClick={() => setStrategyMode('range')}
                      disabled={strategyRunning}
                    >
                      📊 Range
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Selected Symbol</label>
                <div className={`px-3 py-2 rounded-lg border font-medium ${
                  symbol ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' : 'bg-slate-800/50 border-slate-700 text-slate-500'
                }`}>
                  {symbol || '← Select symbol from Order Entry dropdown above'}
                </div>
              </div>

              <div className="flex gap-2">
                {!strategyRunning ? (
                  <button 
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg font-medium shadow-lg shadow-green-500/20 hover:shadow-green-500/40 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                    onClick={startStrategy}
                    disabled={strategyLoading || !symbol}
                  >
                    {strategyLoading ? '⏳ Starting...' : '▶️ Start Strategy'}
                  </button>
                ) : (
                  <button 
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-lg font-medium shadow-lg shadow-red-500/20 hover:shadow-red-500/40 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                    onClick={stopStrategy}
                    disabled={strategyLoading}
                  >
                    {strategyLoading ? '⏳ Stopping...' : '⏹️ Stop Strategy'}
                  </button>
                )}
              </div>

              {strategyError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
                  ⚠️ {strategyError}
                </div>
              )}

              {strategyRunning && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-300">
                  ✅ Strategy running on {symbol} in {strategyMode.toUpperCase()} mode
                </div>
              )}

              <div className="text-xs text-slate-400 space-y-1 bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                <p><strong className="text-slate-300">🐻 Bear Strategy:</strong> Short on quick pumps (+5%), long on deep oversold (-5/-10/-12%)</p>
                <p><strong className="text-slate-300">🐂 Bull Strategy:</strong> Long on quick dips (-5%), short on overbought (+7/+12/+15%)</p>
                <p><strong className="text-slate-300">⚡ Scalp Strategy:</strong> Quick entries on 1.2% SMA deviation, targets 2.5% profit (1.5% partial), 1.5% stop, max 2h hold</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Live Strategy Dashboard
            </h3>
            <LiveDashboard />
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl md:rounded-2xl shadow-2xl border border-slate-700/50 p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 md:w-5 md:h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="truncate">Order Book {symbol ? `(${symbol} · ${market})` : ''}</span>
            </h3>
            <div className="text-xs text-slate-500 mb-2">Updated: {bookTs || '—'}</div>
            <div className="text-xs text-slate-500 mb-4">WS: <span className={`font-semibold ${bookConn === 'open' ? 'text-green-400' : 'text-red-400'}`}>{bookConn}</span></div>
            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Asks</div>
                <div className="text-xs md:text-sm font-mono max-h-48 overflow-auto space-y-1">
                  {asks.length === 0 ? <div className="text-slate-600">No asks</div> : asks.slice().reverse().map((row, i) => (
                    <div key={i} className="flex justify-between px-1 md:px-2 py-1 bg-red-500/5 hover:bg-red-500/10 rounded transition"><span className="text-red-400 font-semibold">{row[0]}</span><span className="text-slate-400">{row[1]}</span></div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Bids</div>
                <div className="text-xs md:text-sm font-mono max-h-48 overflow-auto space-y-1">
                  {bids.length === 0 ? <div className="text-slate-600">No bids</div> : bids.map((row, i) => (
                    <div key={i} className="flex justify-between px-1 md:px-2 py-1 bg-green-500/5 hover:bg-green-500/10 rounded transition"><span className="text-green-400 font-semibold">{row[0]}</span><span className="text-slate-400">{row[1]}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* AI Analysis Section */}
          {symbol && (
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl md:rounded-2xl shadow-2xl border border-slate-700/50 p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="w-4 h-4 md:w-5 md:h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI Analysis
                  {aiLoading && (
                    <span className="ml-2 text-xs text-slate-400 animate-pulse">Analyzing...</span>
                  )}
                </h3>
                <button
                  onClick={fetchAiAnalysis}
                  disabled={aiLoading}
                  className="text-xs px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 transition-colors disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>

              {aiLoading && !aiAnalysis && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
                </div>
              )}

              {!aiLoading && !aiAnalysis && (
                <div className="text-center py-6 text-slate-500">
                  No analysis available
                </div>
              )}

              {aiAnalysis && (
                <div className="space-y-4">
                  {/* Overall Trend Card */}
                  <div className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 rounded-xl p-4 border border-slate-600/30">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-400">Overall Trend</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        aiAnalysis.overall.trend.includes('Bullish') 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : aiAnalysis.overall.trend.includes('Bearish')
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                      }`}>
                        {aiAnalysis.overall.trend}
                      </span>
                    </div>
                    
                    {/* Confidence Bar */}
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span>AI Confidence</span>
                        <span className="font-semibold text-white">{aiAnalysis.overall.confidence}%</span>
                      </div>
                      <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            aiAnalysis.overall.confidence >= 70 
                              ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                              : aiAnalysis.overall.confidence >= 40
                              ? 'bg-gradient-to-r from-yellow-500 to-amber-400'
                              : 'bg-gradient-to-r from-red-500 to-orange-400'
                          }`}
                          style={{ width: `${aiAnalysis.overall.confidence}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 mt-2">
                      Based on technical indicators and price action analysis
                    </div>
                  </div>

                  {/* Timeframe Analysis */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* 1H Analysis */}
                    <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">1 Hour</div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Trend</span>
                          <span className={`text-xs font-semibold ${
                            aiAnalysis['1h'].trend.includes('Bullish') ? 'text-green-400' :
                            aiAnalysis['1h'].trend.includes('Bearish') ? 'text-red-400' :
                            'text-slate-400'
                          }`}>
                            {aiAnalysis['1h'].trend}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Confidence</span>
                          <span className="text-xs font-semibold text-white">{aiAnalysis['1h'].confidence}%</span>
                        </div>
                        {aiAnalysis['1h'].analysis && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">Change</span>
                              <span className={`text-xs font-semibold ${
                                aiAnalysis['1h'].analysis.pct_change >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {aiAnalysis['1h'].analysis.pct_change >= 0 ? '+' : ''}{aiAnalysis['1h'].analysis.pct_change.toFixed(2)}%
                              </span>
                            </div>
                            {aiAnalysis['1h'].analysis.rsi && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">RSI</span>
                                <span className={`text-xs font-semibold ${
                                  aiAnalysis['1h'].analysis.rsi > 70 ? 'text-red-400' :
                                  aiAnalysis['1h'].analysis.rsi < 30 ? 'text-green-400' :
                                  'text-slate-300'
                                }`}>
                                  {aiAnalysis['1h'].analysis.rsi.toFixed(1)}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* 4H Analysis */}
                    <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">4 Hours</div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Trend</span>
                          <span className={`text-xs font-semibold ${
                            aiAnalysis['4h'].trend.includes('Bullish') ? 'text-green-400' :
                            aiAnalysis['4h'].trend.includes('Bearish') ? 'text-red-400' :
                            'text-slate-400'
                          }`}>
                            {aiAnalysis['4h'].trend}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Confidence</span>
                          <span className="text-xs font-semibold text-white">{aiAnalysis['4h'].confidence}%</span>
                        </div>
                        {aiAnalysis['4h'].analysis && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">Change</span>
                              <span className={`text-xs font-semibold ${
                                aiAnalysis['4h'].analysis.pct_change >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {aiAnalysis['4h'].analysis.pct_change >= 0 ? '+' : ''}{aiAnalysis['4h'].analysis.pct_change.toFixed(2)}%
                              </span>
                            </div>
                            {aiAnalysis['4h'].analysis.rsi && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">RSI</span>
                                <span className={`text-xs font-semibold ${
                                  aiAnalysis['4h'].analysis.rsi > 70 ? 'text-red-400' :
                                  aiAnalysis['4h'].analysis.rsi < 30 ? 'text-green-400' :
                                  'text-slate-300'
                                }`}>
                                  {aiAnalysis['4h'].analysis.rsi.toFixed(1)}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Key Indicators */}
                  {aiAnalysis['1h']?.analysis && (
                    <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Key Indicators</div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Price</div>
                          <div className="text-sm font-semibold text-white font-mono">${aiAnalysis['1h'].analysis.last.toFixed(4)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">SMA(30)</div>
                          <div className="text-sm font-semibold text-cyan-400 font-mono">${aiAnalysis['1h'].analysis.sma30.toFixed(4)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Volatility</div>
                          <div className="text-sm font-semibold text-amber-400">{aiAnalysis['1h'].analysis.volatility.toFixed(2)}%</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Social Sentiment Analysis */}
          {symbol && (
            <div className="mb-4 mt-4">
              <SocialSentiment symbol={symbol} />
            </div>
          )}

          {/* Spacing between AI Analysis and Funding Rate sections */}
          <div className="mb-8"></div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Funding Rate Analysis
            </h3>
            {execLoading && <div className="mt-2 text-sm text-slate-400">Executing...</div>}
            {execResult && (
              <div className="mt-3">
                {/* Error payload */}
                {execResult.error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-red-400 text-lg">⚠️</span>
                      <div>
                        <div className="font-semibold text-red-300">Error</div>
                        <div className="text-sm text-red-400">{String(execResult.error)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Local preview object (simple) */}
                {execResult.preview && (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                    <div className="font-semibold text-white mb-2">Local Preview</div>
                    <div className="text-xs font-mono bg-slate-900/50 text-slate-300 p-3 rounded border border-slate-700">
                      {JSON.stringify(execResult.preview, null, 2)}
                    </div>
                  </div>
                )}

                {/* Structured preview-hedge result from backend */}
                {execResult.candidates && (
                  <div className="space-y-3">
                    {/* Funding Rate Summary */}
                    <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-cyan-500/30 rounded-lg p-4">
                      <h4 className="font-semibold text-white mb-3">Binance Futures Analysis</h4>
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Symbol</div>
                          <div className="font-bold text-sm text-white">{execResult.symbol || '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Entry Price</div>
                          <div className="font-bold text-sm text-white">
                            ${typeof execResult.binance_avg_buy !== 'undefined' ? Number(execResult.binance_avg_buy).toFixed(2) : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Notional</div>
                          <div className="font-bold text-sm text-white">
                            ${Number(execResult.notional || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {execResult.funding_rate_pct !== undefined && (
                        <div className="pt-3 border-t border-cyan-500/20 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-sm text-slate-300">Current Funding Rate</span>
                            <span className={`font-bold text-sm ${execResult.funding_rate_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {(execResult.funding_rate_pct || 0).toFixed(4)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-sm text-slate-300">Estimated 6h Funding Income</span>
                            <span className={`font-bold text-sm ${(execResult.funding_income_6h || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              ${(execResult.funding_income_6h || 0).toFixed(2)}
                            </span>
                          </div>
                          
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
  )
}

// helpers
async function executeTestInternal(body: any) {
  const res = await fetch('/execute', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': 'demo-key' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || JSON.stringify(data))
  return data
}

// call backend /api/live-check and return JSON
async function runLiveCheckInternal(symbol?: string) {
  const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
  const url = `${backend}/api/live-check${symbol ? '?symbol=' + encodeURIComponent(symbol) : ''}`
  const res = await fetch(url, { method: 'GET', headers: { 'content-type': 'application/json' } })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || JSON.stringify(data))
  return data
}

// UI convenience wrapper used by the component
async function runLiveCheck() {
  // this function will be replaced at runtime by the component via closure,
  // but define fallback behavior so editors don't show errors if called outside
  try {
    return await runLiveCheckInternal()
  } catch (e) {
    return { error: String(e) }
  }
}
