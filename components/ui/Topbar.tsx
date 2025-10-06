import React from 'react'
import { useConnection } from '../../components/ConnectionProvider'
import { createPortal } from 'react-dom'
import WalletConnect from '../WalletConnect'

function useApiKey() {
  const [key, setKey] = React.useState<string | null>(() => {
    try {
      return window.localStorage.getItem('arb:apiKey')
    } catch {
      return null
    }
  })
  React.useEffect(() => {
    try {
      if (key) window.localStorage.setItem('arb:apiKey', key)
      else window.localStorage.removeItem('arb:apiKey')
    } catch {}
  }, [key])
  return { key, setKey }
}

export default function Topbar() {
  const { connected, connect, disconnect } = useConnection()
  const { key, setKey } = useApiKey()
  const [notifEnabled, setNotifEnabled] = React.useState<boolean>(false)
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch(`${API}/debug/alert_webhook`)
        if (!mounted) return
        if (res.ok) {
          const j = await res.json()
          setNotifEnabled(!!j.enabled)
        }
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

  // alert badge: poll recent logs and count feature_extractor alerts in last N minutes
  const [alertCount, setAlertCount] = React.useState<number>(0)
  const [recentAlerts, setRecentAlerts] = React.useState<any[]>([])
  const [showAlertsModal, setShowAlertsModal] = React.useState<boolean>(false)
  const [ackedTs, setAckedTs] = React.useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem('arb:ackedTs')
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  React.useEffect(() => {
    let mounted = true
    const fetchAlerts = async () => {
      try {
        const res = await fetch(`${API}/logs?limit=200`)
        if (!res.ok) return
        const j = await res.json()
        const logs = j.logs || []
        const now = Date.now()
        const cutoff = now - (5 * 60 * 1000) // 5 minutes
        let c = 0
        const recent: any[] = []
        for (const l of logs) {
            try {
            // parse timestamp if present; server ts values can vary (no Z, microseconds, or
            // include a timezone +00:00 followed by an extra Z). Try several sane fallbacks
            // and sanitize common broken variants like '+00:00Z'. We accept the parsed value
            // if it is within the recent cutoff window.
            if (l.ts) {
              const rawTs = String(l.ts)
              let t = Date.parse(rawTs)
              // try sanitizing patterns like '...+00:00Z' -> '...Z' and '...+00:00' -> '...Z'
              if (isNaN(t)) {
                try {
                  const s1 = rawTs.replace(/\+00:00Z$/,'Z')
                  t = Date.parse(s1)
                } catch {}
              }
              if (isNaN(t)) {
                try {
                  const s2 = rawTs.replace(/\+00:00$/,'Z')
                  t = Date.parse(s2)
                } catch {}
              }
              // last resort: append a Z
              if (isNaN(t)) {
                t = Date.parse(`${rawTs}Z`)
              } else {
                // if parsed value is older than cutoff try explicit Z variant and accept it
                const tz = Date.parse(`${rawTs}Z`)
                if (!isNaN(tz) && tz >= cutoff) {
                  t = tz
                }
              }
              if (isNaN(t) || t < cutoff) continue

              // 1) feature_extractor alerts (existing logic) and hotcoins alerts
              // Treat feature_extractor and hotcoins entries as alerts when they contain
              // an alerts array, include 'moved' text, have warning level, or are explicit
              // hotcoin_price_move entries. This is intentionally permissive so the bell
              // shows for hotcoin alerts coming from different sources.
              const src = (l.src || '').toString()
              if (src === 'feature_extractor' || src === 'feature-extractor' || src === 'hotcoins' || l.type === 'hotcoin_price_move') {
                const text = (typeof l.text === 'string' ? l.text.toLowerCase() : '')
                const hasAlerts = Array.isArray(l.alerts) && l.alerts.length > 0
                const isWarning = (l.level === 'warning' || l.level === 'warn')
                const textSignals = text.includes('alerts') || text.includes('moved') || text.includes('move')
                if (hasAlerts || isWarning || textSignals || l.type === 'hotcoin_price_move') {
                  c += 1
                  recent.push(l)
                  continue
                }
              }

              // (no temporary hotcoins matching)
            }
          } catch {}
        }
        if (mounted) {
          // exclude acked timestamps from count and recent list
          const filtered = recent.filter((a: any) => !(a.ts && ackedTs.includes(a.ts)))
          setAlertCount(filtered.length)
          setRecentAlerts(filtered.slice(0, 10))
        }
      } catch {}
    }
    fetchAlerts()
    const id = window.setInterval(fetchAlerts, 5000)
    return () => { mounted = false; clearInterval(id) }
  }, [ackedTs])

  // persist acked timestamps so acknowledgements survive reload
  React.useEffect(() => {
    try {
      window.localStorage.setItem('arb:ackedTs', JSON.stringify(ackedTs || []))
    } catch {}
  }, [ackedTs])

  // Portal mount point
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  const modalContent = showAlertsModal ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAlertsModal(false)} />
      <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 p-6 z-[10000] border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Recent Alerts</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                try {
                  const tsList = recentAlerts.map((a: any) => a.ts).filter(Boolean)
                  setAckedTs(prev => Array.from(new Set([...prev, ...tsList])))
                  setRecentAlerts([])
                } catch {}
              }} 
              className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-all"
            >
              Acknowledge all
            </button>
            <button 
              onClick={() => setShowAlertsModal(false)} 
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {recentAlerts.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            No recent alerts
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-auto pr-2">
            {recentAlerts.map((a, idx) => {
              // Parse alert data for better presentation
              const alertData = a.alerts?.[0] || {}
              const symbol = alertData.symbol || 'N/A'
              const market = alertData.market || ''
              const percent = alertData.percent ? `${alertData.percent.toFixed(2)}%` : 'N/A'
              const priceAgo = alertData.price_ago || a.price_ago
              const currentPrice = alertData.current_price || a.current_price
              
              return (
                <div key={idx} className="p-4 border border-slate-700 rounded-xl bg-slate-800/50 hover:bg-slate-800/70 transition-all">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-xs text-slate-500 font-mono">{
                          (() => {
                            try {
                              const raw = a.ts || ''
                              const d = new Date(raw)
                              if (!isNaN(d.getTime())) {
                                return d.toLocaleString()
                              }
                              const d2 = new Date(`${raw}Z`)
                              if (!isNaN(d2.getTime())) return d2.toLocaleString()
                              return raw
                            } catch {
                              return a.ts || ''
                            }
                          })()
                        }</div>
                      </div>
                      <div className="text-base font-semibold text-white mb-2">{a.text || 'Alert'}</div>
                      
                      {/* Alert Details Cards */}
                      {a.alerts && a.alerts.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <div className="bg-slate-900/70 rounded-lg p-3 border border-slate-700/50">
                            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Symbol</div>
                            <div className="text-lg font-bold text-cyan-400">{symbol}</div>
                            {market && <div className="text-xs text-slate-500 mt-0.5">{market}</div>}
                          </div>
                          <div className="bg-slate-900/70 rounded-lg p-3 border border-slate-700/50">
                            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Change</div>
                            <div className={`text-lg font-bold ${parseFloat(percent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {parseFloat(percent) >= 0 ? '+' : ''}{percent}
                            </div>
                          </div>
                          {(priceAgo || currentPrice) && (
                            <>
                              <div className="bg-slate-900/70 rounded-lg p-3 border border-slate-700/50">
                                <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Price 30min ago</div>
                                <div className="text-sm font-mono text-slate-300">{priceAgo ? Number(priceAgo).toFixed(6) : 'N/A'}</div>
                              </div>
                              <div className="bg-slate-900/70 rounded-lg p-3 border border-slate-700/50">
                                <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Current Price</div>
                                <div className="text-sm font-mono text-slate-300">{currentPrice ? Number(currentPrice).toFixed(6) : 'N/A'}</div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => {
                        try {
                          const t = a.ts
                          if (!t) return
                          setAckedTs(prev => Array.from(new Set([...prev, t])))
                          setRecentAlerts(prev => prev.filter(x => x.ts !== t))
                        } catch {}
                      }} 
                      className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-cyan-500/20 flex-shrink-0"
                    >
                      Ack
                    </button>
                  </div>
                  
                  {/* Collapsible Raw Data */}
                  {a.alerts && (
                    <details className="mt-3">
                      <summary className="text-xs text-slate-400 cursor-pointer hover:text-cyan-400 transition-colors select-none">
                        View raw data
                      </summary>
                      <pre className="text-xs mt-2 p-3 bg-slate-900/70 rounded-lg overflow-auto border border-slate-700/50 text-slate-300 max-h-48">
                        {JSON.stringify(a.alerts, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  ) : null

  return (
    <>
    <header className="flex items-center justify-between">
      <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent"></div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {/* Bell icon: shows capped notifications (1 or 2) when feature_extractor has recent alerts */}
          <button 
            title="Recent alerts" 
            onClick={() => setShowAlertsModal(true)} 
            className="relative inline-flex items-center justify-center p-2 rounded-lg hover:bg-slate-800/50 focus:outline-none transition-all duration-200 border border-transparent hover:border-cyan-500/30" 
            aria-label="Alerts"
          >
            {/* bell SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-slate-400 hover:text-cyan-400 transition-colors">
              <path d="M12 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 005 14h14a1 1 0 00.707-1.707L18 11.586V8a6 6 0 00-6-6z" />
              <path d="M9.293 18.293A1 1 0 0010 19h4a1 1 0 00.707-1.707A2.99 2.99 0 0112 16a2.99 2.99 0 01-2.707 2.293z" />
            </svg>
            {alertCount > 0 ? (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none text-white bg-gradient-to-r from-rose-500 to-pink-500 rounded-full shadow-lg shadow-rose-500/50 animate-pulse">
                {String(alertCount)}
              </span>
            ) : null}
          </button>
        </div>
      
        <WalletConnect />
      </div>
    </header>
    {mounted && modalContent && typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null}
    </>
  )
}
