'use client'

import React from 'react'
import VaultAlertManager from '../../components/VaultAlertManager'
import VaultHistoryChart from '../../components/VaultHistoryChart'
import PositionTracker from '../../components/PositionTracker'

interface DefiVault {
  id: string
  name: string
  protocol: string
  chain: string
  asset: string
  strategy: string
  apy: number
  target_apy: number
  tvl_usd: number
  risk_level: string
  withdrawal_period_days: number | null  // Not available from DeFiLlama API
  platform_fee: number | null  // Not available from DeFiLlama API
  performance_fee: number | null  // Not available from DeFiLlama API
  description: string
  vault_address: string
  strategist?: string
  active: boolean
  apy_base?: number
  apy_reward?: number
  apy_mean_30d?: number | null
  apy_base_7d?: number | null
  apy_base_inception?: number | null
  apy_pct_1d?: number | null
  apy_pct_7d?: number | null
  apy_pct_30d?: number | null
  apy_prediction?: string | null
  apy_prediction_confidence?: number | null
  pool_meta?: string
  is_leveraged?: boolean
  leverage_ratio?: number
  max_ltv?: number
  liquidation_ltv?: number
  volume_usd_1d?: number | null
  volume_usd_7d?: number | null
  outlier?: boolean
  exposure?: string
  underlying_tokens?: string[]
  vault_url?: string
  protocol_url?: string
  defillama_url?: string
}

