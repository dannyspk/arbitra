'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface WalletContextType {
  address: string | null
  setAddress: (address: string | null) => void
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  setAddress: () => {},
})

export function useWallet() {
  return useContext(WalletContext)
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem('wallet_address')
    if (savedAddress) {
      setAddress(savedAddress)
    }
  }, [])

  // Save to localStorage when address changes
  useEffect(() => {
    if (address) {
      localStorage.setItem('wallet_address', address)
    } else {
      localStorage.removeItem('wallet_address')
    }
  }, [address])

  return (
    <WalletContext.Provider value={{ address, setAddress }}>
      {children}
    </WalletContext.Provider>
  )
}
