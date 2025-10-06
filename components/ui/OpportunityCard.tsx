import React from 'react'
import { appendLog } from '../ExecutionConsole'

type Opp = {
  buy_exchange: string
  sell_exchange: string
  symbol: string
  buy_price: number
  sell_price: number
  profit_pct: number
  _preview?: any
  funding_rate_pct?: number | null
  funding_income_6h?: number | null
  revenue_usdt?: number | null
  cumulative_pct?: number | null
  intervals?: any
  funding_last?: number | null
  symbol_obj?: any
}

export default function OpportunityCard({ o }: { o: Opp }) {
  const [result, setResult] = React.useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [dryRun, setDryRun] = React.useState(true)
  const [liveConfirm, setLiveConfirm] = React.useState(false)
  const [onChainConfirm, setOnChainConfirm] = React.useState(false)
  const [slippage, setSlippage] = React.useState(1.0)

  async function onExecute() {
    setLoading(true)
    setResult('running...')
    try {
      let apiKey: string | null = null
      try { apiKey = window.localStorage.getItem('arb:apiKey') } catch {}
      if (!apiKey) apiKey = 'demo-key'
      const res = await fetch('http://localhost:8000/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ opportunity: o, amount: 0.01, dry_run: true }),
      })
      const dataText = await res.text()
      let pretty = dataText
      try { pretty = JSON.stringify(JSON.parse(dataText), null, 2) } catch {}
      setResult('ok')
      appendLog(`Execute result for ${o.symbol}: ${pretty}`)
    } catch (e: any) {
      setResult('error')
      appendLog(`Execute error for ${o.symbol}: ${String(e)}`)
    } finally {
      setLoading(false)
      setConfirmOpen(false)
    }
  }
  return (
    <div className="p-4 border rounded-lg bg-white shadow">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">{o.symbol}</div>
          <div className="text-sm text-gray-500">
            {/* If funding data is present, show which side is getting paid.
                If funding_rate_pct is missing, try cumulative_pct or preview fields as fallback. */}
            {(() => {
              const candidates = [
                (o as any).funding_rate_pct,
                (o as any).cumulative_pct,
                (o as any)._preview?.funding_rate_pct,
                (o as any)._preview?.cumulative_pct,
                (o as any)._preview?.funding_rate,
              ]
              let fr: number | null = null
              for (const v of candidates) {
                if (v === undefined || v === null) continue
                const n = Number(v)
                if (Number.isFinite(n)) {
                  fr = n
                  break
                }
              }
              const fallback = `Buy: ${o.buy_exchange} • Sell: ${o.sell_exchange}`
              if (fr === null) return fallback
              // Note: cumulative_pct is expressed in percent; sign is sufficient
              if (fr > 0) return 'Longs → Shorts (long holders pay)'
              if (fr < 0) return 'Shorts → Longs (short holders pay)'
              return fallback
            })()}
          </div>
        </div>
        <div className="text-right">
         
          <div className="mt-1 text-md font-medium text-emerald-700">{o.profit_pct.toFixed(3)}%</div>
          {/* show funding-based preview details when present */}
          {((o as any).revenue_usdt !== undefined && (o as any).revenue_usdt !== null) || (o.funding_rate_pct !== undefined && o.funding_rate_pct !== null) ? (
            <div className="text-xs text-gray-500 mt-1">
              {(o as any).revenue_usdt != null ? <div className="text-sm text-gray-700">Est revenue: ${Number((o as any).revenue_usdt).toFixed(2)}</div> : null}
              {(o as any).cumulative_pct != null ? <div className="text-sm text-gray-600">Cumulative: {Number((o as any).cumulative_pct).toFixed(4)}%</div> : null}
              {(o as any).intervals != null ? <div className="text-sm text-gray-600">Intervals: {Number((o as any).intervals)}</div> : null}
              {o.funding_rate_pct != null ? <div className="text-sm text-gray-600">Last funding rate: {Number(o.funding_rate_pct).toFixed(6)}%</div> : null}
              {o.funding_income_6h != null ? <span className="text-sm">Est 6h: ${Number(o.funding_income_6h).toFixed(2)}</span> : null}
              {(o as any).funding_last != null ? <div className="text-xs text-gray-500 mt-1">Last funding: {(o as any).funding_last.fundingTime ? new Date(Number((o as any).funding_last.fundingTime)).toLocaleString() : JSON.stringify((o as any).funding_last)}</div> : null}
            </div>
          ) : null}
          {/* preview badge intentionally hidden — keep metadata attached for debugging */}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button onClick={() => setConfirmOpen(true)} className="px-3 py-1 rounded bg-indigo-600 text-white" disabled={loading}>Execute</button>
        <div className="text-sm text-gray-500">{result}</div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h3 className="text-lg font-semibold mb-2">Confirm Execute</h3>
            <p className="mb-4">Execute {o.symbol} — buy {o.buy_exchange} at {o.buy_price} and sell {o.sell_exchange} at {o.sell_price}?</p>
            <div className="mb-4">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                <span className="text-sm">Dry run (do not place live orders)</span>
              </label>
              {!dryRun && (
                <div className="mt-2">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={liveConfirm} onChange={(e) => setLiveConfirm(e.target.checked)} />
                    <span className="text-sm text-red-600">I understand this will place live orders</span>
                  </label>
                  <div className="mt-2">
                    <label className="block text-sm">Slippage tolerance (%)</label>
                    <input type="number" value={slippage} onChange={(e)=> setSlippage(Number(e.target.value))} className="mt-1 px-2 py-1 border rounded w-24" />
                  </div>
                  <div className="mt-2">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={onChainConfirm} onChange={(e)=> setOnChainConfirm(e.target.checked)} />
                      <span className="text-sm text-red-700">I confirm this will perform an on-chain transaction (TESTNET ONLY)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmOpen(false)} className="px-3 py-1 rounded border" disabled={loading}>Cancel</button>
              <button
                onClick={async () => {
                  // call the same onExecute but allow override for dryRun
                  setLoading(true)
                  try {
                    let apiKey: string | null = null
                    try { apiKey = window.localStorage.getItem('arb:apiKey') } catch {}
                    if (!apiKey) apiKey = 'demo-key'
                    const isDex = (o.buy_exchange && o.buy_exchange.startsWith('DEX')) || (o.sell_exchange && o.sell_exchange.startsWith('DEX'))
                    const body: any = { opportunity: o, amount: 0.01, dry_run: dryRun }
                    if (isDex && !dryRun) {
                      body.allow_live = true
                      body.slippage = Number(slippage)
                    }
                    const res = await fetch('http://localhost:8000/execute', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
                      body: JSON.stringify(body),
                    })
                    const text = await res.text()
                    let pretty = text
                    try { pretty = JSON.stringify(JSON.parse(text), null, 2) } catch {}
                    setResult(dryRun ? 'simulated' : 'ok')
                    appendLog(`Execute (${dryRun ? 'dry' : 'live'}) result for ${o.symbol}: ${pretty}`)
                  } catch (e: any) {
                    setResult('error')
                    appendLog(`Execute error for ${o.symbol}: ${String(e)}`)
                  } finally {
                    setLoading(false)
                    setConfirmOpen(false)
                  }
                }}
                className="px-3 py-1 rounded bg-emerald-600 text-white"
                disabled={loading || (!dryRun && (!liveConfirm || ((o.buy_exchange.startsWith('DEX') || o.sell_exchange.startsWith('DEX')) && !onChainConfirm)))}
              >
                {loading ? 'Sending...' : dryRun ? 'Confirm (dry)' : 'Confirm (live)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
