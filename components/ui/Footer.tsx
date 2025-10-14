'use client'

import React from 'react'

export default function Footer() {
  const currentYear = new Date().getFullYear()
  
  return (
    <footer className="border-t border-white/40 bg-gradient-to-b from-white/90 via-white/85 to-white/80 backdrop-blur-xl">
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          {/* Brand Section */}
          <div className="space-y-3">
            <div className="text-lg font-bold bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
              CryptoAIEdge
            </div>
            <p className="text-xs text-slate-800 leading-relaxed font-medium">
              Advanced cryptocurrency trading platform with AI-powered analysis and real-time signals.
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-400/50"></div>
              <span className="text-xs text-slate-700 font-semibold">Live Trading Active</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Quick Links</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="/" className="text-slate-700 hover:text-cyan-600 transition-colors flex items-center gap-1.5 font-medium hover:translate-x-1 transform duration-200">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Dashboard
                </a>
              </li>
              <li>
                <a href="/trading" className="text-slate-700 hover:text-cyan-600 transition-colors flex items-center gap-1.5 font-medium hover:translate-x-1 transform duration-200">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Trading
                </a>
              </li>
              <li>
                <a href="/opportunities" className="text-slate-700 hover:text-cyan-600 transition-colors flex items-center gap-1.5 font-medium hover:translate-x-1 transform duration-200">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  Opportunities
                </a>
              </li>
              <li>
                <a href="/balances" className="text-slate-700 hover:text-cyan-600 transition-colors flex items-center gap-1.5 font-medium hover:translate-x-1 transform duration-200">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Balances
                </a>
              </li>
            </ul>
          </div>

          {/* Strategies */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Strategies</h4>
            <ul className="space-y-2 text-xs">
              <li className="text-slate-700 flex items-center gap-2 font-medium">
                <span className="text-lg">🐻</span>
                <span>Bear Market Strategy</span>
              </li>
              <li className="text-slate-700 flex items-center gap-2 font-medium">
                <span className="text-lg">🐂</span>
                <span>Bull Market Strategy</span>
              </li>
              <li className="text-slate-700 flex items-center gap-2 font-medium">
                <span className="text-lg">⚡</span>
                <span>Scalp Strategy</span>
              </li>
              <li className="text-slate-700 flex items-center gap-2 font-medium">
                <span className="text-lg">📊</span>
                <span>Range/Grid Strategy</span>
              </li>
              <li className="text-slate-700 flex items-center gap-2 font-medium">
                <span className="text-lg">🤖</span>
                <span>AI-Powered Analysis</span>
              </li>
            </ul>
          </div>

          {/* System Status */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">System Status</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-medium">API Status</span>
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <span className="text-emerald-500">●</span> Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-medium">WebSocket</span>
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <span className="text-emerald-500">●</span> Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-medium">Data Feeds</span>
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <span className="text-emerald-500">●</span> Active
                </span>
              </div>
              <div className="mt-3 p-3 bg-gradient-to-br from-white/90 to-slate-50/90 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs">
                  <div className="font-bold text-slate-900 mb-2">Supported Exchanges</div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-1 bg-gradient-to-r from-amber-500/30 to-amber-600/30 text-amber-800 rounded-md text-[10px] font-bold border border-amber-500/40 shadow-sm">Binance</span>
                    <span className="px-2.5 py-1 bg-gradient-to-r from-cyan-500/30 to-cyan-600/30 text-cyan-800 rounded-md text-[10px] font-bold border border-cyan-500/40 shadow-sm">MEXC</span>
                    <span className="px-2.5 py-1 bg-gradient-to-r from-blue-500/30 to-blue-600/30 text-blue-800 rounded-md text-[10px] font-bold border border-blue-500/40 shadow-sm">Gate.io</span>
                    <span className="px-2.5 py-1 bg-gradient-to-r from-purple-500/30 to-purple-600/30 text-purple-800 rounded-md text-[10px] font-bold border border-purple-500/40 shadow-sm">KuCoin</span>
                    <span className="px-2.5 py-1 bg-gradient-to-r from-orange-500/30 to-orange-600/30 text-orange-800 rounded-md text-[10px] font-bold border border-orange-500/40 shadow-sm">Bitget</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-5 border-t border-slate-200/80">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-700 font-medium">
              © {currentYear} CryptoAIEdge. All rights reserved.
            </div>
            
            <div className="flex items-center gap-5 text-xs text-slate-700 font-medium">
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secure Trading
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Encrypted
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Real-time Data
              </span>
            </div>

            <div className="text-xs text-slate-600 font-medium">
              v1.0.0 • Built with Next.js & FastAPI
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
