'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useWallet } from './WalletProvider'

interface WalletContextType {
  address: string | null
  isConnected: boolean
  connect: () => Promise<void>
  disconnect: () => void
  chainId: number | null
}

declare global {
  interface Window {
    ethereum?: any
    coinbaseWalletExtension?: any
  }
}

export default function WalletConnect({ 
  onConnect,
  onDisconnect 
}: { 
  onConnect?: (address: string) => void
  onDisconnect?: () => void
}) {
  const { address, setAddress: setGlobalAddress } = useWallet()
  const [isConnecting, setIsConnecting] = useState(false)
  const [chainId, setChainId] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [walletType, setWalletType] = useState<'metamask' | 'coinbase' | 'unknown'>('unknown')
  const [mounted, setMounted] = useState(false)

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Update local address from global context
  const setAddress = (addr: string | null) => {
    setGlobalAddress(addr)
  }

  useEffect(() => {
    // Check if already connected on mount
    // Add a small delay to ensure providers are loaded
    const timer = setTimeout(() => {
      checkConnection()
    }, 100)
    
    // Listen for account changes
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('chainChanged', handleChainChanged)
    }

    return () => {
      clearTimeout(timer)
      if (typeof window !== 'undefined' && window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [])

  async function checkConnection() {
    if (typeof window === 'undefined') return

    try {
      // Check which wallet type was previously connected
      const savedWalletType = localStorage.getItem('wallet_type') as 'metamask' | 'coinbase' | null
      const savedAddress = localStorage.getItem('wallet_address')
      const savedChainId = localStorage.getItem('wallet_chain_id')
      
      if (!savedWalletType || !savedAddress) return

      let provider = null

      // Find the correct provider based on saved wallet type
      if (savedWalletType === 'coinbase') {
        // Use the same multi-provider detection as connectCoinbase()
        if (window.ethereum?.isCoinbaseWallet) {
          provider = window.ethereum
        } else if (window.ethereum?.providers) {
          provider = window.ethereum.providers.find((p: any) => p.isCoinbaseWallet)
        } else if (window.ethereum?.providerMap?.get) {
          provider = window.ethereum.providerMap.get('CoinbaseWallet')
        } else if (window.coinbaseWalletExtension) {
          provider = window.coinbaseWalletExtension
        }
      } else if (savedWalletType === 'metamask') {
        // Find MetaMask provider - try multiple detection methods
        // First check if window.ethereum is MetaMask directly
        if (window.ethereum?.isMetaMask && !window.ethereum?.isCoinbaseWallet) {
          provider = window.ethereum
        } 
        // Check providers array
        else if (window.ethereum?.providers) {
          provider = window.ethereum.providers.find((p: any) => p.isMetaMask && !p.isCoinbaseWallet)
        } 
        // Check providerMap
        else if (window.ethereum?.providerMap?.get) {
          provider = window.ethereum.providerMap.get('MetaMask')
        }
        // Fallback: if no specific MetaMask found but window.ethereum exists, use it
        // This handles cases where MetaMask is the only wallet or takes priority
        else if (window.ethereum) {
          console.log('Using window.ethereum as fallback for MetaMask')
          provider = window.ethereum
        }
      }

      if (!provider) {
        console.warn('Provider not found for wallet type:', savedWalletType, 'Available providers:', {
          ethereum: !!window.ethereum,
          isMetaMask: window.ethereum?.isMetaMask,
          isCoinbaseWallet: window.ethereum?.isCoinbaseWallet,
          providers: window.ethereum?.providers?.length,
          coinbaseExtension: !!window.coinbaseWalletExtension
        })
        
        // Even if provider is not found, restore chainId from localStorage if available
        if (savedChainId) {
          const parsedChainId = parseInt(savedChainId)
          console.log('Restoring chainId from localStorage:', parsedChainId)
          setChainId(parsedChainId)
          setWalletType(savedWalletType)
        }
        return
      }

      // Check if still connected
      const accounts = await provider.request({ method: 'eth_accounts' })
      if (accounts.length > 0 && accounts[0] === savedAddress) {
        setAddress(accounts[0])
        let parsedChainId: number
        try {
          const chain = await provider.request({ method: 'eth_chainId' })
          parsedChainId = parseInt(chain, 16)
          console.log('Fetched chainId from provider:', parsedChainId)
        } catch (err) {
          // If fetching chain fails, use saved chainId as fallback
          parsedChainId = savedChainId ? parseInt(savedChainId) : 1
          console.warn('Failed to fetch chain ID, using saved value:', parsedChainId, err)
        }
        setChainId(parsedChainId)
        localStorage.setItem('wallet_chain_id', parsedChainId.toString())
        setWalletType(savedWalletType)
        
        // Set up event listeners for the reconnected provider
        provider.on('accountsChanged', (accounts: string[]) => {
          if (accounts.length > 0) {
            setAddress(accounts[0])
            localStorage.setItem('wallet_address', accounts[0])
            onConnect?.(accounts[0]) // Notify parent of address change
          } else {
            disconnect()
          }
        })

        provider.on('chainChanged', (chainId: string) => {
          const parsedChainId = parseInt(chainId, 16)
          setChainId(parsedChainId)
          localStorage.setItem('wallet_chain_id', parsedChainId.toString())
        })
        
        onConnect?.(accounts[0])
      } else {
        // Wallet disconnected or different account
        console.log('Wallet not connected or account changed')
        localStorage.removeItem('wallet_address')
        localStorage.removeItem('wallet_type')
        localStorage.removeItem('wallet_connected')
        localStorage.removeItem('wallet_chain_id')
      }
    } catch (err) {
      console.error('Failed to check connection:', err)
    }
  }

  function handleAccountsChanged(accounts: string[]) {
    if (accounts.length === 0) {
      disconnect()
    } else {
      setAddress(accounts[0])
      localStorage.setItem('wallet_address', accounts[0])
      onConnect?.(accounts[0])
    }
  }

  function handleChainChanged(chainId: string) {
    const parsedChainId = parseInt(chainId, 16)
    setChainId(parsedChainId)
    localStorage.setItem('wallet_chain_id', parsedChainId.toString())
    window.location.reload() // Recommended by MetaMask
  }

  async function connectMetaMask() {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('MetaMask is not installed. Please install MetaMask extension.')
      return
    }

    try {
      setIsConnecting(true)
      setError(null)

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      })

      if (accounts.length > 0) {
        const walletAddress = accounts[0]
        setAddress(walletAddress)
        
        // Get chain ID
        const chain = await window.ethereum.request({ method: 'eth_chainId' })
        const parsedChainId = parseInt(chain, 16)
        setChainId(parsedChainId)
        
        // Save to localStorage
        localStorage.setItem('wallet_address', walletAddress)
        localStorage.setItem('wallet_connected', 'true')
        localStorage.setItem('wallet_type', 'metamask')
        localStorage.setItem('wallet_chain_id', parsedChainId.toString())
        
        setWalletType('metamask')
        setShowModal(false)
        onConnect?.(walletAddress)
      }
    } catch (err: any) {
      console.error('Failed to connect wallet:', err)
      setError(err.message || 'Failed to connect wallet')
    } finally {
      setIsConnecting(false)
    }
  }

  async function connectWalletConnect() {
    setError('WalletConnect integration coming soon!')
    // TODO: Implement WalletConnect
  }

  async function connectCoinbase() {
    // Check if Coinbase Wallet extension is installed
    if (typeof window === 'undefined') {
      setError('Browser not supported')
      return
    }

    try {
      setIsConnecting(true)
      setError(null)

      let coinbaseProvider = null

      // Method 1: Check if window.ethereum is Coinbase Wallet directly
      if (window.ethereum?.isCoinbaseWallet) {
        coinbaseProvider = window.ethereum
      }
      // Method 2: Check providerMap (when multiple wallets are installed)
      else if (window.ethereum?.providers) {
        // Some wallets inject as an array of providers
        coinbaseProvider = window.ethereum.providers.find((p: any) => p.isCoinbaseWallet)
      }
      // Method 3: Check if providerMap exists (EIP-5749)
      else if (window.ethereum?.providerMap?.get) {
        coinbaseProvider = window.ethereum.providerMap.get('CoinbaseWallet')
      }
      // Method 4: Check coinbase-specific injection
      else if (window.coinbaseWalletExtension) {
        coinbaseProvider = window.coinbaseWalletExtension
      }

      if (!coinbaseProvider) {
        setError('Coinbase Wallet not found. Please install the Coinbase Wallet extension or disable MetaMask temporarily to let Coinbase Wallet take priority.')
        setIsConnecting(false)
        // Don't close modal, let user see the error
        // window.open('https://www.coinbase.com/wallet/downloads', '_blank')
        return
      }

      // Request account access from Coinbase Wallet specifically
      const accounts = await coinbaseProvider.request({
        method: 'eth_requestAccounts'
      })

      if (accounts.length > 0) {
        const walletAddress = accounts[0]
        setAddress(walletAddress)
        
        // Get chain ID
        const chainIdHex = await coinbaseProvider.request({ method: 'eth_chainId' })
        const parsedChainId = parseInt(chainIdHex, 16)
        setChainId(parsedChainId)
        
        // Save to localStorage
        localStorage.setItem('wallet_address', walletAddress)
        localStorage.setItem('wallet_connected', 'true')
        localStorage.setItem('wallet_type', 'coinbase')
        localStorage.setItem('wallet_chain_id', parsedChainId.toString())
        
        // Set up event listeners for Coinbase Wallet
        coinbaseProvider.on('accountsChanged', (accounts: string[]) => {
          if (accounts.length > 0) {
            setAddress(accounts[0])
            localStorage.setItem('wallet_address', accounts[0])
            onConnect?.(accounts[0]) // Notify parent of address change
          } else {
            disconnect()
          }
        })

        coinbaseProvider.on('chainChanged', (chainId: string) => {
          const parsedChainId = parseInt(chainId, 16)
          setChainId(parsedChainId)
          localStorage.setItem('wallet_chain_id', parsedChainId.toString())
        })
        
        setShowModal(false)
        onConnect?.(walletAddress)
      }
    } catch (err: any) {
      console.error('Failed to connect Coinbase Wallet:', err)
      if (err.code === 4001) {
        setError('Connection rejected. Please try again.')
      } else {
        setError(err.message || 'Failed to connect Coinbase Wallet')
      }
    } finally {
      setIsConnecting(false)
    }
  }

  function disconnect() {
    setAddress(null)
    setChainId(null)
    setWalletType('unknown')
    localStorage.removeItem('wallet_address')
    localStorage.removeItem('wallet_connected')
    localStorage.removeItem('wallet_type')
    localStorage.removeItem('wallet_chain_id')
    onDisconnect?.()
  }

  const getChainName = (chainId: number | null) => {
    const chains: Record<number, string> = {
      1: 'Ethereum',
      5: 'Goerli',
      11155111: 'Sepolia',
      56: 'BSC',
      97: 'BSC Testnet',
      137: 'Polygon',
      80001: 'Mumbai',
      43114: 'Avalanche',
      43113: 'Fuji',
      42161: 'Arbitrum',
      421613: 'Arbitrum Goerli',
      10: 'Optimism',
      420: 'Optimism Goerli',
      8453: 'Base',
      84531: 'Base Goerli',
      84532: 'Base Sepolia',
      250: 'Fantom',
      4002: 'Fantom Testnet',
      25: 'Cronos',
      338: 'Cronos Testnet',
      100: 'Gnosis',
      1284: 'Moonbeam',
      1285: 'Moonriver',
      324: 'zkSync Era',
      280: 'zkSync Testnet',
      1101: 'Polygon zkEVM',
      59144: 'Linea',
      534352: 'Scroll',
    }
    return chainId ? chains[chainId] || `Chain ${chainId}` : 'Unknown'
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const getWalletIcon = () => {
    if (walletType === 'metamask') {
      return (
        <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21.5 12L18 8.5L19.5 3L14 6L12 2L10 6L4.5 3L6 8.5L2.5 12L6 15.5L4.5 21L10 18L12 22L14 18L19.5 21L18 15.5L21.5 12Z"/>
        </svg>
      )
    } else if (walletType === 'coinbase') {
      return (
        <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
        </svg>
      )
    }
    return (
      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  }

  if (address) {
    // Connected state - show wallet info
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="bg-slate-800 border border-slate-700 rounded-lg px-2 sm:px-4 py-1.5 sm:py-2 flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs sm:text-sm text-slate-400 hidden sm:inline">{getChainName(chainId)}</span>
          </div>
          <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {getWalletIcon()}
            <span className="text-xs sm:text-sm font-mono text-white">{formatAddress(address)}</span>
          </div>
          <button
            onClick={disconnect}
            className="text-slate-400 hover:text-red-400 transition-colors ml-1 sm:ml-2"
            title="Disconnect wallet"
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  // Not connected state - show connect button
  return (
    <>
      <button
        onClick={() => {
          setShowModal(true)
          setError(null) // Clear any previous errors when opening modal
        }}
        className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg font-semibold transition-all duration-200 flex items-center gap-1.5 sm:gap-2.5 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.02] text-xs sm:text-base"
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <span className="leading-none hidden sm:inline">Connect Wallet</span>
        <span className="leading-none sm:hidden">Connect</span>
      </button>

      {/* Wallet Selection Modal */}
      {mounted && showModal && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 overflow-y-auto">
          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-md w-full p-6 relative z-[10000] my-auto shadow-2xl">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-bold text-white">Connect Wallet</h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setError(null)
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-slate-400 text-sm mb-6">
              Connect your wallet to track positions and monitor your DeFi yields
            </p>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="text-red-400 text-sm">{error}</div>
                {error.includes('Coinbase Wallet not found') && (
                  <a 
                    href="https://www.coinbase.com/wallet/downloads" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2 underline"
                  >
                    Download Coinbase Wallet
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
                {error.includes('MetaMask is not installed') && (
                  <a 
                    href="https://metamask.io/download/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2 underline"
                  >
                    Download MetaMask
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            )}

            {/* Wallet Options */}
            <div className="space-y-3">
              {/* MetaMask */}
              <button
                onClick={connectMetaMask}
                disabled={isConnecting}
                className="w-full p-4 bg-slate-900 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 rounded-lg transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21.5 12L18 8.5L19.5 3L14 6L12 2L10 6L4.5 3L6 8.5L2.5 12L6 15.5L4.5 21L10 18L12 22L14 18L19.5 21L18 15.5L21.5 12Z"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="text-white font-semibold">MetaMask</div>
                    <div className="text-xs text-slate-400">Most popular wallet</div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* WalletConnect */}
              <button
                onClick={connectWalletConnect}
                disabled={isConnecting}
                className="w-full p-4 bg-slate-900 hover:bg-slate-700 border border-slate-700 hover:border-blue-500/50 rounded-lg transition-all flex items-center justify-between group opacity-50 cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="text-white font-semibold">WalletConnect</div>
                    <div className="text-xs text-slate-400">Coming soon</div>
                  </div>
                </div>
              </button>

              {/* Coinbase Wallet */}
              <button
                onClick={connectCoinbase}
                disabled={isConnecting}
                className="w-full p-4 bg-slate-900 hover:bg-slate-700 border border-slate-700 hover:border-blue-500/50 rounded-lg transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-400 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="text-white font-semibold">Coinbase Wallet</div>
                    <div className="text-xs text-slate-400">Self-custody wallet</div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Info */}
            <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-2 text-sm text-blue-300">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <strong>Safe & Secure</strong>
                  <p className="text-xs text-blue-400/80 mt-1">We never store your private keys. Your wallet stays in your control.</p>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
