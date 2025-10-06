'use client'

import React, { useState, useEffect } from 'react'
import WalletConnect from './WalletConnect'

interface Position {
  pool_id: string
  amount: number
  entry_apy: number
  entry_timestamp: number
  tx_hash?: string
  active: boolean
  current_apy?: number
  apy_delta?: number
  apy_delta_pct?: number
}

interface VaultInfo {
  id: string
  name: string
  protocol: string
  chain: string
}

export default function PositionTracker() {
  const [walletAddress, setWalletAddress] = useState('')
  const [positions, setPositions] = useState<Position[]>([])
  const [vaultInfo, setVaultInfo] = useState<Record<string, VaultInfo>>({})
  const [loading, setLoading] = useState(false)
  const [tracking, setTracking] = useState(false)
  
  // Track new position form
  const [showTrackForm, setShowTrackForm] = useState(false)
  const [selectedVault, setSelectedVault] = useState('')
  const [amount, setAmount] = useState('')
  const [entryApy, setEntryApy] = useState('')
  const [availableVaults, setAvailableVaults] = useState<VaultInfo[]>([])

  const getBackendUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
  }

  useEffect(() => {
    fetchVaults()
    
    // Check if wallet was previously connected
    const saved = localStorage.getItem('wallet_address')
    if (saved) {
      setWalletAddress(saved)
      fetchPositions(saved)
    }
  }, [])

  function handleWalletConnect(address: string | null) {
    if (address) {
      setWalletAddress(address)
      fetchPositions(address)
    } else {
      setWalletAddress('')
      setPositions([])
    }
  }

  async function fetchVaults() {
    try {
      const backend = getBackendUrl()
      const res = await fetch(`${backend}/api/defi-vaults`)
      if (!res.ok) throw new Error('Failed to fetch vaults')
      
      const data = await res.json()
      const vaults = data.vaults || []
      setAvailableVaults(vaults.map((v: any) => ({
        id: v.id,
        name: v.name,
        protocol: v.protocol,
        chain: v.chain
      })))
      
      // Create vault info lookup
      const info: Record<string, VaultInfo> = {}
      vaults.forEach((v: any) => {
        info[v.id] = {
          id: v.id,
          name: v.name,
          protocol: v.protocol,
          chain: v.chain
        }
      })
      setVaultInfo(info)
    } catch (e) {
      console.error('Failed to fetch vaults:', e)
    }
  }

  async function fetchPositions(wallet: string) {
    try {
      setLoading(true)
      const backend = getBackendUrl()
      const res = await fetch(`${backend}/api/defi-vaults/positions/${wallet}`)
      if (!res.ok) throw new Error('Failed to fetch positions')
      
      const data = await res.json()
      setPositions(data.positions || [])
    } catch (e) {
      console.error('Failed to fetch positions:', e)
    } finally {
      setLoading(false)
    }
  }

  async function trackPosition() {
    if (!selectedVault || !amount || !entryApy || !walletAddress) {
      alert('Please fill in all fields')
      return
    }

    try {
      setTracking(true)
      const backend = getBackendUrl()
      
      const body = {
        user_id: walletAddress,
        pool_id: selectedVault,
        amount: parseFloat(amount),
        entry_apy: parseFloat(entryApy)
      }
      
      const res = await fetch(`${backend}/api/defi-vaults/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      if (!res.ok) throw new Error('Failed to track position')
      
      await fetchPositions(walletAddress)
      setShowTrackForm(false)
      setSelectedVault('')
      setAmount('')
      setEntryApy('')
    } catch (e) {
      console.error('Failed to track position:', e)
      alert('Failed to track position')
    } finally {
      setTracking(false)
    }
  }

  const formatMoney = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`
    return `$${value.toFixed(0)}`
  }

  const calculateYieldDiff = (pos: Position) => {
    if (!pos.current_apy || !pos.entry_apy) return null
    
    const entryYield = pos.amount * (pos.entry_apy / 100)
    const currentYield = pos.amount * (pos.current_apy / 100)
    return currentYield - entryYield
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Position Tracker</h2>
          <p className="text-slate-400">Monitor your DeFi vault positions</p>
        </div>
        <div className="flex items-center gap-3">
          {walletAddress && positions.length > 0 && (
            <button
              onClick={() => setShowTrackForm(!showTrackForm)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              + Track Position
            </button>
          )}
          <WalletConnect onConnect={handleWalletConnect} />
        </div>
      </div>

      {/* Wallet Not Connected State */}
      {!walletAddress && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
          <div className="text-6xl mb-4">👛</div>
          <h3 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Connect your Web3 wallet to track your DeFi positions and monitor yield performance across protocols
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Safe & Secure</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Non-Custodial</span>
            </div>
          </div>
        </div>
      )}

      {/* Track New Position Form */}
      {walletAddress && showTrackForm && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Track New Position</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Vault</label>
              <select
                value={selectedVault}
                onChange={(e) => setSelectedVault(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Select vault...</option>
                {availableVaults.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">Amount (USD)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">Entry APY (%)</label>
              <input
                type="number"
                value={entryApy}
                onChange={(e) => setEntryApy(e.target.value)}
                placeholder="15.2"
                step="0.1"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={trackPosition}
              disabled={tracking}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white py-2 rounded-lg font-medium transition-colors"
            >
              {tracking ? 'Tracking...' : 'Track Position'}
            </button>
            <button
              onClick={() => setShowTrackForm(false)}
              className="px-6 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Positions List */}
      {walletAddress && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-slate-400">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
              <p>Loading positions...</p>
            </div>
          ) : positions.length === 0 ? (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-white mb-2">No Positions Tracked</h3>
              <p className="text-slate-400 mb-6">Start tracking your DeFi vault positions</p>
              <button
                onClick={() => setShowTrackForm(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                + Track First Position
              </button>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                  <div className="text-slate-400 text-sm mb-1">Total Value</div>
                  <div className="text-2xl font-bold text-white">
                    {formatMoney(positions.reduce((sum, p) => sum + p.amount, 0))}
                  </div>
                </div>
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                  <div className="text-slate-400 text-sm mb-1">Active Positions</div>
                  <div className="text-2xl font-bold text-white">
                    {positions.filter(p => p.active).length}
                  </div>
                </div>
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                  <div className="text-slate-400 text-sm mb-1">Avg APY Change</div>
                  <div className={`text-2xl font-bold ${
                    positions.some(p => p.apy_delta_pct && p.apy_delta_pct < 0) ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {positions.length > 0
                      ? `${(positions.reduce((sum, p) => sum + (p.apy_delta_pct || 0), 0) / positions.length).toFixed(1)}%`
                      : '0%'}
                  </div>
                </div>
              </div>

              {/* Position Cards */}
              {positions.map((pos, i) => {
                const vault = vaultInfo[pos.pool_id]
                const yieldDiff = calculateYieldDiff(pos)
                
                return (
                  <div key={i} className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">
                          {vault?.name || 'Unknown Vault'}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                          <span>{vault?.protocol}</span>
                          <span>•</span>
                          <span>{vault?.chain}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white mb-1">
                          {formatMoney(pos.amount)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(pos.entry_timestamp * 1000).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Entry APY</div>
                        <div className="text-lg font-semibold text-slate-300">
                          {pos.entry_apy.toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Current APY</div>
                        <div className="text-lg font-semibold text-white">
                          {pos.current_apy ? `${pos.current_apy.toFixed(2)}%` : 'Loading...'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">APY Change</div>
                        <div className={`text-lg font-semibold ${
                          pos.apy_delta_pct && pos.apy_delta_pct >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {pos.apy_delta_pct !== undefined && pos.apy_delta_pct !== null
                            ? `${pos.apy_delta_pct >= 0 ? '+' : ''}${pos.apy_delta_pct.toFixed(1)}%`
                            : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Yield Impact</div>
                        <div className={`text-lg font-semibold ${
                          yieldDiff && yieldDiff >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {yieldDiff !== null ? `${yieldDiff >= 0 ? '+' : ''}$${Math.abs(yieldDiff).toFixed(0)}/y` : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
