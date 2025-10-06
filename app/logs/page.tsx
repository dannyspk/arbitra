'use client'

import React from 'react'

export default function Page() {
  const [logs, setLogs] = React.useState<any[]>([])
  const [limit, setLimit] = React.useState<number>(() => {
    try {
      const v = window.localStorage.getItem('logs:limit')
      return v ? parseInt(v, 10) || 20 : 20
    } catch {
      return 20
    }
  })
  const [polling, setPolling] = React.useState<boolean>(() => {
    try {
      const v = window.localStorage.getItem('logs:polling')
      return v ? v === 'true' : false
    } catch {
      return false
    }
  })
  const [testMsg, setTestMsg] = React.useState<string>('')
  const [testStatus, setTestStatus] = React.useState<string | null>(null)
  const [webhookUrl, setWebhookUrl] = React.useState<string>('')
  const [alertsEnabled, setAlertsEnabled] = React.useState<boolean>(false)
  const [saveStatus, setSaveStatus] = React.useState<string | null>(null)

  const API = 'http://127.0.0.1:8000'

  const fetchLogs = React.useCallback(async () => {
    try {
      const res = await fetch(`${API}/logs?limit=${limit}`)
      if (!res.ok) {
        setTestStatus(`Fetch logs failed: ${res.status} ${res.statusText}`)
        return
      }
      const j = await res.json()
      setLogs(j.logs || [])
      setTestStatus(null)
    } catch (e: any) {
      setTestStatus('Error fetching logs: ' + (e?.message || String(e)))
    }
  }, [limit])

  const fetchWebhookState = React.useCallback(async () => {
    try {
      const res = await fetch(`${API}/debug/alert_webhook`)
      if (!res.ok) return
      const j = await res.json()
      setWebhookUrl(j.webhook || '')
      setAlertsEnabled(!!j.enabled)
    } catch (e) {
      // ignore
    }
  }, [])

  React.useEffect(() => {
    let mounted = true
    fetchLogs()
    fetchWebhookState()
    const id = setInterval(() => {
      if (polling && mounted) fetchLogs()
    }, 2000)
    return () => { mounted = false; clearInterval(id) }
  }, [fetchLogs, polling])

  // persist limit and polling choices so defaults survive a reload
  React.useEffect(() => {
    try {
      window.localStorage.setItem('logs:limit', String(limit))
    } catch {}
  }, [limit])

  React.useEffect(() => {
    try {
      window.localStorage.setItem('logs:polling', polling ? 'true' : 'false')
    } catch {}
  }, [polling])

  const formatTs = React.useCallback((raw: any) => {
    if (!raw) return ''
    try {
      let s = String(raw)
      // common broken form like 2025-10-03T00:52:12.731+00:00Z -> drop the duplicate Z
      s = s.replace(/\+00:00Z$/i, 'Z').replace(/\+00:00$/i, 'Z')
      // if it looks like an ISO without a timezone, assume Z
      if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
        s = s + 'Z'
      }
      const d = new Date(s)
      if (!isNaN(d.getTime())) return d.toLocaleString()
      return raw
    } catch (e) {
      return String(raw)
    }
  }, [])

  // delivery history removed: webhook delivery attempts are not persisted

  async function sendTest() {
    setTestStatus(null)
    try {
      const payload = { level: 'info', text: testMsg || 'test log', src: 'web-ui' }
      const res = await fetch(`${API}/logs`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) })
      if (!res.ok) {
        setTestStatus('Send failed: ' + res.status + ' ' + res.statusText)
        return
      }
      setTestMsg('')
      setTestStatus('Sent')
      await fetchLogs()
    } catch (e: any) {
      setTestStatus('Network error: ' + (e?.message || String(e)))
    }
  }

  async function saveWebhook(enableAfterSave = true) {
    try {
      setSaveStatus('saving')
      const body: any = {}
      body.url = webhookUrl || null
      if (enableAfterSave) body.enable = true
  const res = await fetch(`${API}/debug/alert_webhook`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) })
      if (!res.ok) {
        setSaveStatus('error')
        return
      }
      const j = await res.json()
      setWebhookUrl(j.webhook || '')
      setAlertsEnabled(!!j.enabled)
      setSaveStatus('ok')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (e) {
      setSaveStatus('error')
    }
  }

  async function toggleAlerts(enable: boolean) {
    try {
      const body = { enable }
      const res = await fetch(`${API}/debug/alert_webhook`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) })
      if (!res.ok) return
      const j = await res.json()
      setAlertsEnabled(!!j.enabled)
    } catch {}
  }

  async function testWebhook() {
    try {
      // send a test log which will be forwarded by the notifier
      const payload = { level: 'info', src: 'logs-ui', text: 'webhook test from UI' }
      await fetch(`${API}/logs`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) })
    } catch {}
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
            Logs & Alerts
          </h1>
          <p className="text-sm md:text-base text-slate-400">System logs and webhook alert configuration</p>
        </header>

        <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm md:text-base text-slate-300">
            <input 
              type="checkbox" 
              checked={polling} 
              onChange={(e) => setPolling(e.target.checked)}
              className="rounded bg-slate-800 border-slate-600 text-cyan-500 focus:ring-cyan-500/50"
            />
            <span>Auto-refresh</span>
          </label>
          <label className="flex items-center gap-2 text-sm md:text-base text-slate-300">
            <span>Limit</span>
            <input 
              type="number" 
              className="w-20 px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50" 
              value={limit} 
              onChange={(e) => setLimit(parseInt(e.target.value || '200'))} 
            />
          </label>
          <button 
            className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-lg font-semibold shadow-lg shadow-cyan-500/20 transition-all w-full sm:w-auto" 
            onClick={fetchLogs}
          >
            Refresh
          </button>
        </div>

        <div className="mb-4 md:mb-6 flex flex-col sm:flex-row gap-2">
          <input 
            value={testMsg} 
            onChange={(e) => setTestMsg(e.target.value)} 
            placeholder="Test log message" 
            className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 text-sm md:text-base" 
          />
          <button 
            onClick={sendTest} 
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-lg font-semibold shadow-lg shadow-emerald-500/20 transition-all w-full sm:w-auto"
          >
            Send Test Log
          </button>
        </div>

        <div className="mb-4 md:mb-6 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-3 md:p-4 border border-slate-700/50">
          <div className="flex flex-col gap-3 mb-3">
            <label className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm md:text-base text-slate-300">
              <span className="sm:w-24 font-medium">Webhook</span>
              <input 
                className="flex-1 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 text-sm md:text-base" 
                value={webhookUrl} 
                onChange={(e) => setWebhookUrl(e.target.value)} 
                placeholder="https://example.com/hook" 
              />
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <button 
                className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-lg font-semibold shadow-lg shadow-cyan-500/20 transition-all" 
                onClick={() => saveWebhook(true)}
              >
                Save & Enable
              </button>
              <button 
                className="flex-1 sm:flex-none px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all" 
                onClick={() => saveWebhook(false)}
              >
                Save
              </button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="flex items-center gap-2 text-sm md:text-base text-slate-300">
              <input 
                type="checkbox" 
                checked={alertsEnabled} 
                onChange={(e) => toggleAlerts(e.target.checked)}
                className="rounded bg-slate-800 border-slate-600 text-cyan-500 focus:ring-cyan-500/50"
              />
              <span>Alerts enabled</span>
            </label>
            <button 
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-lg font-semibold shadow-lg shadow-emerald-500/20 transition-all w-full sm:w-auto" 
              onClick={testWebhook}
            >
              Send Test Webhook
            </button>
            {saveStatus === 'saving' ? <span className="text-xs text-slate-400 animate-pulse">Saving...</span> : null}
            {saveStatus === 'ok' ? <span className="text-xs text-emerald-400 font-semibold">✓ Saved</span> : null}
            {saveStatus === 'error' ? <span className="text-xs text-red-400 font-semibold">✗ Error</span> : null}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg shadow-lg border border-slate-700/50 p-3 md:p-4 max-h-[60vh] overflow-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-sm md:text-base text-slate-500">No logs available</div>
          ) : (
            <table className="w-full text-xs md:text-sm">
              <thead className="sticky top-0 bg-slate-800/90 backdrop-blur-sm">
                <tr className="border-b border-slate-700/50">
                  <th className="px-2 md:px-3 py-2 md:py-3 text-left text-slate-400 font-semibold uppercase tracking-wider">Timestamp</th>
                  <th className="px-2 md:px-3 py-2 md:py-3 text-left text-slate-400 font-semibold uppercase tracking-wider">Level</th>
                  <th className="px-2 md:px-3 py-2 md:py-3 text-left text-slate-400 font-semibold uppercase tracking-wider hidden sm:table-cell">Source</th>
                  <th className="px-2 md:px-3 py-2 md:py-3 text-left text-slate-400 font-semibold uppercase tracking-wider">Message</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice().reverse().map((l, idx) => (
                  <tr key={idx} className="border-t border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                    <td className="px-2 md:px-3 py-2 align-top font-mono text-xs text-slate-400">{formatTs(l.ts || l.time || '')}</td>
                    <td className="px-2 md:px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        l.level === 'error' || l.lvl === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                        l.level === 'warn' || l.lvl === 'warn' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                        'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      }`}>
                        {l.level || l.lvl || 'info'}
                      </span>
                    </td>
                    <td className="px-2 md:px-3 py-2 text-slate-300 hidden sm:table-cell">{l.src || l.name || ''}</td>
                    <td className="px-2 md:px-3 py-2 break-words text-slate-300">{String(l.text || l.msg || JSON.stringify(l))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {testStatus && (
          <div className="mt-4 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs md:text-sm text-slate-300">
            {testStatus}
          </div>
        )}
      </div>
    </div>
  )
}
