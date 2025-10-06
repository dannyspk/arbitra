"use client"

import React from 'react'

type LogEntry = { id: string; ts: string; text: string }

const listeners: Array<(l: LogEntry) => void> = []
export function appendLog(text: string) {
  const e: LogEntry = { id: String(Date.now()) + Math.random().toString(36).slice(2, 7), ts: new Date().toISOString(), text }
  for (const l of listeners) l(e)
}

export default function ExecutionConsole() {
  // We'll repurpose this component to show a live "Liquidation" stream.
  const [events, setEvents] = React.useState<any[]>([])
  const [symbols, setSymbols] = React.useState<string[]>([])
  const [selectedSymbol, setSelectedSymbol] = React.useState<string>('')
  const [minQty, setMinQty] = React.useState<string>('0')
  const [minutes, setMinutes] = React.useState<string>('10')
  const [summary, setSummary] = React.useState<any>({})
  const [hotRankings, setHotRankings] = React.useState<{ longs: Array<any>, shorts: Array<any> }>({ longs: [], shorts: [] })
  const [topN, setTopN] = React.useState<number>(10)
  const [aggregateSummary, setAggregateSummary] = React.useState<any[]>([])
  const [paused, setPaused] = React.useState<boolean>(false)
  const pausedRef = React.useRef<boolean>(paused)

  // keep ref in sync so websocket handler can see latest paused state
  React.useEffect(() => {
    pausedRef.current = paused
  }, [paused])
  const [highlightUsd, setHighlightUsd] = React.useState<string>('1000')

  // refs for background recompute to avoid retriggering the timer
  const summaryRef = React.useRef<any>(summary)
  const eventsRef = React.useRef<any[]>(events)

  React.useEffect(() => { summaryRef.current = summary }, [summary])
  React.useEffect(() => { eventsRef.current = events }, [events])

  // update symbol list when new events arrive
  React.useEffect(() => {
    setSymbols((s) => {
      const cur = new Set(s)
      for (const e of events) {
        try {
          const o = (e.raw && e.raw.o) || e.raw
          const sym = (o?.s || o?.symbol || 'unknown').toUpperCase()
          cur.add(sym)
        } catch (err) {
          continue
        }
      }
      return Array.from(cur).sort()
    })
  }, [events])

  // Small inline sparkline component
  function Sparkline({ data }: { data: number[] }) {
    const w = 80
    const h = 20
    if (!data || data.length === 0) return <svg width={w} height={h} />
    const max = Math.max(...data)
    const min = Math.min(...data)
    const span = max - min || 1
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1 || 1)) * w
      const y = h - ((v - min) / span) * h
      return `${x},${y}`
    }).join(' ')
    return <svg width={w} height={h}><polyline fill="none" stroke="#2563EB" strokeWidth={1} points={points} /></svg>
  }

  function exportCsv() {
    // export events within selected minutes (uses buffered summary to find timeframe)
    try {
      const now = new Date()
      const mins = Number(minutes) || 10
      const cutoff = new Date(now.getTime() - mins * 60 * 1000)
      // gather events matching timeframe and filters
      const rows: string[] = []
      rows.push('ts,symbol,side,qty,price,filled,quote_usd')
      for (const e of events) {
        try {
          const raw = e.raw || {}
          const o = (raw && raw.o) || raw
          const ts = e.ts
          const sym = (o?.s || o?.symbol || 'unknown')
          const side = o?.S || o?.side || ''
          const qty = Number(o?.q || o?.qty || o?.z || 0)
          const price = Number(o?.ap || o?.p || 0)
          const filled = o?.z || o?.l || ''
          const dt = new Date(typeof ts === 'number' ? ts : String(ts))
          if (dt < cutoff) continue
          const quote = (qty * price) || 0
          if (selectedSymbol && selectedSymbol !== String(sym).toUpperCase()) continue
          if (Number(minQty) > 0 && qty < Number(minQty)) continue
          rows.push(`${dt.toISOString()},${sym},${side},${qty},${price},${filled},${quote}`)
        } catch (err) {
          continue
        }
      }
      const csv = rows.join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `liquidations_${new Date().toISOString()}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      // ignore
    }
  }

  React.useEffect(() => {
    // Determine websocket URL: allow overriding NEXT_PUBLIC_WS_URL and fall back to /ws/liquidations
    const envUrl = (window as any).NEXT_PUBLIC_WS_URL || (process && (process.env as any)?.NEXT_PUBLIC_WS_URL)
    // prefer an explicit liquidations path if present
    const wsUrl = envUrl ? envUrl.replace('/ws/opportunities', '/ws/liquidations') : `ws://${window.location.hostname}:8000/ws/liquidations`

    let ws: WebSocket | null = null
    try {
      ws = new WebSocket(wsUrl)
    } catch (e) {
      // ignore
    }

    if (!ws) return

    ws.onopen = () => {
      console.log('liquidation ws open', wsUrl)
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        // Expect messages like {ts:..., msg: {e: 'forceOrder', o: {...}}} or raw forceOrder objects.
        let payload = msg
        if (msg.msg) payload = msg.msg
        // Normalize to an event object
        const evt = {
          id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
          ts: msg.ts || (payload.o && payload.o.T) || Date.now(),
          raw: payload,
        }
        if (!pausedRef.current) setEvents((s) => [evt, ...s].slice(0, 1000))
      } catch (e) {
        // ignore parse errors
      }
    }
    ws.onclose = () => console.log('liquidation ws closed')
    ws.onerror = (e) => console.log('liquidation ws error', e)

    return () => {
      try { ws && ws.close() } catch (e) {}
    }
  }, [])

  // Recompute aggregate summary on a 3-minute cadence to avoid realtime churn.
  // Also recompute immediately when user changes filters (minutes, minQty, selectedSymbol, topN).
  React.useEffect(() => {

    let mounted = true
    const COMPUTE_MS = 3 * 60 * 1000 // 3 minutes

    function computeNow() {
      const perMinuteP = summaryRef.current || {}
      if (Object.keys(perMinuteP).length > 0) {
        // compute from perMinute
        try {
          const agg: Record<string, { symbol: string; count: number; base_vol: number; quote_vol: number }> = {}
          for (const minuteKey of Object.keys(perMinuteP)) {
            const bySym = perMinuteP[minuteKey] || {}
            for (const [sym, stats] of Object.entries(bySym as any)) {
              const s = String(sym).toUpperCase()
              if (selectedSymbol && selectedSymbol !== '' && selectedSymbol !== s) continue
              const cur = agg[s] ?? { symbol: s, count: 0, base_vol: 0, quote_vol: 0 }
              cur.count += (stats as any).count || 0
              cur.base_vol += (stats as any).base_vol || 0
              cur.quote_vol += (stats as any).quote_vol || 0
              agg[s] = cur
            }
          }
          const arr = Object.values(agg).sort((a, b) => (b.quote_vol || 0) - (a.quote_vol || 0))
          if (mounted) setAggregateSummary(arr)
          return
        } catch (e) {
          // fall through to events-based
        }
      }

      // fallback to events
      try {
        const now = new Date()
        const mins = Number(minutes) || 10
        const cutoff = new Date(now.getTime() - mins * 60 * 1000)
        const agg: Record<string, { symbol: string; count: number; base_vol: number; quote_vol: number }> = {}
        for (const e of eventsRef.current || []) {
          try {
            const raw = e.raw || {}
            const o = (raw && raw.o) || raw
            const ts = e.ts
            const dt = new Date(typeof ts === 'number' ? ts : String(ts))
            if (isNaN(dt.getTime())) continue
            if (dt < cutoff) continue
            const sym = (o?.s || o?.symbol || 'unknown').toUpperCase()
            if (selectedSymbol && selectedSymbol !== '' && selectedSymbol !== sym) continue
            const qty = Number(o?.q || o?.qty || o?.z || 0) || 0
            if (Number(minQty) > 0 && qty < Number(minQty)) continue
            const price = Number(o?.ap || o?.p || 0) || 0
            const quote = qty * price
            const cur = agg[sym] ?? { symbol: sym, count: 0, base_vol: 0, quote_vol: 0 }
            cur.count += 1
            cur.base_vol += qty
            cur.quote_vol += quote
            agg[sym] = cur
          } catch (err) {
            continue
          }
        }
        const arr = Object.values(agg).sort((a, b) => (b.quote_vol || 0) - (a.quote_vol || 0))
        if (mounted) setAggregateSummary(arr)
        // compute longs/shorts rankings from events (side-specific)
        try {
          const longTotals: Record<string, number> = {}
          const shortTotals: Record<string, number> = {}
          for (const e of eventsRef.current || []) {
            try {
              const raw = e.raw || {}
              const o = (raw && raw.o) || raw
              const ts = e.ts
              const dt = new Date(typeof ts === 'number' ? ts : String(ts))
              if (isNaN(dt.getTime())) continue
              const now = new Date()
              const mins = Number(minutes) || 10
              const cutoff = new Date(now.getTime() - mins * 60 * 1000)
              if (dt < cutoff) continue
              const sym = (o?.s || o?.symbol || 'unknown').toUpperCase()
              if (selectedSymbol && selectedSymbol !== '' && selectedSymbol !== sym) continue
              const qty = Number(o?.q || o?.qty || o?.z || 0) || 0
              if (Number(minQty) > 0 && qty < Number(minQty)) continue
              const price = Number(o?.ap || o?.p || 0) || 0
              const quote = qty * price
              const side = String(o?.S || o?.side || '').toUpperCase()
              if (side === 'SELL' || side.startsWith('S')) {
                longTotals[sym] = (longTotals[sym] || 0) + quote
              } else if (side === 'BUY' || side.startsWith('B')) {
                shortTotals[sym] = (shortTotals[sym] || 0) + quote
              }
            } catch (err) {
              continue
            }
          }
          const build = (d: Record<string, number>) => Object.entries(d).map(([symbol, quote_usd]) => ({ symbol, quote_usd })).sort((a, b) => b.quote_usd - a.quote_usd)
          if (mounted) setHotRankings({ longs: build(longTotals), shorts: build(shortTotals) })
        } catch (err) {
          // ignore
        }
      } catch (e) {
        // ignore
      }
    }

    // immediate compute on filter change
    computeNow()

    // periodic recompute every 3 minutes
    const iv = setInterval(() => {
      computeNow()
    }, COMPUTE_MS)

    return () => { mounted = false; clearInterval(iv) }
  }, [minutes, minQty, selectedSymbol, topN])

  // Fetch aggregated summary when filters change
    React.useEffect(() => {
    let mounted = true
    async function fetchSummary() {
      try {
        const q = new URLSearchParams({ minutes: minutes, min_qty: minQty })
        const res = await fetch(`/api/liquidations/summary?${q.toString()}`)
        if (!res.ok) return
        const data = await res.json()
        if (!mounted) return
        // Prefer hot_by_minute when backend provides a canonical hotcoins aggregation
        const perMinute = data.hot_by_minute || data.by_minute || {}
        setSummary(perMinute)
        // capture server-provided long/short rankings if present
        if (data.hot_rankings) {
          setHotRankings({ longs: data.hot_rankings.longs || [], shorts: data.hot_rankings.shorts || [] })
        }
          // Do NOT update aggregateSummary here - recompute runs on a 3-minute cadence
      } catch (e) {
        // ignore
      }
    }
    fetchSummary()
    const iv = setInterval(fetchSummary, 5000)
    return () => { mounted = false; clearInterval(iv) }
  }, [minutes, minQty])

  return (
    <div className="text-white">
      <h3 className="text-xl font-semibold mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
        Liquidation Stream
      </h3>
      
      <div className="mb-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wide">Symbol</label>
            <select 
              value={selectedSymbol} 
              onChange={(ev) => setSelectedSymbol(ev.target.value)} 
              className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50"
            >
              <option value="">All</option>
              {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wide">Highlight USD &gt;</label>
            <input 
              type="number" 
              value={highlightUsd} 
              onChange={(ev) => setHighlightUsd(ev.target.value)} 
              className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 w-32 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50" 
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wide">Min qty</label>
            <input 
              type="number" 
              value={minQty} 
              onChange={(ev) => setMinQty(ev.target.value)} 
              className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 w-24 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50" 
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wide">Window (min)</label>
            <input 
              type="number" 
              value={minutes} 
              onChange={(ev) => setMinutes(ev.target.value)} 
              className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 w-24 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50" 
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wide">Live</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setPaused(false)} 
                className={`px-3 py-1.5 border rounded transition-all ${paused ? 'border-slate-600 text-slate-400 hover:border-green-500' : 'bg-green-500/20 border-green-500/50 text-green-400 font-semibold'}`}
              >
                Resume
              </button>
              <button 
                onClick={() => setPaused(true)} 
                className={`px-3 py-1.5 border rounded transition-all ${paused ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400 font-semibold' : 'border-slate-600 text-slate-400 hover:border-yellow-500'}`}
              >
                Pause
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wide">Export</label>
            <button 
              onClick={() => exportCsv()} 
              className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded font-semibold shadow-lg shadow-cyan-500/20 transition-all"
            >
              Export CSV
            </button>
          </div>
        </div>
        
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-slate-300 mb-2">Aggregated (per-minute)</h4>
          <div className="max-h-48 overflow-auto text-sm mt-2">
            {Object.keys(summary).length === 0 ? (
              <div className="text-slate-500">No aggregated data</div>
            ) : (
              Object.entries(summary).map(([minute, bySym]) => (
                <div key={minute} className="mb-3">
                  <div className="text-xs text-slate-500 mb-1">{minute}</div>
                  <div>
                    {(Object.entries(bySym as any) as [string, any][]).filter(([sym]) => !selectedSymbol || sym === selectedSymbol).map(([sym, stats]) => (
                      <div key={sym} className="font-mono text-sm flex items-center gap-3 bg-slate-700/30 rounded px-3 py-2 mb-1">
                        <div className="w-40 text-white">{sym}: count=<span className="text-cyan-400">{stats.count}</span></div>
                        <div className="text-xs text-slate-400">base_vol={stats.base_vol.toFixed(4)}</div>
                        <div className="text-xs text-slate-400">quote_vol={stats.quote_vol.toFixed(4)}</div>
                        <div className="ml-2"><Sparkline data={(Object.keys(summary) as string[]).map(k=> ((summary as any)[k]?.[sym]?.base_vol)||0)} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-300">Aggregate Summary (window)</h4>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 uppercase tracking-wide">Top N</label>
            <select 
              value={String(topN)} 
              onChange={(e)=> setTopN(Number(e.target.value))} 
              className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50"
            >
              {[5,10,20,50].map(n=> <option key={n} value={String(n)}>{n}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">Top by USD (aggregate)</div>
            <div className="mt-2 text-sm max-h-64 overflow-auto font-mono">
              {aggregateSummary.length === 0 ? (
                <div className="text-slate-500">No aggregate data</div>
              ) : (
                aggregateSummary.slice(0, topN).map((row: any) => (
                  <div key={row.symbol} className="flex justify-between py-2 border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                    <div className="font-semibold text-white">{row.symbol}</div>
                    <div className="text-cyan-400">${(row.quote_vol || 0).toFixed(2)}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="col-span-2">
            <div className="flex gap-4">
              <div className="w-1/2">
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">
                  Longs <span className="text-red-400">(SELL liquidations)</span>
                </div>
                <div className="mt-2 max-h-64 overflow-auto text-sm">
                  {hotRankings.longs.length === 0 ? (
                    <div className="text-slate-500">No data</div>
                  ) : (
                    hotRankings.longs.slice(0, topN).map((it: any, idx:number) => (
                      <div key={it.symbol || idx} className="flex justify-between py-2 border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                        <div className="font-semibold text-white">{it.symbol}</div>
                        <div className="text-red-400">${Number(it.quote_usd || it.quote_vol || 0).toFixed(2)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="w-1/2">
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">
                  Shorts <span className="text-green-400">(BUY liquidations)</span>
                </div>
                <div className="mt-2 max-h-64 overflow-auto text-sm">
                  {hotRankings.shorts.length === 0 ? (
                    <div className="text-slate-500">No data</div>
                  ) : (
                    hotRankings.shorts.slice(0, topN).map((it: any, idx:number) => (
                      <div key={it.symbol || idx} className="flex justify-between py-2 border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                        <div className="font-semibold text-white">{it.symbol}</div>
                        <div className="text-green-400">${Number(it.quote_usd || it.quote_vol || 0).toFixed(2)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 h-[60vh] overflow-auto">
        {events.length === 0 ? (
          <div className="text-slate-500 text-center py-8">No events yet</div>
        ) : (
          <table className="min-w-full table-auto text-sm">
            <thead className="sticky top-0 bg-slate-800/90 backdrop-blur-sm">
              <tr className="border-b border-slate-700/50">
                <th className="w-48 text-left px-3 py-3 text-slate-400 font-semibold uppercase tracking-wider">Time</th>
                <th className="w-36 text-left px-3 py-3 text-slate-400 font-semibold uppercase tracking-wider">Symbol</th>
                <th className="w-32 text-right px-3 py-3 text-slate-400 font-semibold uppercase tracking-wider">Price</th>
                <th className="w-40 text-right px-3 py-3 text-slate-400 font-semibold uppercase tracking-wider">USD Amount</th>
                <th className="w-24 text-right px-3 py-3 text-slate-400 font-semibold uppercase tracking-wider">Qty</th>
                <th className="w-24 text-center px-3 py-3 text-slate-400 font-semibold uppercase tracking-wider" title={'SELL = long liquidation (exchange sold to close traders\' LONG), BUY = short liquidation (exchange bought to close traders\' SHORT)'}>Side</th>
                <th className="w-36 text-left px-3 py-3 text-slate-400 font-semibold uppercase tracking-wider">Intensity</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const o = (e.raw && e.raw.o) || e.raw
                const sym = o?.s || o?.symbol || 'unknown'
                const side = o?.S || o?.side || ''
                const qty = o?.q || o?.quantity || o?.z || ''
                const price = o?.ap || o?.p || ''
                // timestamp handling
                let time: string
                try {
                  const rawTs = e.ts
                  let dt: Date | null = null
                  if (typeof rawTs === 'number') dt = new Date(rawTs)
                  else if (typeof rawTs === 'string') {
                    const asNum = Number(rawTs)
                    if (!Number.isNaN(asNum) && asNum !== 0) dt = new Date(asNum)
                    else {
                      const parsed = Date.parse(rawTs)
                      dt = Number.isNaN(parsed) ? null : new Date(parsed)
                    }
                  }
                  if (!dt || Number.isNaN(dt.getTime())) dt = new Date()
                  time = dt.toLocaleString()
                } catch (err) {
                  time = new Date().toLocaleString()
                }
                const qtyNum = Number(qty) || 0
                const priceNum = Number(price) || 0
                const quoteUsd = qtyNum * priceNum
                if (selectedSymbol && selectedSymbol !== (String(sym).toUpperCase())) return null
                if (Number(minQty) > 0 && qtyNum < Number(minQty)) return null
                const highlight = Number(highlightUsd) > 0 && quoteUsd >= Number(highlightUsd)
                const th = Number(highlightUsd) || 1
                const intensity = Math.min(1, quoteUsd / Math.max(th, 1))
                const heatColor = side && String(side).toUpperCase().startsWith('B') ? `rgba(34,197,94,${0.12 + 0.7 * intensity})` : `rgba(239,68,68,${0.12 + 0.7 * intensity})`
                return (
                  <tr key={e.id} className={`border-t border-slate-700/30 hover:bg-slate-700/20 transition-colors ${highlight ? 'bg-yellow-500/10' : ''}`}>
                    <td className="px-3 py-2 align-top text-slate-400">{time}</td>
                    <td className="px-3 py-2 align-top font-semibold text-white">{sym}</td>
                    <td className="px-3 py-2 align-top text-right font-mono text-slate-300">{priceNum ? priceNum.toFixed(6) : '-'}</td>
                    <td className="px-3 py-2 align-top text-right text-cyan-400 font-semibold">${quoteUsd.toFixed(2)}</td>
                    <td className="px-3 py-2 align-top text-right text-slate-300">{qtyNum}</td>
                    {/** derive liquidation type: SELL -> long liquidation, BUY -> short liquidation */}
                    <td className="px-3 py-2 align-top text-center">
                      {(() => {
                        const s = String(side || '').toUpperCase()
                        const liqType = s === 'SELL' ? 'Long liquidation' : (s === 'BUY' ? 'Short liquidation' : '')
                        const badgeText = liqType ? `${s} • ${liqType.split(' ')[0]}` : s
                        const badgeClass = s.startsWith('B') ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        const tooltip = s === 'SELL' ? 'SELL = long liquidation (exchange sold to close LONG positions)' : (s === 'BUY' ? 'BUY = short liquidation (exchange bought to close SHORT positions)' : '')
                        return (
                          <span title={tooltip} className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>{badgeText}</span>
                        )
                      })()}
                    </td>
                    <td className="px-3 py-2 align-top"><div style={{ width: '100%', height: 18, background: heatColor, borderRadius: 6 }} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
