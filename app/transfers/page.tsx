'use client'

import React from 'react'

export default function Page() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
            Transfers
          </h1>
          <p className="text-sm md:text-base text-slate-400">Initiate on-chain or exchange transfers</p>
        </header>
        
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg shadow-lg border border-slate-700/50 p-6 md:p-8">
          <div className="text-center text-slate-400">
            <div className="mb-4">
              <svg className="w-12 h-12 md:w-16 md:h-16 mx-auto text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <p className="text-base md:text-lg">Transfer functionality coming soon</p>
            <p className="text-xs md:text-sm text-slate-500 mt-2">This page will allow you to transfer funds between exchanges and wallets</p>
          </div>
        </div>
      </div>
    </div>
  )
}