export default function DefiPage() {
  const [vaults, setVaults] = React.useState<DefiVault[]>([])
  const [loading, setLoading] = React.useState(true)
  const [totalTvl, setTotalTvl] = React.useState(0)
  const [avgApy, setAvgApy] = React.useState(0)
  
  // Monitoring state
  const [showAlertManager, setShowAlertManager] = React.useState(false)
  const [showHistoryChart, setShowHistoryChart] = React.useState(false)
  const [showPositionTracker, setShowPositionTracker] = React.useState(false)
  const [selectedVault, setSelectedVault] = React.useState<DefiVault | null>(null)
  const [activeTab, setActiveTab] = React.useState<'vaults' | 'positions'>('vaults')

  React.useEffect(() => {
    fetchVaults()
    const interval = setInterval(fetchVaults, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  async function fetchVaults() {
    try {
      setLoading(true)
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      
      const res = await fetch(`${backend}/api/defi-vaults`)
      if (!res.ok) throw new Error('Failed to fetch')
      
      const data = await res.json()
      setVaults(data.vaults || [])
      setTotalTvl(data.total_tvl_usd || 0)
      setAvgApy(data.avg_apy || 0)
    } catch (e) {
      console.error('Failed to fetch DeFi vaults:', e)
    } finally {
      setLoading(false)
    }
  }

  const formatMoney = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value.toFixed(0)}`
  }

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'low': return 'text-green-400 bg-green-500/10 border-green-500/30'
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
      case 'high': return 'text-red-400 bg-red-500/10 border-red-500/30'
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30'
    }
  }

  const getChainColor = (chain: string) => {
    switch (chain.toLowerCase()) {
      case 'ethereum': return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
      case 'bsc': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
      case 'avalanche': return 'text-red-400 bg-red-500/10 border-red-500/30'
      case 'polygon': return 'text-purple-400 bg-purple-500/10 border-purple-500/30'
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="p-6">
        <header className="mb-6">
          <div className="mb-4">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-2">
              DeFi Savings Vaults
            </h1>
            <p className="text-slate-400">Earn passive yield on your stablecoins with automated looping strategies</p>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-slate-700">
            <button
              onClick={() => setActiveTab('vaults')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'vaults'
                  ? 'text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              🏦 Available Vaults
            </button>
            <button
              onClick={() => setActiveTab('positions')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'positions'
                  ? 'text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              📊 My Positions
            </button>
          </div>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-xs text-slate-500">Total TVL</div>
                <div className="text-2xl font-bold text-white">{formatMoney(totalTvl)}</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <div className="text-xs text-slate-500">Average APY</div>
                <div className="text-2xl font-bold text-emerald-400">{avgApy.toFixed(2)}%</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <div className="text-xs text-slate-500">Active Vaults</div>
                <div className="text-2xl font-bold text-white">{vaults.filter(v => v.active).length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 rounded-xl p-4 border border-green-500/30 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-slate-300">
              <strong className="text-green-400">What is Looping Strategy?</strong>
              <p className="mt-1 text-slate-400">
                Looping strategies deposit stablecoins into lending protocols, borrow against them, and re-deposit to amplify yields.
                These vaults automatically compound returns and optimize positions for maximum APY while maintaining low risk with stablecoins.
                <strong className="text-white"> 💰 Earn while you sleep</strong> - No active trading required, just passive income from lending markets.
              </p>
            </div>
          </div>
        </div>

        {/* Vaults Grid */}
        {activeTab === 'vaults' && (
          <>
            {loading && vaults.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
              <div className="text-slate-400">Loading vaults...</div>
            </div>
          </div>
        ) : vaults.length === 0 ? (
          <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 p-12 text-center">
            <div className="text-slate-500 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              No vaults available at the moment
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {vaults.map((vault) => (
              <div key={vault.id} className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden hover:border-green-500/50 transition-all">
                {/* Header */}
                <div className="p-6 border-b border-slate-700/50 bg-gradient-to-r from-green-500/5 to-emerald-500/5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">{vault.name}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${getChainColor(vault.chain)}`}>
                          {vault.chain}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${getRiskColor(vault.risk_level)}`}>
                          {vault.risk_level} Risk
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded-full border text-purple-400 bg-purple-500/10 border-purple-500/30">
                          {vault.protocol}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-green-400">{vault.apy.toFixed(2)}%</div>
                      <div className="text-xs text-slate-500">Current APY</div>
                      {vault.apy_base !== undefined && vault.apy_base > 0 && (
                        <div className="text-[10px] text-slate-600 mt-1">
                          {vault.apy_base > 0 && <span>Base: {vault.apy_base.toFixed(1)}%</span>}
                          {vault.apy_reward !== undefined && vault.apy_reward > 0 && (
                            <span> + Rewards: {vault.apy_reward.toFixed(1)}%</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {vault.description}
                  </p>
                  
                  {vault.pool_meta && (
                    <div className="text-xs text-slate-500 bg-slate-800/50 rounded px-2 py-1 inline-block">
                      📊 {vault.pool_meta}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="p-6 space-y-4">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Asset</div>
                      <div className="text-sm font-semibold text-white flex items-center gap-1">
                        <span className="text-lg">💵</span> {vault.asset}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Strategy</div>
                      <div className="text-sm font-semibold text-cyan-400">{vault.strategy}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">TVL</div>
                      <div className="text-sm font-semibold text-white">{formatMoney(vault.tvl_usd)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Target APY</div>
                      <div className="text-sm font-semibold text-emerald-400">{vault.target_apy.toFixed(1)}%</div>
                    </div>
                  </div>

                  {/* Fees - Only show if data is available */}
                  {(vault.platform_fee !== null || vault.performance_fee !== null || vault.withdrawal_period_days !== null) && (
                    <div className="pt-4 border-t border-slate-700/50">
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <div className="text-slate-500 mb-1">Platform Fee</div>
                          <div className="font-semibold text-white">
                            {vault.platform_fee !== null ? `${vault.platform_fee.toFixed(2)}%` : <span className="text-slate-600">N/A</span>}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 mb-1">Performance</div>
                          <div className="font-semibold text-white">
                            {vault.performance_fee !== null ? `${vault.performance_fee.toFixed(0)}%` : <span className="text-slate-600">N/A</span>}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 mb-1">Withdrawal</div>
                          <div className="font-semibold text-white">
                            {vault.withdrawal_period_days !== null ? `${vault.withdrawal_period_days}d` : <span className="text-slate-600">N/A</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Leverage Risk Warning */}
                  {vault.is_leveraged && (
                    <div className="pt-4 border-t border-slate-700/50">
                      <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-orange-400 text-lg">⚠️</span>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-orange-400 mb-1">Leveraged Position</div>
                            <div className="text-xs text-slate-300 leading-relaxed">
                              This vault uses leverage to amplify returns. Monitor your position to avoid liquidation.
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                          <div>
                            <div className="text-slate-500 mb-1">Leverage</div>
                            <div className="font-bold text-orange-400">{vault.leverage_ratio?.toFixed(1)}x</div>
                          </div>
                          {vault.max_ltv && (
                            <div>
                              <div className="text-slate-500 mb-1">Max LTV</div>
                              <div className="font-bold text-white">{(vault.max_ltv * 100).toFixed(0)}%</div>
                            </div>
                          )}
                          {vault.liquidation_ltv && (
                            <div>
                              <div className="text-slate-500 mb-1">Liquidation</div>
                              <div className="font-bold text-red-400">{(vault.liquidation_ltv * 100).toFixed(0)}%</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Strategist (if available) */}
                  {vault.strategist && (
                    <div className="pt-4 border-t border-slate-700/50">
                      <div className="text-xs text-slate-500 mb-1">Managed By</div>
                      <div className="text-sm font-semibold text-slate-300">{vault.strategist}</div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    {/* Monitoring Actions */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button
                        onClick={() => {
                          setSelectedVault(vault)
                          setShowHistoryChart(true)
                        }}
                        className="py-2 bg-slate-700/50 text-slate-300 rounded-lg font-medium border border-slate-600/50 hover:bg-slate-700 hover:border-emerald-500/50 transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        APY History
                      </button>
                      <button
                        onClick={() => {
                          setSelectedVault(vault)
                          setShowAlertManager(true)
                        }}
                        className="py-2 bg-slate-700/50 text-slate-300 rounded-lg font-medium border border-slate-600/50 hover:bg-slate-700 hover:border-amber-500/50 transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        Set Alert
                      </button>
                    </div>
                    
                    {/* View Vault Button */}
                    {vault.vault_url && (
                      <a
                        href={vault.vault_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold border border-blue-500/30 hover:from-blue-500 hover:to-cyan-500 transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View Vault on {vault.protocol}
                      </a>
                    )}
                    
                    {/* DeFiLlama Analytics */}
                    {vault.defillama_url && (
                      <a
                        href={vault.defillama_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 bg-slate-700/50 text-slate-300 rounded-lg font-medium border border-slate-600/50 hover:bg-slate-700 hover:border-slate-500 transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Analytics on DeFiLlama
                      </a>
                    )}
                    
                    {/* Deposit Button (Coming Soon) */}
                    <button 
                      disabled
                      className="w-full py-3 bg-gradient-to-r from-green-600/50 to-emerald-600/50 text-white rounded-lg font-semibold border border-green-500/30 cursor-not-allowed opacity-50 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Deposit Coming Soon
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </>
        )}

        {/* Position Tracker Tab */}
        {activeTab === 'positions' && (
          <PositionTracker />
        )}

        {/* Modals */}
        {showAlertManager && selectedVault && (
          <VaultAlertManager
            vaultId={selectedVault.id}
            vaultName={selectedVault.name}
            currentApy={selectedVault.apy}
            onClose={() => {
              setShowAlertManager(false)
              setSelectedVault(null)
            }}
          />
        )}

        {showHistoryChart && selectedVault && (
          <VaultHistoryChart
            vaultId={selectedVault.id}
            vaultName={selectedVault.name}
            onClose={() => {
              setShowHistoryChart(false)
              setSelectedVault(null)
            }}
          />
        )}
      </div>
    </div>
  )
}
