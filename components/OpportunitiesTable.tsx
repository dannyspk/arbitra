"use client"

import React from 'react'
import OpportunityCard from './ui/OpportunityCard'
import { useConnection } from './ConnectionProvider'

// Map verbose internal source names to short UI labels. Return null to hide.
function shortSourceLabel(src?: string | null) {
  if (!src) return null
  const s = String(src)
  if (s === 'row' || s === 'row-field') return null // hide redundant row labels
  if (s.startsWith('gate')) return 'gate'
  if (s === 'tickers') return 'tick'
  if (s === 'depths') return 'depth'
  if (s === 'gate-bids' || s === 'gate-tickers') return 'gate'
  return s.replace(/[^a-z0-9]/gi, '')
}

type Row = {
  symbol: string
  buy_exchange: string
  buy_price: number
  sell_exchange: string
  sell_price: number
  // explicit per-exchange prices (populated from backend when available)
  price_binance: number | null
  price_kucoin: number | null
  price_gate: number | null
  profit_pct: number
  depth_usd: number | null
  size_est: number
  gas_est: number
  deposit_withdraw: string
  buy_currency_details?: any
  sell_currency_details?: any
  // optional preview metadata (when row originated from preview_candidates_top)
  _preview?: any
  funding_rate_pct?: number | null
  funding_income_6h?: number | null
  // Additional funding preview fields
  revenue_usdt?: number | null
  cumulative_pct?: number | null
  intervals?: any
  funding_last?: number | null
  symbol_obj?: any
}

