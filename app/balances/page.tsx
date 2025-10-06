'use client'

import React from 'react'

type BalancesMap = { [asset: string]: { free: number; locked?: number } }

export default function Page() {
  const [binance, setBinance] = React.useState<BalancesMap | null>(null)
  const [binanceSummary, setBinanceSummary] = React.useState<any | null>(null)
  const [mexc, setMexc] = React.useState<BalancesMap | null>(null)
  const [mexcSummary, setMexcSummary] = React.useState<any | null>(null)
  const [binanceTickers, setBinanceTickers] = React.useState<{[k:string]:number}>({})
  const [mexcTickers, setMexcTickers] = React.useState<{[k:string]:number}>({})
  const [loading, setLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)
  const [showZeros, setShowZeros] = React.useState<boolean>(false)

  async function fetchBalances() {
    setLoading(true)
    setError(null)
    try {
      // When running the frontend dev server (Next) it serves on a different
      // origin and may return 404 for /api/* paths. Use explicit backend base
      // when running locally so we contact the FastAPI server directly.
      const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      const base = isLocal ? 'http://127.0.0.1:8000' : ''
      const [bRes, mRes] = await Promise.all([
        fetch(base + '/api/balances/binance'),
        fetch(base + '/api/balances/mexc'),
      ])
      if (!bRes.ok) throw new Error('binance fetch failed: ' + bRes.status)
      if (!mRes.ok) throw new Error('mexc fetch failed: ' + mRes.status)
      const bJson = await bRes.json()
      const mJson = await mRes.json()
      // bJson might be either the map or an object with error; the backend now
      // returns {balances: {...}, summary: {...}} in our fetch helper, but the
      // API endpoint returns a simple map. Normalize both cases.
      if (bJson && bJson.balances) {
        setBinance(bJson.balances)
        setBinanceSummary(bJson.summary || null)
      } else if (bJson && typeof bJson === 'object' && !bJson.error) {
        // assume it's already the map
        setBinance(bJson)
        setBinanceSummary(null)
      } else {
        setBinance(null)
        setBinanceSummary(null)
      }

      if (mJson && mJson.balances) {
        setMexc(mJson.balances)
        setMexcSummary(mJson.summary || null)
      } else if (mJson && typeof mJson === 'object' && !mJson.error) {
        setMexc(mJson)
        setMexcSummary(null)
      } else {
        setMexc(null)
        setMexcSummary(null)
      }
      // fetch tickers as well
      try {
  const [bt, mt] = await Promise.all([fetch(base + '/api/tickers/binance'), fetch(base + '/api/tickers/mexc')])
        if (bt.ok) setBinanceTickers(await bt.json())
        if (mt.ok) setMexcTickers(await mt.json())
      } catch (e) {
        // ignore tickers
      }
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { fetchBalances() }, [])

  function renderTable(data: BalancesMap | null) {
    if (!data) return <div className="text-slate-500">No data</div>
    let rows = Object.entries(data).sort((a,b)=> a[0].localeCompare(b[0]))
    if (!showZeros) {
      rows = rows.filter(([_, v]) => {
        try {
          return Number(v.free || 0) !== 0 || Number(v.locked || 0) !== 0
        } catch (e) {
          return false
        }
      })
    }
    return (
      <table className="min-w-full text-xs md:text-sm">
        <thead>
          <tr className="border-b border-slate-700/50">
            <th className="text-left px-1 md:px-2 py-2 md:py-3 text-slate-400 font-semibold uppercase tracking-wider">Asset</th>
            <th className="text-right px-1 md:px-2 py-2 md:py-3 text-slate-400 font-semibold uppercase tracking-wider">Free</th>
            <th className="text-right px-1 md:px-2 py-2 md:py-3 text-slate-400 font-semibold uppercase tracking-wider hidden sm:table-cell">Locked</th>
            <th className="text-right px-1 md:px-2 py-2 md:py-3 text-slate-400 font-semibold uppercase tracking-wider">USD</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([asset, v]) => (
            <tr key={asset} className="border-t border-slate-700/30 hover:bg-slate-700/20 transition-colors">
              <td className="px-1 md:px-2 py-2 font-mono text-white">{asset}</td>
              <td className="px-1 md:px-2 py-2 text-right text-slate-300">{Number(v.free).toLocaleString()}</td>
              <td className="px-1 md:px-2 py-2 text-right text-slate-300 hidden sm:table-cell">{Number(v.locked || 0).toLocaleString()}</td>
              <td className="px-1 md:px-2 py-2 text-right text-cyan-400 font-semibold">{Number(((v.free||0) + (v.locked||0)) * (getUsdPriceForAsset(asset) || 0)).toLocaleString(undefined, {style:'currency', currency:'USD'})}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  function getUsdPriceForAsset(asset: string) {
    const sym = asset.toUpperCase()
    // try direct matches like BTCUSDT, ETHUSDT
    const direct1 = sym + 'USDT'
    const direct2 = sym + '/USDT'
    const btk = (binanceTickers && (binanceTickers[direct1] || binanceTickers[direct2]))
    if (btk) return btk
    const mtk = (mexcTickers && (mexcTickers[direct1] || mexcTickers[direct2]))
    if (mtk) return mtk
    // fallback to known quote pairs
    if (sym === 'USDT' || sym === 'USD') return 1.0
    return 0
  }

  // compute per-venue USD totals
  function computeUsdTotal(data: BalancesMap | null) {
    if (!data) return 0
    let tot = 0
    for (const [asset, v] of Object.entries(data)) {
      try {
        const amt = Number((v.free || 0) + (v.locked || 0))
        const price = getUsdPriceForAsset(asset) || 0
        tot += amt * price
      } catch (e) { continue }
    }
    return tot
  }

  const binanceUsd = computeUsdTotal(binance)
  const mexcUsd = computeUsdTotal(mexc)
  const combinedUsd = binanceUsd + mexcUsd

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
              Balances
            </h1>
            <p className="text-sm md:text-base text-slate-400">Your connected exchange balances and USD equivalents</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4">
            <div className="text-left sm:text-right bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-3 md:p-4 border border-cyan-500/30 w-full sm:w-auto">
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Combined Net Worth</div>
              <div className="text-xl md:text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                {combinedUsd.toLocaleString(undefined, {style:'currency', currency:'USD'})}
              </div>
            </div>
            <button 
              onClick={() => fetchBalances()} 
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-lg font-semibold shadow-lg shadow-cyan-500/20 transition-all"
            >
              Refresh
            </button>
          </div>
        </header>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4 mb-4 md:mb-6">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input 
              type="checkbox" 
              checked={showZeros} 
              onChange={(e) => setShowZeros(e.target.checked)}
              className="rounded bg-slate-800 border-slate-600 text-cyan-500 focus:ring-cyan-500/50"
            />
            <span>Show zero balances</span>
          </label>
          {loading && <div className="text-sm text-cyan-400 animate-pulse">Loading...</div>}
          {error && <div className="text-sm text-red-400 bg-red-500/10 px-3 py-1 rounded border border-red-500/30">{error}</div>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          <section className="lg:col-span-7 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg shadow-lg border border-slate-700/50 p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
              <h2 className="text-lg md:text-xl font-semibold text-white">Binance</h2>
              <div className="text-left sm:text-right bg-slate-800/50 rounded-lg px-3 md:px-4 py-2 border border-slate-700/50">
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">USD Total</div>
                <div className="text-base md:text-lg font-bold text-cyan-400">
                  {binanceUsd.toLocaleString(undefined, {style:'currency', currency:'USD'})}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              {binanceSummary ? (
                <div className="text-sm text-slate-300">
                  <div className="mb-3 text-slate-400 text-xs md:text-sm">
                    Total assets: <span className="text-white font-semibold">{binanceSummary.total_assets}</span> · 
                    Non-zero: <span className="text-cyan-400 font-semibold">{binanceSummary.non_zero_count}</span>
                  </div>
                  <ul className="space-y-2">
                    {Object.entries(binanceSummary.non_zero).map(([asset, v]) => (
                      <li key={asset} className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 font-mono bg-slate-800/50 rounded px-3 py-2 border border-slate-700/30 text-xs md:text-sm">
                        <span className="text-white">{asset}</span>
                        <span className="text-slate-300">
                          {Number((v as any).total).toLocaleString()} · 
                          <span className="text-cyan-400 ml-2 font-semibold">
                            {Number(((v as any).total) * (getUsdPriceForAsset(asset) || 0)).toLocaleString(undefined, {style:'currency', currency:'USD'})}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : renderTable(binance)}
            </div>
          </section>

          <aside className="lg:col-span-5 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg shadow-lg border border-slate-700/50 p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
              <h2 className="text-lg md:text-xl font-semibold text-white">MEXC</h2>
              <div className="text-left sm:text-right bg-slate-800/50 rounded-lg px-3 md:px-4 py-2 border border-slate-700/50">
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">USD Total</div>
                <div className="text-base md:text-lg font-bold text-cyan-400">
                  {mexcUsd.toLocaleString(undefined, {style:'currency', currency:'USD'})}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              {mexcSummary ? (
                <div className="text-sm text-slate-300">
                  <div className="mb-3 text-slate-400 text-xs md:text-sm">
                    Total assets: <span className="text-white font-semibold">{mexcSummary.total_assets}</span> · 
                    Non-zero: <span className="text-cyan-400 font-semibold">{mexcSummary.non_zero_count}</span>
                  </div>
                  <ul className="space-y-2">
                    {Object.entries(mexcSummary.non_zero).map(([asset, v]) => (
                      <li key={asset} className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 font-mono bg-slate-800/50 rounded px-3 py-2 border border-slate-700/30 text-xs md:text-sm">
                        <span className="text-white">{asset}</span>
                        <span className="text-slate-300">
                          {Number((v as any).total).toLocaleString()} · 
                          <span className="text-cyan-400 ml-2 font-semibold">
                            {Number(((v as any).total) * (getUsdPriceForAsset(asset) || 0)).toLocaleString(undefined, {style:'currency', currency:'USD'})}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : renderTable(mexc)}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
