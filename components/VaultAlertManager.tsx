'use client'

import React, { useState, useEffect } from 'react'

interface Alert {
  alert_id: string
  pool_id: string
  alert_type: 'apy_drop' | 'apy_spike' | 'apy_below' | 'apy_above'
  threshold: number
  notification_method: string
  webhook_url?: string
  created_at: number
  last_triggered: number | null
  trigger_count: number
  active: boolean
}

interface VaultAlertManagerProps {
  vaultId: string
  vaultName: string
  currentApy: number
  onClose: () => void
}

export default function VaultAlertManager({ vaultId, vaultName, currentApy, onClose }: VaultAlertManagerProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  
  // Form state
  const [alertType, setAlertType] = useState<'apy_drop' | 'apy_spike' | 'apy_below' | 'apy_above'>('apy_drop')
  const [threshold, setThreshold] = useState(20)
  const [webhookUrl, setWebhookUrl] = useState('https://discord.com/api/webhooks/')

  const getBackendUrl = () => {
    try {
      const hn = location.hostname
      const p = location.port
      if ((hn === 'localhost' || hn === '127.0.0.1') && p === '3000') {
        return 'http://127.0.0.1:8000'
      }
    } catch (e) {}
    return ''
  }

  useEffect(() => {
    fetchAlerts()
  }, [])

  async function fetchAlerts() {
    try {
      setLoading(true)
      const backend = getBackendUrl()
      const res = await fetch(`${backend}/api/defi-vaults/alerts`)
      if (!res.ok) throw new Error('Failed to fetch alerts')
      
      const data = await res.json()
      // Filter alerts for this vault
      const vaultAlerts = data.alerts.filter((a: Alert) => a.pool_id === vaultId)
      setAlerts(vaultAlerts)
    } catch (e) {
      console.error('Failed to fetch alerts:', e)
    } finally {
      setLoading(false)
    }
  }

  async function createAlert() {
    try {
      setCreating(true)
      const backend = getBackendUrl()
      
      const body = {
        pool_id: vaultId,
        alert_type: alertType,
        threshold: threshold,
        notification_method: 'webhook',
        webhook_url: webhookUrl
      }
      
      const res = await fetch(`${backend}/api/defi-vaults/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      if (!res.ok) throw new Error('Failed to create alert')
      
      await fetchAlerts()
      // Reset form
      setThreshold(20)
    } catch (e) {
      console.error('Failed to create alert:', e)
      alert('Failed to create alert')
    } finally {
      setCreating(false)
    }
  }

  async function deleteAlert(alertId: string) {
    try {
      const backend = getBackendUrl()
      const res = await fetch(`${backend}/api/defi-vaults/alerts/${alertId}`, {
        method: 'DELETE'
      })
      
      if (!res.ok) throw new Error('Failed to delete alert')
      
      await fetchAlerts()
    } catch (e) {
      console.error('Failed to delete alert:', e)
    }
  }

  const getAlertTypeLabel = (type: string) => {
    const labels = {
      'apy_drop': '📉 APY Drop',
      'apy_spike': '📈 APY Spike',
      'apy_below': '⬇️ Below Threshold',
      'apy_above': '⬆️ Above Threshold'
    }
    return labels[type as keyof typeof labels] || type
  }

  const getAlertDescription = (type: string, threshold: number) => {
    const descriptions = {
      'apy_drop': `Alert when APY drops by ${threshold}% or more`,
      'apy_spike': `Alert when APY increases by ${threshold}% or more`,
      'apy_below': `Alert when APY falls below ${threshold}%`,
      'apy_above': `Alert when APY rises above ${threshold}%`
    }
    return descriptions[type as keyof typeof descriptions] || ''
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Alert Manager</h2>
              <p className="text-slate-400">{vaultName}</p>
              <p className="text-sm text-slate-500 mt-1">Current APY: <span className="text-emerald-400 font-semibold">{currentApy.toFixed(2)}%</span></p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Create Alert Form */}
          <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Create New Alert</h3>
            
            <div className="space-y-4">
              {/* Alert Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Alert Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['apy_drop', 'apy_spike', 'apy_below', 'apy_above'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setAlertType(type)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        alertType === type
                          ? 'border-emerald-500 bg-emerald-500/10 text-white'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-semibold text-sm">{getAlertTypeLabel(type)}</div>
                      <div className="text-xs mt-1 opacity-80">{getAlertDescription(type, threshold)}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Threshold */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Threshold {alertType.includes('drop') || alertType.includes('spike') ? '(% Change)' : '(Absolute APY)'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value))}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    min="0"
                    step="0.1"
                  />
                  <span className="text-slate-400">%</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{getAlertDescription(alertType, threshold)}</p>
              </div>

              {/* Webhook URL */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Webhook URL</label>
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Setup at: <a href="https://webhook.site" target="_blank" className="text-emerald-400 hover:underline">webhook.site</a> or Discord server settings
                </p>
              </div>

              {/* Create Button */}
              <button
                onClick={createAlert}
                disabled={creating}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                {creating ? 'Creating...' : '🔔 Create Alert'}
              </button>
            </div>
          </div>

          {/* Active Alerts */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Active Alerts ({alerts.length})</h3>
            
            {loading ? (
              <div className="text-center py-8 text-slate-400">Loading alerts...</div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No alerts configured for this vault yet
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.alert_id}
                    className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 flex items-start justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold">{getAlertTypeLabel(alert.alert_type)}</span>
                        <span className="text-sm text-slate-400">@ {alert.threshold}%</span>
                      </div>
                      <p className="text-sm text-slate-400 mb-2">
                        {getAlertDescription(alert.alert_type, alert.threshold)}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Triggered: {alert.trigger_count}x</span>
                        {alert.last_triggered && (
                          <span>Last: {new Date(alert.last_triggered * 1000).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteAlert(alert.alert_id)}
                      className="text-red-400 hover:text-red-300 transition-colors p-2"
                      title="Delete alert"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