export default function OpportunitiesTable() {
  const { lastMessage, lastHotMessage } = useConnection()
  const [rows, setRows] = React.useState<Row[]>([])
  // previewRows holds preview-ranked candidates (render only in the cards grid)
  const [previewRows, setPreviewRows] = React.useState<Row[]>([])
  const [previewLoading, setPreviewLoading] = React.useState<boolean>(false)
  const [mode, setMode] = React.useState<'file' | 'live'>('live')
  const [feeders, setFeeders] = React.useState<Record<string, any>>({})
  // gatePrices maps symbol -> mid price (number) as provided by the Gate feeder
  const [gatePrices, setGatePrices] = React.useState<Record<string, number | null>>({})
  const [binancePrices, setBinancePrices] = React.useState<Record<string, number | null>>({})
  const [kucoinPrices, setKucoinPrices] = React.useState<Record<string, number | null>>({})
  const [binanceVer, setBinanceVer] = React.useState(0)
  const [kucoinVer, setKucoinVer] = React.useState(0)
  const [hotcoinTrends1h, setHotcoinTrends1h] = React.useState<Record<string, string>>({})
  const [hotcoinTrends4h, setHotcoinTrends4h] = React.useState<Record<string, string>>({})
  const [selectedPeriod, setSelectedPeriod] = React.useState<'1h' | '4h'>('1h')

  // Normalize symbol keys to a canonical form used for lookups in gatePrices
  // and feeder.tickers: uppercase with separators replaced by underscore.
  const normalizeSymbolKey = (s: string | undefined | null) => {
    if (!s) return ''
    return String(s).toUpperCase().replace(/[-\/]/g, '_')
  }

  

  // Helper: map server opportunity object to Row shape
  function mapToRow(p: any): Row {
    const profitPct = Number(p.profit_pct ?? p.profitPct ?? p.profitPctEstimated ?? 0)
    const depthUsd = (() => {
      const v = p.orderbook_depth_usd ?? p.orderbook_depth ?? p.depth_usd ?? p.depthUsd ?? p.depth
      if (v === undefined || v === null) return null
      return Number(v) || null
    })()
    const buyEx = (p.buy_exchange || p.buy_on || p.buyVenue || 'unknown')
    const sellEx = (p.sell_exchange || p.sell_on || p.sellVenue || 'unknown')
    const parseNumOrNull = (v: any) => {
      if (v === undefined || v === null) return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }

    // Prefer explicit per-exchange prices when backend provides them
    const binancePrice = parseNumOrNull(p.price_binance ?? p.Binance ?? p.binance ?? p.binance_price ?? null)
  const kucoinPrice = parseNumOrNull(p.price_kucoin ?? p.Kucoin ?? p.kucoin ?? p.kucoin_price ?? null)
  // backend may still provide price_mexc; accept it but store as price_gate in rows
  const gatePrice = parseNumOrNull(p.price_mexc ?? p.price_gate ?? p.Mexc ?? p.mexc ?? p.mexc_price ?? null)

    return {
      symbol: p.symbol || `${p.base || ''}-${p.quote || ''}`,
      buy_exchange: String(buyEx).toUpperCase(),
      buy_price: Number(p.buy_price ?? p.buyPrice ?? p.buy) || 0,
      sell_exchange: String(sellEx).toUpperCase(),
      sell_price: Number(p.sell_price ?? p.sellPrice ?? p.sell) || 0,
      profit_pct: profitPct,
      depth_usd: depthUsd,
      price_binance: binancePrice,
      price_kucoin: kucoinPrice,
  price_gate: gatePrice,
      size_est: Number(p.size_est ?? p.size ?? 0),
      gas_est: Number(p.gas_est ?? p.gas ?? 0),
      // deposit/withdraw info may be provided by the backend as booleans or
      // as explicit fields. Try several common keys and render a compact
      // human-friendly string. If missing, show 'unknown'.
      deposit_withdraw: (() => {
        const buyWithdraw = p.buy_withdraw ?? p.buyWithdraw ?? p.buy_withdraw_enabled ?? p.buy_can_withdraw
        const sellDeposit = p.sell_deposit ?? p.sellDeposit ?? p.sell_deposit_enabled ?? p.sell_can_deposit
        const fmt = (v: any, label: string) => {
          if (v === undefined || v === null) return `${label}:?`
          if (typeof v === 'string') {
            const low = v.toLowerCase()
            if (low === 'true' || low === 'yes' || low === '1') return `${label}:✔`
            if (low === 'false' || low === 'no' || low === '0') return `${label}:✖`
            return `${label}:${v}`
          }
          return `${label}:${v ? '✔' : '✖'}`
        }
        return `${fmt(buyWithdraw, 'W')} / ${fmt(sellDeposit, 'D')}`
      })(),
      buy_currency_details: p.buy_currency_details ?? p.buyCurrencyDetails ?? p.buy_currency ?? p.buy_currency_meta,
      sell_currency_details: p.sell_currency_details ?? p.sellCurrencyDetails ?? p.sell_currency ?? p.sell_currency_meta,
      // preview metadata and funding fields (may be present on preview objects)
      _preview: p._preview ?? p.preview ?? null,
      funding_rate_pct: (() => {
        const v = p.funding_rate_pct ?? p.funding_rate ?? p.fundingRatePct ?? p._preview?.funding_rate_pct ?? p._preview?.funding_rate
        if (v === undefined || v === null) return null
        const n = Number(v)
        return Number.isFinite(n) ? n : null
      })(),
      funding_income_6h: (() => {
        const v = p.funding_income_6h ?? p.funding_income ?? p.funding6h ?? p._preview?.funding_income_6h ?? p._preview?.est_6h_net
        if (v === undefined || v === null) return null
        const n = Number(v)
        return Number.isFinite(n) ? n : null
      })(),
    }
  }

  // Fetch from the backend file-based endpoint (default max 10% filter on server)
  React.useEffect(() => {
    let mounted = true
    const base = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')) || 'http://localhost:8000'
    const url = `${base}/file_opportunities`

    async function fetchOnce() {
      try {
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()
        if (!mounted || !Array.isArray(data)) return
        const mapped = data.map(mapToRow)
        setRows(mapped)
      } catch (e) {
        // ignore fetch errors
      }
    }

    // initial fetch and poll interval
    fetchOnce()
    const id = setInterval(fetchOnce, 10_000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  // Poll feeder debug status from the backend and display small badges
  React.useEffect(() => {
    let mounted = true
    const base = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')) || 'http://localhost:8000'
    const url = `${base}/debug/feeder_status`

    async function fetchStatus() {
      try {
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()
        if (!mounted) return
        // normalize: backend may return a single object or a map of feeders
        if (Array.isArray(data)) {
          const map: Record<string, any> = {}
          for (const item of data) if (item && item.feeder) map[item.feeder] = item
          setFeeders(map)
        } else if (data && typeof data === 'object') {
          // if object has 'feeder' field it's a single-entry response
          if (data.feeder) {
            setFeeders({ [String(data.feeder)]: data })
          } else {
            setFeeders(data as Record<string, any>)
          }
        }
      } catch (e) {
        // ignore
      }
    }

    fetchStatus()
    const id = setInterval(fetchStatus, 5000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  // Fetch both 1h and 4h analyses produced by tools/analyze_hotcoins_1h.py when available
  React.useEffect(() => {
    let mounted = true
    const base = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')) || 'http://localhost:8000'

    async function fetch1h() {
      try {
        const res = await fetch(`${base}/api/hotcoins/1h-analysis`)
        let data = null
        if (res.ok) {
          data = await res.json()
        } else {
          // fallback to combined analysis if standalone 1h not available
          try {
            const r2 = await fetch(`${base}/api/hotcoins/combined-analysis`)
            if (r2.ok) {
              const comb = await r2.json()
              if (Array.isArray(comb)) {
                data = comb.map((it: any) => ({ symbol: it.symbol, trend: it['1h']?.trend }))
              }
            }
          } catch (e) { /* ignore */ }
        }
        if (!mounted || !Array.isArray(data)) return
        const map: Record<string, string> = {}
        for (const item of data) {
          try {
            const sym = String(item.symbol || '').toUpperCase()
            if (!sym) continue
            map[sym] = String(item.trend || '')
          } catch (e) { continue }
        }
        if (mounted) setHotcoinTrends1h(map)
      } catch (e) {
        // ignore
      }
    }

    async function fetch4h() {
      try {
        let data = null
        const res = await fetch(`${base}/api/hotcoins/4h-analysis`)
        if (res.ok) {
          data = await res.json()
        } else {
          // fallback to combined analysis if standalone 4h not available
          try {
            const r2 = await fetch(`${base}/api/hotcoins/combined-analysis`)
            if (r2.ok) {
              const comb = await r2.json()
              if (Array.isArray(comb)) {
                data = comb.map((it: any) => ({ symbol: it.symbol, trend: it['4h']?.trend }))
              }
            }
          } catch (e) { /* ignore */ }
        }
        if (!mounted || !Array.isArray(data)) return
        const map: Record<string, string> = {}
        for (const item of data) {
          try {
            const sym = String(item.symbol || '').toUpperCase()
            if (!sym) continue
            map[sym] = String(item.trend || '')
          } catch (e) { continue }
        }
        if (mounted) setHotcoinTrends4h(map)
      } catch (e) {
        // ignore
      }
    }

    fetch1h()
    fetch4h()
    const tid = setInterval(() => { fetch1h(); fetch4h() }, 30_000)
    return () => { mounted = false; clearInterval(tid) }
  }, [])

  // Poll backend feeder status and extract Gate book tickers to populate the Gate column
  React.useEffect(() => {
    let mounted = true
    const base = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')) || 'http://localhost:8000'
    const url = `${base}/debug/feeder_status`

    async function pollOnce() {
      try {
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()
        if (!mounted || !data) return

        // Normalize response: debug endpoint returns an array of feeder status objects
        let gateObj: any = null
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item && (String(item.feeder || '').toLowerCase() === 'gate' || String(item.feeder || '').toLowerCase().includes('gate'))) {
              gateObj = item
              break
            }
          }
        } else if (data && typeof data === 'object') {
          // single object may contain feeder entries
          if (data.feeder && String(data.feeder).toLowerCase() === 'gate') gateObj = data
          else if (data['gate']) gateObj = data['gate']
        }

        if (!gateObj) {
          // nothing to update
          setGatePrices({})
          return
        }

  // Accept several possible shapes from the feeder status:
  // - depths: map of symbol -> numeric or book object
  // - book_tickers / tickers: map of symbol -> book ticker object
  // - bids: map of symbol -> numeric best-bid price (common shape)
  const depths = gateObj.depths || gateObj.book_tickers || gateObj.tickers || gateObj.bids || {}
        const out: Record<string, number | null> = {}
        if (depths && typeof depths === 'object') {
          for (const k of Object.keys(depths)) {
            try {
              const v = depths[k]
              // v may be a number (depth) or a book ticker object with bid/ask
              // Normalize key to canonical underscored uppercase form
              const nk = normalizeSymbolKey(k)
              if (v == null) {
                out[nk] = null
                continue
              }
              if (typeof v === 'number') {
                out[nk] = v
                continue
              }
              // try to compute mid price from bid/ask
              const bid = v.bid ?? v.b ?? v.best_bid ?? v.bestBid
              const ask = v.ask ?? v.a ?? v.best_ask ?? v.bestAsk
              let mid: number | null = null
              if (bid != null && ask != null) {
                const bn = Number(bid)
                const an = Number(ask)
                if (Number.isFinite(bn) && Number.isFinite(an)) mid = (bn + an) / 2.0
              } else if (bid != null) {
                const bn = Number(bid)
                if (Number.isFinite(bn)) mid = bn
              } else if (ask != null) {
                const an = Number(ask)
                if (Number.isFinite(an)) mid = an
              }
              out[nk] = mid
            } catch (e) {
              continue
            }
          }
        }

        setGatePrices(out)
      } catch (e) {
        // ignore fetch errors
      }
    }

    pollOnce()
    const id = setInterval(pollOnce, 2000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  // Poll feeder_depths for Binance and Kucoin so we can show per-exchange
  // top-of-book prices directly in the table (fast UI updates).
  React.useEffect(() => {
    let mounted = true
    const base = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')) || 'http://localhost:8000'

    async function pollOnce() {
      try {
        const urlB = `${base}/debug/feeder_depths?feeder_name=binance`
        const urlK = `${base}/debug/feeder_depths?feeder_name=kucoin`
        const [rb, rk] = await Promise.all([fetch(urlB).catch(() => null), fetch(urlK).catch(() => null)])
        if (!mounted) return
        if (rb && rb.ok) {
          try {
            const data = await rb.json()
            // Prefer explicit prices map returned by the backend. Fall back
            // to other legacy shapes (depths/book_tickers/tickers/bids).
            const depthsSrc = data.prices || data.prices_map || data.depths || data.book_tickers || data.tickers || data.bids || {}
            const out: Record<string, number | null> = {}
            if (depthsSrc && typeof depthsSrc === 'object') {
              for (const k of Object.keys(depthsSrc)) {
                try {
                  const v = depthsSrc[k]
                  const nk = normalizeSymbolKey(k)
                  if (v == null) { out[nk] = null; continue }
                  if (typeof v === 'number') { out[nk] = v; continue }
                  const bid = v.bid ?? v.b ?? v.best_bid ?? v.bestBid
                  const ask = v.ask ?? v.a ?? v.best_ask ?? v.bestAsk
                  let mid: number | null = null
                  if (bid != null && ask != null) {
                    const bn = Number(bid)
                    const an = Number(ask)
                    if (Number.isFinite(bn) && Number.isFinite(an)) mid = (bn + an) / 2.0
                  } else if (bid != null) {
                    const bn = Number(bid)
                    if (Number.isFinite(bn)) mid = bn
                  } else if (ask != null) {
                    const an = Number(ask)
                    if (Number.isFinite(an)) mid = an
                  }
                  out[nk] = mid
                } catch (e) { continue }
              }
            }
            setBinancePrices(out)
            setBinanceVer(v => v + 1)
          } catch (e) { /* ignore */ }
        }
        if (rk && rk.ok) {
          try {
            const data = await rk.json()
            // Prefer explicit prices map returned by the backend. Fall back
            // to other legacy shapes (depths/book_tickers/tickers/bids).
            const depthsSrc = data.prices || data.prices_map || data.depths || data.book_tickers || data.tickers || data.bids || {}
            const out: Record<string, number | null> = {}
            if (depthsSrc && typeof depthsSrc === 'object') {
              for (const k of Object.keys(depthsSrc)) {
                try {
                  const v = depthsSrc[k]
                  const nk = normalizeSymbolKey(k)
                  if (v == null) { out[nk] = null; continue }
                  if (typeof v === 'number') { out[nk] = v; continue }
                  const bid = v.bid ?? v.b ?? v.best_bid ?? v.bestBid
                  const ask = v.ask ?? v.a ?? v.best_ask ?? v.bestAsk
                  let mid: number | null = null
                  if (bid != null && ask != null) {
                    const bn = Number(bid)
                    const an = Number(ask)
                    if (Number.isFinite(bn) && Number.isFinite(an)) mid = (bn + an) / 2.0
                  } else if (bid != null) {
                    const bn = Number(bid)
                    if (Number.isFinite(bn)) mid = bn
                  } else if (ask != null) {
                    const an = Number(ask)
                    if (Number.isFinite(an)) mid = an
                  }
                  out[nk] = mid
                } catch (e) { continue }
              }
            }
              setKucoinPrices(out)
              setKucoinVer(v => v + 1)
              // Dev: log kucoin polled snapshot so we can see update timing in the browser console
              try {
                if (typeof window !== 'undefined' && (process && process.env && process.env.NODE_ENV ? process.env.NODE_ENV : 'development') !== 'production') {
                  console.debug('KuCoin poll update', { ts: Date.now(), keys: Object.keys(out).length, sample: Object.entries(out).slice(0,6) })
                }
              } catch (e) { /* ignore */ }
          } catch (e) { /* ignore */ }
        }
      } catch (e) {
        /* ignore */
      }
      if (mounted) setTimeout(pollOnce, 1000)
    }

    pollOnce()
    return () => { mounted = false }
  }, [])

  // We do not merge gatePrices into `rows` (that causes full-table reflows).
  // Instead, provide a small helper and a per-cell component that reads the
  // latest gate price for a symbol and flashes briefly on change.
  const findGatePriceForSymbol = React.useCallback((raw: string | undefined) => {
    if (!raw) return null
    const rawUp = String(raw).toUpperCase()
    const canonical = normalizeSymbolKey(rawUp)
    const slash = rawUp.replace(/[-_]/g, '/')
    const dash = rawUp.replace(/[_/]/g, '-')
    const tryKeys = [canonical, slash, dash, rawUp]

    // 1) direct gatePrices lookup
    for (const k of tryKeys) {
      const nk = normalizeSymbolKey(k)
      if (nk in gatePrices) {
        const v = gatePrices[nk]
        if (v !== undefined) return v
      }
    }

    // 2) heuristic: concatenated base+quote -> BASE_QUOTE
    const commonQuotes = ['USDT', 'USDC', 'BUSD', 'BTC', 'ETH', 'USD']
    for (const q of commonQuotes) {
      if (rawUp.endsWith(q)) {
        const base = rawUp.slice(0, rawUp.length - q.length)
        if (!base) continue
        const underscored = normalizeSymbolKey(base + '_' + q)
        if (underscored in gatePrices) return gatePrices[underscored]
      }
    }

    // 3) fallback to feeders['gate'] bids/tickers maps
    try {
      const gateFeed = feeders['gate']
      if (gateFeed) {
        const bmap = gateFeed.bids
        if (bmap && typeof bmap === 'object') {
          for (const k of tryKeys) {
            const direct = bmap[k] ?? bmap[normalizeSymbolKey(k)] ?? bmap[k.replace('/', '_')] ?? bmap[k.replace('-', '_')]
            if (direct !== undefined && direct !== null) {
              const n = Number(direct)
              if (Number.isFinite(n)) return n
            }
          }
          for (const bk of Object.keys(bmap)) {
            if (normalizeSymbolKey(bk) === canonical) {
              const n = Number(bmap[bk])
              if (Number.isFinite(n)) return n
            }
          }
        }
        const tmap = gateFeed.tickers
        if (tmap && typeof tmap === 'object') {
          for (const k of tryKeys) {
            const tk = tmap[k] ?? tmap[normalizeSymbolKey(k)] ?? tmap[k.replace('/', '_')]
            if (tk && typeof tk === 'object' && tk.last != null) {
              const n = Number(tk.last)
              if (Number.isFinite(n)) return n
            }
          }
          for (const tkKey of Object.keys(tmap)) {
            if (normalizeSymbolKey(tkKey) === canonical) {
              const tk = tmap[tkKey]
              if (tk && typeof tk === 'object' && tk.last != null) {
                const n = Number(tk.last)
                if (Number.isFinite(n)) return n
              }
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }

    return null
  }, [gatePrices, feeders])

  // Per-cell component that displays the gate price for a symbol and flashes
  // briefly when the price changes.
  // Price cell rendering is handled by a top-level memoized component
  // (GatePriceCell) which reads `gatePrices` from context. We don't define
  // it inline here to avoid scope problems with memoized row components.

  // Live websocket updates (optional) - prefer backend preview candidates when present
  React.useEffect(() => {
    if (!lastMessage) return
    if (lastMessage.type === 'opps') {
      try {
        const raw = lastMessage.payload as any

        // Support two preview shapes:
        // 1) raw.preview_candidates_top (existing richer preview shape)
        // 2) raw.candidates with top-level funding fields (the shape you pasted)
        let payload: any[] = []
        if (raw) {
          if (Array.isArray(raw.preview_candidates_top) && raw.preview_candidates_top.length > 0) {
            payload = raw.preview_candidates_top.map((p: any) => {
              // Map preview entry into the approximate opportunity shape expected by mapToRow
              return {
                symbol: p.symbol,
                buy_exchange: 'BINANCE',
                sell_exchange: (p.exchange || '').toString().toUpperCase(),
                buy_price: p.binance_avg_buy ?? null,
                sell_price: null,
                // note: est_6h_net is a dollar estimate; existing UI treats this as the ranking value
                profit_pct: Number(p.est_6h_net ?? p.revenue_usdt ?? 0),
                depth_usd: null,
                size_est: 0,
                gas_est: 0,
                deposit_withdraw: 'W:? / D:?',
                // keep raw preview payload for potential drill-down
                _preview: p,
                // funding metrics provided by preview (also surface revenue/cumulative/intervals at top-level)
                funding_rate_pct: p.funding_rate_pct ?? p.funding_rate ?? p.funding_rate_pct_est ?? null,
                funding_income_6h: p.funding_income_6h ?? p.est_6h_net ?? null,
                revenue_usdt: p.revenue_usdt ?? p.revenue ?? null,
                cumulative_pct: p.cumulative_pct ?? null,
                intervals: p.intervals ?? null,
                funding_last: p.last ?? null,
                symbol_obj: p.symbol_obj ?? null,
              }
            })
          } else if (Array.isArray(raw.candidates) && raw.candidates.length > 0) {
            // Map the newer compact preview shape where funding lives at the root
            const rootFundingRate = raw.funding_rate_pct ?? raw.funding_rate ?? raw.fundingRatePct ?? null
            const rootFundingIncome = raw.funding_income_6h ?? raw.funding_income ?? raw.funding6h ?? raw.est_6h_net ?? null
            payload = raw.candidates.map((c: any) => {
              return {
                symbol: raw.symbol ?? c.symbol ?? `${raw.base || ''}-${raw.quote || ''}`,
                buy_exchange: 'BINANCE',
                sell_exchange: (c.exchange || '').toString().toUpperCase(),
                // prefer explicit avg buy on the root (binance_avg_buy) but fall back to candidate fields
                buy_price: raw.binance_avg_buy ?? raw.binance_avg_price ?? c.avg_buy_price ?? null,
                sell_price: c.avg_sell_price ?? c.avg_sell_price ?? null,
                // keep using est_6h_net as the ranking value (UI shows it in the Profit column)
                profit_pct: Number(c.est_6h_net ?? 0),
                depth_usd: null,
                size_est: Number(raw.notional ?? c.notional ?? 0),
                gas_est: 0,
                deposit_withdraw: 'W:? / D:?',
                _preview: { root: raw, candidate: c },
                // surface root-level funding data when available
                funding_rate_pct: rootFundingRate,
                funding_income_6h: c.funding_income_6h ?? rootFundingIncome ?? c.est_6h_net,
              }
            })
          } else {
            const rawOpps = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.opportunities) ? raw.opportunities : [])
            payload = rawOpps
          }
        }

        const mapped: Row[] = payload.map(mapToRow)

        // If payload came from a preview flow (we produced previewRows),
        // prefer showing it only in the preview cards and do NOT replace
        // the main table rows. Otherwise treat it as normal opportunities.
        const looksLikePreview = Array.isArray(raw.preview_candidates_top) || Array.isArray(raw.candidates)
        if (looksLikePreview) {
          // populate preview rows (cards) and keep the main table untouched
          setPreviewRows(mapped)
        } else {
          // clear any stale preview rows and update main table
          setPreviewRows([])
          if (mapped && mapped.length > 0) {
            setRows(prevRows => {
              const existingSymbols = new Set(mapped.map(m => (m.symbol || '').toUpperCase()))
              const rest = prevRows.filter(r => !existingSymbols.has((r.symbol || '').toUpperCase()))
              return [...mapped, ...rest]
            })
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }, [lastMessage])

  // If hot-only updates arrive (rare), update rows accordingly
  React.useEffect(() => {
    if (mode !== 'live') return
    if (!lastHotMessage) return
    if (lastHotMessage.type === 'hot' && Array.isArray(lastHotMessage.payload)) {
      try {
        const hot = lastHotMessage.payload as any[]
        const hotRows = hot.map(h => mapHotToRow(h))
        // preserve existing rows for non-hot symbols
        const rest = rows.filter(r => !hotRows.find(h => h.symbol === r.symbol))
        setRows([...hotRows, ...rest])
      } catch (e) {
        // ignore
      }
    }
  }, [lastHotMessage])

  function mapHotToRow(h: any): Row {
    // Support two hot payload shapes:
    // - legacy: { symbol, best_bid, best_ask, spread_pct, depth_usd, bids_exchanges, asks_exchanges }
    // - hotcoins.py: { symbol, last, quoteVolume, change24h, marketCap, ts }
    const symbol = h.symbol || ''
    const buy_exchange = (h.asks_exchanges && h.asks_exchanges[0] && h.asks_exchanges[0].exchange) || h.top_ask_exchange || 'HOT'
    const sell_exchange = (h.bids_exchanges && h.bids_exchanges[0] && h.bids_exchanges[0].exchange) || h.top_bid_exchange || 'HOT'

    // Prefer explicit best bid/ask when present, otherwise fall back to last price
    const buy_price = Number(h.best_ask ?? h.bestAsk ?? h.ask ?? h.last ?? 0)
    const sell_price = Number(h.best_bid ?? h.bestBid ?? h.bid ?? h.last ?? 0)

    // profit_pct: legacy spread_pct or hotcoins' change24h (24h percent change)
    const profit_pct = Number(h.spread_pct ?? h.spreadPct ?? h.change24h ?? h.priceChangePercent ?? 0)

    // depth: prefer explicit orderbook-derived depth fields. Do NOT treat
    // Binance 24h quoteVolume as orderbook depth (it is a 24h metric).
    const depth_usd = (() => {
      const candidates = [h.orderbook_depth_usd, h.orderbook_depth, h.depth_usd, h.depthUsd, h.depth]
      for (const c of candidates) {
        if (c !== undefined && c !== null) {
          const n = Number(c)
          if (Number.isFinite(n)) return n
        }
      }
      // If the payload includes a top-of-book snapshot (asks/bids arrays),
      // estimate a tiny depth by summing a few top levels if available.
      try {
        const ob = h.orderbook || h.ob || null
        if (ob && Array.isArray(ob.asks) && Array.isArray(ob.bids)) {
          let sum = 0
          for (const [p, q] of (ob.asks.slice(0, 5).concat(ob.bids.slice(0, 5)) as any[])) {
            const pn = Number(p)
            const qn = Number(q)
            if (Number.isFinite(pn) && Number.isFinite(qn)) sum += pn * qn
          }
          if (sum > 0) return sum
        }
      } catch (e) {
        /* ignore */
      }
      // Deliberately avoid using `quoteVolume` (24h volume) as orderbook depth.
      return null
    })()
  return {
      symbol,
      buy_exchange: String(buy_exchange).toUpperCase(),
      buy_price,
      sell_exchange: String(sell_exchange).toUpperCase(),
      sell_price,
      profit_pct,
      depth_usd,
  price_binance: null,
  price_kucoin: null,
  price_gate: null,
      size_est: 0,
      gas_est: 0,
      deposit_withdraw: 'W:? / D:?',
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white shadow-sm rounded-lg p-4">
        <div>
          <h2 className="text-xl font-semibold">Market Overview</h2>
          <p className="text-sm text-gray-500">Depth shown is top-of-book USD value where available.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">Mode</div>
          <div className="inline-flex rounded-md shadow-sm bg-gray-50">
            <button onClick={() => setMode('file')} className={`px-3 py-1 text-sm ${mode === 'file' ? 'bg-white font-medium' : 'text-gray-600'}`}>File</button>
            <button onClick={() => setMode('live')} className={`px-3 py-1 text-sm ${mode === 'live' ? 'bg-white font-medium' : 'text-gray-600'}`}>Live</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {Object.keys(feeders).length === 0 ? (
            <div className="text-xs text-gray-500">No feeder status</div>
          ) : (
            Object.entries(feeders).map(([k, v]) => {
              const ok = v && (v.status === 'ok' || v.status === 'running' || v.present === true || v.ok === true)
              const count = (v && (v.symbol_count ?? v.symbols_count ?? v.symbols ?? v.symbol_count_total ?? v.symbol_count)) || v.tickers || v.symbol_count || 0
              const last = v && (v.last_update_ts ? new Date(v.last_update_ts * 1000) : v.last_update ? new Date(String(v.last_update)) : null)
              return (
                <div key={k} className="inline-flex items-center gap-2 px-2 py-1 rounded-md border bg-white shadow-sm text-xs">
                  <div className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                  <div className="font-semibold">{k}</div>
                  <div className="text-gray-500">{count}</div>
                  {last ? <div className="text-gray-400">{last.toLocaleTimeString()}</div> : null}
                </div>
              )
            })
          )}
        </div>
        <div className="ml-4">
          <div className="text-sm text-gray-600">Trend window</div>
          <div className="inline-flex rounded-md shadow-sm bg-gray-50">
            <button onClick={() => setSelectedPeriod('1h')} className={`px-3 py-1 text-sm ${selectedPeriod === '1h' ? 'bg-white font-medium' : 'text-gray-600'}`}>1h <span className="ml-2 text-xs text-gray-500">{Object.keys(hotcoinTrends1h).length}</span></button>
            <button onClick={() => setSelectedPeriod('4h')} className={`px-3 py-1 text-sm ${selectedPeriod === '4h' ? 'bg-white font-medium' : 'text-gray-600'}`}>4h <span className="ml-2 text-xs text-gray-500">{Object.keys(hotcoinTrends4h).length}</span></button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded-lg shadow overflow-hidden">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="text-left">
              <th className="px-4 py-3">Pair</th>
              <th className="px-4 py-3">Binance</th>
              <th className="px-4 py-3">Kucoin</th>
              <th className="px-4 py-3">Gate</th>
              <th className="px-4 py-3">Sell Venue</th>
              <th className="px-4 py-3">Sell Price</th>
              <th className="px-4 py-3">Trend Analysis</th>
              <th className="px-4 py-3">Depth (USD)</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">W / D</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <OpportunityRow key={`${r.symbol}-${r.buy_exchange}-${r.sell_exchange}-${i}`} r={r} i={i} findGatePrice={findGatePriceForSymbol} lastHotMessage={lastHotMessage} gatePrices={gatePrices} feeders={feeders} binancePrices={binancePrices} kucoinPrices={kucoinPrices} binanceVer={binanceVer} kucoinVer={kucoinVer} hotcoinTrends={selectedPeriod === '1h' ? hotcoinTrends1h : hotcoinTrends4h} />
            ))}
          </tbody>
        </table>
      </div>
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">Top Arbitrage Data</h2>
            <button
              onClick={async () => {
                setPreviewLoading(true)
                try {
                  const base = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')) || 'http://localhost:8000'
                  const res = await fetch(`${base}/api/preview-top?limit=5`)
                  if (!res.ok) return
                  const data = await res.json()
                  // map server preview payload into Row[] using existing mapping logic
                  let payload: any[] = []
                  if (Array.isArray(data.preview_candidates_top) && data.preview_candidates_top.length > 0) payload = data.preview_candidates_top
                  else if (Array.isArray(data.candidates) && data.candidates.length > 0) payload = data.candidates
                  else if (Array.isArray(data)) payload = data
                  const mapped = payload.map(mapToRow)
                  setPreviewRows(mapped)
                } catch (e) {
                  // ignore errors
                } finally {
                  setPreviewLoading(false)
                }
              }}
              disabled={previewLoading}
              className={`px-2 py-1 text-sm rounded border ${previewLoading ? 'bg-gray-200 text-gray-400 cursor-wait' : 'bg-gray-100 text-gray-700'}`}
            >
              {previewLoading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                  Refreshing...
                </span>
              ) : (
                'Refresh'
              )}
            </button>
          </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(previewRows && previewRows.length > 0 ? previewRows.slice(0, 6) : rows.slice(0, 6)).map((r, i) => (
          <OpportunityCard
            key={`${r.symbol}-card-${i}`}
            o={{
              buy_exchange: r.buy_exchange,
              sell_exchange: r.sell_exchange,
              symbol: r.symbol,
              buy_price: r.buy_price,
              sell_price: r.sell_price,
              profit_pct: r.profit_pct,
              // preview/funding metadata
              _preview: (r as any)._preview ?? null,
              funding_rate_pct: (r as any).funding_rate_pct ?? null,
              funding_income_6h: (r as any).funding_income_6h ?? null,
              // funding preview details (may live at top-level on the row or inside _preview)
              revenue_usdt: (r as any).revenue_usdt ?? (r as any)._preview?.revenue_usdt ?? (r as any)._preview?.revenue ?? null,
              cumulative_pct: (r as any).cumulative_pct ?? (r as any)._preview?.cumulative_pct ?? null,
              intervals: (r as any).intervals ?? (r as any)._preview?.intervals ?? null,
              funding_last: (r as any).funding_last ?? (r as any)._preview?.last ?? (r as any)._preview?.funding_last ?? null,
              symbol_obj: (r as any).symbol_obj ?? (r as any)._preview?.symbol_obj ?? null,
            }}
          />
        ))}
      </div>
    </div>
  )
}

// Helper badge component (small, presentational)
function Badge({ status, label }: { status: 'enabled' | 'disabled' | 'unknown'; label: string }) {
  const base = 'inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold'
  if (status === 'enabled') return <span className={`${base} bg-green-50 text-green-800 border border-green-100`}>{label}</span>
  if (status === 'disabled') return <span className={`${base} bg-red-50 text-red-800 border border-red-100`}>{label}</span>
  return <span className={`${base} bg-gray-50 text-gray-700 border border-gray-100`}>{label}</span>
}

function ProfitBadge({ value }: { value: number }) {
  // backend returns profit_pct as a percentage (e.g. 5.23 means 5.23%)
  const pct = Number(value || 0)
  const formatted = `${pct.toFixed(2)}%`
  if (pct > 1.0) {
    return <span className="inline-block px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium">▲ {formatted}</span>
  }
  if (pct < -1.0) {
    return <span className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-800 text-sm font-medium">▼ {formatted}</span>
  }
  return <span className="inline-block px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">{formatted}</span>
}

// Render a small network-level status list for a currency detail object returned by the backend
function NetworkTooltip({ title, details }: { title: string; details: any }) {
  if (!details) {
    return (
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-gray-500">No currency metadata available</div>
      </div>
    )
  }

  // details may contain info.networkList or networks or similar shapes from CCXT/MEXC
  const networks: Array<{name: string; deposit?: boolean; withdraw?: boolean; note?: string}> = []

  // Some adapters return an object with networkList (list of dicts)
  if (Array.isArray(details.networkList)) {
    for (const n of details.networkList) {
      const name = String(n.network || n.name || n.chain || n.id || 'unknown')
      const deposit = n.depositEnable ?? n.depositEnable === undefined ? (n.depositEnable ?? undefined) : undefined
      const withdraw = n.withdrawEnable ?? n.withdrawEnable === undefined ? (n.withdrawEnable ?? undefined) : undefined
      const note = n.note || n.status || n.message || undefined
      networks.push({ name, deposit, withdraw, note })
    }
  }

  // Some adapters provide networks as an object map under details.networks or info.networks
  const maybeNetworks = details.networks ?? details.info?.networks ?? details.info?.networkList
  if (maybeNetworks && typeof maybeNetworks === 'object' && !Array.isArray(maybeNetworks)) {
    for (const k of Object.keys(maybeNetworks)) {
      const n = maybeNetworks[k]
      const name = String(n.network || n.name || k || 'unknown')
      const deposit = n.depositEnable ?? n.deposit ?? n.depositEnabled ?? undefined
      const withdraw = n.withdrawEnable ?? n.withdraw ?? n.withdrawEnabled ?? undefined
      const note = n.note || n.status || n.message || undefined
      networks.push({ name, deposit, withdraw, note })
    }
  }

  // Fallback: if details itself looks like a flat currency entry
  if (networks.length === 0) {
    const name = details.id ?? details.code ?? details.currency ?? details.name ?? 'default'
    const deposit = details.depositEnable ?? details.deposit ?? undefined
    const withdraw = details.withdrawEnable ?? details.withdraw ?? undefined
    const note = details.note ?? details.status ?? undefined
    networks.push({ name: String(name), deposit, withdraw, note })
  }

  return (
    <div>
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 space-y-1">
        {networks.map((n, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <div className="w-4 text-xs">{n.withdraw ? 'W✔' : n.withdraw === false ? 'W✖' : 'W?'}</div>
            <div className="w-4 text-xs">{n.deposit ? 'D✔' : n.deposit === false ? 'D✖' : 'D?'}</div>
            <div className="flex-1 text-xs">
              <div className="font-medium text-gray-800">{n.name}</div>
              {n.note ? <div className="text-[11px] text-gray-500">{String(n.note)}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Per-cell Gate price renderer. Memoized at module scope so memoized
// rows can reference it without scoping issues. Accepts a stable
// findGatePrice callback from the parent to read live prices.
const PriceCellGate = React.memo(function PriceCellGate({
  symbol,
  row,
  findGatePrice,
  lastHotMessage,
  gatePrices: gp,
  feeders: fdrs,
}: {
  symbol?: string
  row: Row
  findGatePrice: (s?: string) => number | null
  lastHotMessage: any
  gatePrices?: Record<string, number | null>
  feeders?: Record<string, any>
}) {
  const [flash, setFlash] = React.useState(false)
  const prevRef = React.useRef<number | null>(null)
  const _sourceRef = React.useRef<string>('row')

  
  

  

  // Local normalizer (module-level PriceCellGate cannot access the
  // normalizeSymbolKey declared inside OpportunitiesTable), so provide
  // a copy here.
  const normalize = (s: string | undefined | null) => {
    if (!s) return ''
    return String(s).toUpperCase().replace(/[-\/]/g, '_')
  }

  const price = React.useMemo(() => {
    // prefer explicit backend-provided gate price on the row
    try {
      const p0 = row?.price_gate ?? null
      if (p0 !== null && p0 !== undefined) {
        _sourceRef.current = 'row-field'
        return Number(p0)
      }
      const p1 = findGatePrice(symbol)
      if (p1 !== null && p1 !== undefined) {
        _sourceRef.current = 'gate-prices'
        return Number(p1)
      }
      // fallback: try direct lookup into gatePrices map passed from parent
      if (gp && symbol) {
        const rawUp = String(symbol).toUpperCase()
        const canonical = normalize(rawUp)
        const tryKeys = [canonical, rawUp, rawUp.replace(/[-_]/g, '/'), rawUp.replace(/[_/]/g, '-')]
        for (const k of tryKeys) {
          const nk = normalize(k)
          if (nk in gp) {
            const v = (gp as any)[nk]
            if (v != null) return Number(v)
          }
        }
        // also try concise matching
        for (const k of Object.keys(gp)) {
          if (normalize(k) === canonical) {
            const v = (gp as any)[k]
            if (v != null) return Number(v)
          }
        }
      }
      // final fallback: check feeders (fdrs) for a Gate feeder object in a
      // flexible, case-insensitive way and accept numeric maps or 'bids'/tickers.
      let gfeed: any = null
      try {
        if (fdrs) {
          gfeed = (fdrs as any)['gate'] ?? (fdrs as any)['Gate'] ?? (fdrs as any)['GATE'] ?? null
          if (!gfeed) {
            for (const k of Object.keys(fdrs)) {
              try {
                if (k && String(k).toLowerCase().includes('gate')) {
                  gfeed = (fdrs as any)[k]
                  break
                }
              } catch (e) { /* ignore */ }
            }
          }
        }

        if (gfeed) {
          const maybeIsNumericMap = (obj: any) => {
            if (!obj || typeof obj !== 'object') return false
            const ks = Object.keys(obj)
            if (ks.length === 0) return false
            let checked = 0
            for (const k of ks.slice(0, 5)) {
              const v = obj[k]
              if (v === null || v === undefined) return false
              if (typeof v === 'number') checked++
              else {
                const n = Number(v)
                if (Number.isFinite(n)) checked++
                else return false
              }
            }
            return checked > 0
          }

          const bmap = maybeIsNumericMap(gfeed) ? gfeed : (gfeed.bids ?? gfeed.bid ?? gfeed.depths ?? null)
          const rawUp = String(symbol || '').toUpperCase()
          const canonical = normalize(rawUp)
          const tryKeys = [rawUp, rawUp.replace(/[-_]/g, '/'), rawUp.replace(/[_/]/g, '-'), canonical]

          if (bmap && typeof bmap === 'object') {
            for (const k of tryKeys) {
              const val = bmap[k] ?? bmap[normalize(k)] ?? bmap[k.replace('/', '_')]
              if (val != null) {
                  const n = Number(val)
                  if (Number.isFinite(n)) {
                    _sourceRef.current = 'gate-bids'
                    return n
                  }
                }
            }
            for (const bk of Object.keys(bmap)) {
              if (normalize(bk) === canonical) {
                const n = Number(bmap[bk])
                if (Number.isFinite(n)) {
                  _sourceRef.current = 'gate-bids'
                  return n
                }
              }
            }
          }

          const tmap = gfeed.tickers || gfeed.ticker || gfeed.book_tickers || null
          if (tmap && typeof tmap === 'object') {
            for (const k of tryKeys) {
              const tk = tmap[k] ?? tmap[normalize(k)] ?? tmap[k.replace('/', '_')]
              if (tk && typeof tk === 'object' && tk.last != null) {
                const n = Number(tk.last)
                if (Number.isFinite(n)) {
                  _sourceRef.current = 'gate-tickers'
                  return n
                }
              }
            }
          }
        }
      } catch (e) {
        /* ignore */
      }
    } catch (e) {
      /* ignore */
    }
    return null
  }, [symbol, row?.price_gate, findGatePrice, gp, fdrs])

  React.useEffect(() => {
    const prev = prevRef.current
    if (prev != null && price != null && price !== prev) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 350)
      return () => clearTimeout(t)
    }
    prevRef.current = price
    return
  }, [price])

  // If the sell venue is HOT and a lastHotMessage is available, prefer
  // showing the hot price when appropriate (keeps behavior consistent)
  const display = React.useMemo(() => {
    try {
      if (row?.sell_exchange === 'HOT' && lastHotMessage && Array.isArray(lastHotMessage.payload)) {
        const hot = (lastHotMessage.payload as any[]).find(h => (h.symbol || '').toUpperCase() === (symbol || '').toUpperCase())
        if (hot) {
          const hp = Number(hot.best_bid ?? hot.bestBid ?? hot.bid ?? hot.last ?? null)
          if (Number.isFinite(hp)) return hp
        }
      }
    } catch (e) {}
    return price
  }, [row?.sell_exchange, lastHotMessage, price, symbol])

  

  return (
    <span className={`inline-block ${flash ? 'bg-yellow-100' : ''} px-1 py-0.5 rounded`}>
      {display != null ? Number(display).toLocaleString(undefined, { maximumFractionDigits: 8 }) : '—'}
  {/* source labels removed for UI cleanliness */}
    </span>
  )
})

// Memoized row component to avoid re-rendering entire rows unless their
// props change. This prevents table flicker when only Gate prices update.
const OpportunityRow = React.memo(function OpportunityRow({ r, i, findGatePrice, lastHotMessage, gatePrices: gp, feeders: fdrs, binancePrices: bp, kucoinPrices: kp, binanceVer, kucoinVer, hotcoinTrends }: { r: Row; i: number; findGatePrice: (s?: string) => number | null; lastHotMessage: any; gatePrices?: Record<string, number | null>; feeders?: Record<string, any>; binancePrices?: Record<string, number | null>; kucoinPrices?: Record<string, number | null>; binanceVer?: number; kucoinVer?: number; hotcoinTrends?: Record<string, string> }) {
  function TrendBadge({ trend }: { trend: string | null }) {
    if (!trend) return null
    const t = String(trend)
    const base = 'inline-flex items-center gap-2 whitespace-nowrap rounded-full text-sm font-medium justify-center'
    const common = `${base} px-2 py-1 min-w-[82px]`
    if (t.includes('Bull')) return <span className={`${common} bg-emerald-100 text-emerald-800`}>▲ <span className="truncate">{t}</span></span>
    if (t.includes('Bear')) return <span className={`${common} bg-rose-100 text-rose-800`}>▼ <span className="truncate">{t}</span></span>
    return <span className={`${common} bg-gray-100 text-gray-800`}><span className="truncate">{t}</span></span>
  }

  return (
    <tr key={`${r.symbol}-${r.buy_exchange}-${r.sell_exchange}-${i}`} className="border-t hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-sm">{r.symbol}</td>
  <td className="px-4 py-3 text-sm"><PriceCellExchange exchange={'binance'} symbol={r.symbol} row={r} feeders={Object.assign({}, fdrs || {}, (bp && Object.keys(bp).length > 0) ? { binance: { bids: bp } } : {})} lastHotMessage={lastHotMessage} feedVersion={binanceVer} exchangePrices={bp} /></td>
  <td className="px-4 py-3 text-sm"><PriceCellExchange exchange={'kucoin'} symbol={r.symbol} row={r} feeders={Object.assign({}, fdrs || {}, (kp && Object.keys(kp).length > 0) ? { kucoin: { bids: kp } } : {})} lastHotMessage={lastHotMessage} feedVersion={kucoinVer} exchangePrices={kp} /></td>
  <td className="px-4 py-3 text-sm"><PriceCellGate symbol={r.symbol} row={r} findGatePrice={findGatePrice} lastHotMessage={lastHotMessage} gatePrices={gp} feeders={fdrs} /></td>
      <td className="px-4 py-3 text-sm">{r.sell_exchange}</td>
      <td className="px-4 py-3 text-sm">{(() => {
        try {
          if (r.sell_exchange === 'HOT' && lastHotMessage && Array.isArray(lastHotMessage.payload)) {
            const hot = (lastHotMessage.payload as any[]).find(h => (h.symbol || '').toUpperCase() === (r.symbol || '').toUpperCase())
            if (hot) {
              const price = Number(hot.best_bid ?? hot.bestBid ?? hot.bid ?? hot.last ?? r.sell_price)
              return Number(price).toLocaleString(undefined, {maximumFractionDigits: 8})
            }
          }
        } catch (e) {}
        return Number(r.sell_price).toLocaleString(undefined, {maximumFractionDigits: 8})
      })()}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <div>
            {hotcoinTrends && hotcoinTrends[(r.symbol || '').toUpperCase()] ? (
              <TrendBadge trend={hotcoinTrends[(r.symbol || '').toUpperCase()]} />
            ) : (
              <ProfitBadge value={r.profit_pct} />
            )}
          </div>
          {(r.funding_rate_pct !== null && r.funding_rate_pct !== undefined) || (r.funding_income_6h !== null && r.funding_income_6h !== undefined) ? (
            <div className="text-xs text-gray-500 mt-1">
              {r.funding_rate_pct != null ? <span className="mr-2">Funding: {Number(r.funding_rate_pct).toFixed(4)}%</span> : null}
              {r.funding_income_6h != null ? <span>Est 6h: ${Number(r.funding_income_6h).toFixed(2)}</span> : null}
            </div>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">{r.depth_usd !== null ? `$${Number(r.depth_usd).toLocaleString(undefined, {maximumFractionDigits:0})}` : '—'}</td>
      <td className="px-4 py-3 text-sm">{Number(r.size_est).toLocaleString()}</td>
      <td className="px-4 py-3">{(() => {
        const s = String(r.deposit_withdraw || '')
        const wMatch = s.match(/W[: ]?([✔✖\?]|true|false|yes|no|1|0)/i)
        const dMatch = s.match(/D[: ]?([✔✖\?]|true|false|yes|no|1|0)/i)
        const parse = (m: RegExpMatchArray | null) => {
          if (!m) return 'unknown'
          const v = m[1].toLowerCase()
          if (v === '✔' || v === 'true' || v === 'yes' || v === '1') return 'enabled'
          if (v === '✖' || v === 'false' || v === 'no' || v === '0') return 'disabled'
          return 'unknown'
        }
        const w = parse(wMatch)
        const d = parse(dMatch)
        return (
          <div className="relative group">
            <div className="flex items-center gap-2">
              <Badge status={w as any} label="W" />
              <Badge status={d as any} label="D" />
            </div>
            <div className="pointer-events-none">
              <div className="absolute left-0 mt-2 w-72 hidden group-hover:block z-20">
                <div className="bg-white border rounded-lg shadow p-3 text-sm text-gray-800">
                  <NetworkTooltip title="Buy token" details={r.buy_currency_details} />
                  <div className="h-px bg-gray-100 my-2" />
                  <NetworkTooltip title="Sell token" details={r.sell_currency_details} />
                </div>
              </div>
            </div>
          </div>
        )
      })()}</td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button className="px-3 py-1 rounded-md border border-sky-200 text-sky-700 text-sm">Simulate</button>
          <button className="px-3 py-1 rounded-md bg-emerald-600 text-white text-sm">Execute</button>
        </div>
      </td>
    </tr>
  )
})

// Generic per-exchange price cell used for Binance/KuCoin. It reads
// feeders[exchange] for bids/tickers and falls back to explicit row
// price fields (e.g. row.price_binance) and hot messages when appropriate.
const PriceCellExchange = React.memo(function PriceCellExchange({
  exchange,
  symbol,
  row,
  feeders,
  lastHotMessage,
  feedVersion,
  exchangePrices,
}: {
  exchange: string
  symbol?: string
  row: Row
  feeders?: Record<string, any>
  lastHotMessage: any
  feedVersion?: number
  exchangePrices?: Record<string, number | null>
}) {
  const [flash, setFlash] = React.useState(false)
  const prevRef = React.useRef<number | null>(null)
  const _sourceRef = React.useRef<string>('row')

  const normalize = (s: string | undefined | null) => {
    if (!s) return ''
    return String(s).toUpperCase().replace(/[-\/]/g, '_')
  }

  const price = React.useMemo(() => {
    try {
      // If an explicit per-exchange polled prices map is supplied, prefer it.
      if (exchangePrices && symbol) {
        const nk = normalize(String(symbol).toUpperCase())
        const tryKeys = [nk, String(symbol).toUpperCase(), String(symbol).toUpperCase().replace(/[-_]/g, '/'), String(symbol).toUpperCase().replace(/[_/]/g, '-')]
        for (const k of tryKeys) {
          if (k in exchangePrices) {
            const v = (exchangePrices as any)[k]
            if (v != null && Number.isFinite(Number(v))) {
              _sourceRef.current = 'exchange-prices'
              return Number(v)
            }
          }
        }
      }
      const rawUp = String(symbol || '').toUpperCase()
      const canonical = normalize(rawUp)
      const tryKeys = [canonical, rawUp, rawUp.replace(/[-_]/g, '/'), rawUp.replace(/[_/]/g, '-')]

      // resolve feeder object case-insensitively; backend may use 'Binance' or 'binance'
      let feed: any = null
      if (feeders) {
        feed = (feeders as any)[exchange] ?? (feeders as any)[exchange.toLowerCase()] ?? (feeders as any)[exchange.toUpperCase()]
        if (!feed) {
          for (const k of Object.keys(feeders)) {
            try {
              if (k && String(k).toLowerCase().includes(String(exchange).toLowerCase())) {
                feed = (feeders as any)[k]
                break
              }
            } catch (e) { /* ignore */ }
          }
        }
      }
      if (feed) {
        // accept multiple possible fields containing prices
        const maybeIsNumericMap = (obj: any) => {
          if (!obj || typeof obj !== 'object') return false
          const ks = Object.keys(obj)
          if (ks.length === 0) return false
          let checked = 0
          for (const k of ks.slice(0, 5)) {
            const v = obj[k]
            if (v === null || v === undefined) return false
            if (typeof v === 'number') checked++
            else {
              const n = Number(v)
              if (Number.isFinite(n)) checked++
              else return false
            }
          }
          return checked > 0
        }

        // Prefer tickers/book_tickers last price when available because some
        // feeders expose numeric maps that are actually orderbook depths or
        // notional values (these are not actual top-of-book prices).
        const tmap = feed.tickers || feed.ticker || feed.book_tickers || feed.tickers_map || feed.tks || null
        if (tmap && typeof tmap === 'object') {
          for (const k of tryKeys) {
            const tk = tmap[k] ?? tmap[normalize(k)] ?? tmap[k.replace('/', '_')]
            if (tk && typeof tk === 'object' && tk.last != null) {
              const n = Number(tk.last)
                if (Number.isFinite(n)) {
                  _sourceRef.current = 'tickers'
                  return n
                }
            }
          }
          for (const tkKey of Object.keys(tmap)) {
            if (normalize(tkKey) === canonical) {
              const tk = tmap[tkKey]
              if (tk && typeof tk === 'object' && tk.last != null) {
                const n = Number(tk.last)
                  if (Number.isFinite(n)) {
                    _sourceRef.current = 'tickers'
                    return n
                  }
              }
            }
          }
        }

    // Prefer real price maps (bids/tickers). Treat feed.depths as depth/notional
    // maps and avoid using them as prices unless they match row.sell_price.
    // If a feeder exposes an explicit `depths` map but no `bids`/`tickers`,
    // it's almost certainly an orderbook notional map and should NOT be
    // treated as a top-of-book price source.
  const explicitDepthMap = feed.depths ?? feed.depth ?? feed.depth_map ?? null
  const hasExplicitDepthOnly = !!explicitDepthMap && !(feed.bids || feed.tickers || feed.ticker || feed.book_tickers)
  const bmap = hasExplicitDepthOnly ? null : (maybeIsNumericMap(feed) ? feed : (feed.bids ?? feed.bid ?? feed.best_bids ?? null))
  const isPollerMap = !!(feed && (feed.bids)) && !hasExplicitDepthOnly
        if (bmap && typeof bmap === 'object') {
          // Aggressive matching: build a map of possible normalized keys -> value
          const variantMap: Record<string, number> = {}
          const addVariant = (k: string, v: any) => {
            try {
              const n = Number(v)
              if (!Number.isFinite(n)) return
              const up = String(k).toUpperCase()
              const noSep = up.replace(/[-_\\/]/g, '')
              const undersc = up.replace(/[-\\/]/g, '_')
              const slash = up.replace(/[_-]/g, '/')
              variantMap[up] = n
              variantMap[noSep] = n
              variantMap[undersc] = n
              variantMap[slash] = n
            } catch (e) { /* ignore */ }
          }

          for (const bk of Object.keys(bmap)) {
            addVariant(bk, (bmap as any)[bk])
          }

          // Also add tryKeys directly
          for (const k of tryKeys) addVariant(k, (bmap as any)[k])

          const lookupKeys = [rawUp, canonical, rawUp.replace(/[-_]/g, '/'), rawUp.replace(/[_/]/g, '-'), rawUp.replace(/[-_\\/]/g, '')]

          // Heuristic: detect whether this numeric map is actually an
          // orderbook-notional/depth map (large values) by sampling values
          // and checking the median. If it's likely depth, don't treat it
          // as a price even if it came from our poller.
          const sampleVals: number[] = []
          try {
            for (const k of Object.keys(variantMap).slice(0, 40)) {
              const vv = Number((variantMap as any)[k])
              if (Number.isFinite(vv)) sampleVals.push(Math.abs(vv))
            }
          } catch (e) { /* ignore */ }
          const median = (() => {
            if (sampleVals.length === 0) return 0
            const s = sampleVals.slice().sort((a,b) => a-b)
            const m = Math.floor(s.length/2)
            return s.length % 2 === 1 ? s[m] : (s[m-1]+s[m])/2
          })()

          // rowSell helps disambiguate; if median is huge compared to rowSell
          // this map is likely depth.
          const rowSellNum = (() => { try { const n = Number((row as any).sell_price); return Number.isFinite(n) ? n : null } catch (e) { return null } })()
          const isLikelyDepth = median > 1000 && rowSellNum !== null && (median / Math.max(Math.abs(rowSellNum), 1) > 10)

          for (const lk of lookupKeys) {
            const v = variantMap[lk]
            if (v != null) {
              // If this came from the poller and it's NOT likely a depth map,
              // accept it as a live price. Otherwise be conservative.
              try {
                if (isPollerMap && !isLikelyDepth) {
                  _sourceRef.current = 'depths'
                  return v
                }
              } catch (e) { /* ignore */ }

              try {
                if (feedVersion && Number.isFinite(feedVersion) && Number(feedVersion) > 0 && !isLikelyDepth) {
                  _sourceRef.current = 'depths'
                  return v
                }
              } catch (e) { /* ignore */ }

              try {
                if (rowSellNum !== null) {
                  const rel = Math.abs(Number(v) - rowSellNum) / Math.max(Math.abs(rowSellNum), 1)
                  if (rel < 0.5) {
                    _sourceRef.current = 'depths'
                    return v
                  }
                }
              } catch (e) { /* ignore */ }
              // ambiguous numeric map: skip
            }
          }

          // As a final fallback, try longer heuristic candidates
          const commonQuotes = ['USDT', 'USDC', 'BUSD', 'BTC', 'ETH', 'USD']
          for (const q of commonQuotes) {
            if (rawUp.endsWith(q)) {
              const base = rawUp.slice(0, rawUp.length - q.length)
              if (!base) continue
              const candidates = [base + q, `${base}_${q}`, `${base}/${q}`, `${base}-${q}`, `${base}${q}`]
              for (const c of candidates) {
                const v = variantMap[c.toUpperCase()]
                if (v != null) return v
              }
            }
          }
        }
      }
        // If we reached here, no feeder-derived price was found.
        // Prefer explicit per-row field (price_binance, price_kucoin) when present.
        const fld = `price_${exchange}`
        const p0 = (row as any)[fld]
        if (p0 !== undefined && p0 !== null) return Number(p0)

        // fallback: preserve previous behavior where the table showed the
        // row's sell_price as a general fallback. Prefer sell_price when it's a finite value.
        try {
          const sp = Number((row as any).sell_price)
          if (Number.isFinite(sp) && sp !== 0) return sp
        } catch (e) {}
        // still allow using buy/sell venue-specific prices if present
        try {
          if (row && row.buy_exchange === exchange.toUpperCase() && row.buy_price) return Number(row.buy_price)
        } catch (e) {}
        try {
          if (row && row.sell_exchange === exchange.toUpperCase() && row.sell_price) return Number(row.sell_price)
        } catch (e) {}
    } catch (e) {
      /* ignore */
    }
    return null
  }, [exchange, symbol, row?.price_binance, row?.price_kucoin, feeders, feedVersion, exchangePrices])

  // Dev-only logging for debugging missing matches. Log each symbol once.
  const _loggedRef = React.useRef<Record<string, boolean>>({})
  React.useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const dev = (process && (process.env && process.env.NODE_ENV) ? process.env.NODE_ENV : undefined) !== 'production'
      if (!dev) return
      const key = `${exchange}:${symbol || ''}`
      if (price == null && !_loggedRef.current[key]) {
        _loggedRef.current[key] = true
          try {
          const feed = feeders && (feeders as any)[exchange]
          console.debug('PriceCellExchange debug', { exchange, symbol, row_price: (row as any)[`price_${exchange}`], feed_keys: feed ? Object.keys(feed).slice(0,10) : null, priceMapSample: feed ? Object.entries(feed).slice(0,5) : null, source: _sourceRef.current })
        } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
  }, [price, exchange, symbol, feeders, row])

  React.useEffect(() => {
    const prev = prevRef.current
    if (prev != null && price != null && price !== prev) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 350)
      return () => clearTimeout(t)
    }
    prevRef.current = price
    return
  }, [price])

  const display = React.useMemo(() => {
    try {
      if (row?.sell_exchange === 'HOT' && lastHotMessage && Array.isArray(lastHotMessage.payload)) {
        const hot = (lastHotMessage.payload as any[]).find(h => (h.symbol || '').toUpperCase() === (symbol || '').toUpperCase())
        if (hot) {
          const hp = Number(hot.best_bid ?? hot.bestBid ?? hot.bid ?? hot.last ?? null)
          if (Number.isFinite(hp)) return hp
        }
      }
    } catch (e) {}
    return price
  }, [row?.sell_exchange, lastHotMessage, price, symbol])

  return (
    <span className={`inline-block ${flash ? 'bg-yellow-100' : ''} px-1 py-0.5 rounded`}>
      {display != null ? Number(display).toLocaleString(undefined, { maximumFractionDigits: 8 }) : '—'}
      {/* source labels removed for UI cleanliness */}
    </span>
  )
})
