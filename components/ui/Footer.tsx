'use client'

import React from 'react'

export default function Footer() {
  const currentYear = new Date().getFullYear()
  
  return (
    <footer className="border-t border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 backdrop-blur-sm">
      <div className="px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          {/* Brand Section */}
          <div className="space-y-3">
            <div className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Arbitra Pro
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Advanced cryptocurrency arbitrage and trading platform with AI-powered analysis.
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-slate-500">Live Trading Active</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Quick Links</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="/" className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Dashboard
                </a>
              </li>
              <li>
                <a href="/trading" className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Trading
                </a>
              </li>
              <li>
                <a href="/opportunities" className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  Opportunities
                </a>
              </li>
              <li>
                <a href="/balances" className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Balances
                </a>
              </li>
            </ul>
          </div>

          {/* Strategies */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Strategies</h4>
            <ul className="space-y-2 text-xs">
              <li className="text-slate-400 flex items-center gap-2">
                <span className="text-red-400">🐻</span>
                <span>Bear Market Strategy</span>
              </li>
              <li className="text-slate-400 flex items-center gap-2">
                <span className="text-green-400">🐂</span>
                <span>Bull Market Strategy</span>
              </li>
              <li className="text-slate-400 flex items-center gap-2">
                <span className="text-cyan-400">⚡</span>
                <span>Scalp Strategy</span>
              </li>
              <li className="text-slate-400 flex items-center gap-2">
                <span className="text-purple-400">📊</span>
                <span>Range/Grid Strategy</span>
              </li>
              <li className="text-slate-400 flex items-center gap-2">
                <span className="text-indigo-400">🤖</span>
                <span>AI-Powered Analysis</span>
              </li>
            </ul>
          </div>

          {/* System Status */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">System Status</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">API Status</span>
                <span className="text-green-400 font-semibold">●  Online</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">WebSocket</span>
                <span className="text-green-400 font-semibold">●  Connected</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Data Feeds</span>
                <span className="text-green-400 font-semibold">●  Active</span>
              </div>
              <div className="mt-3 p-2 bg-slate-800/50 rounded-lg border border-slate-700/30">
                <div className="text-xs text-slate-500">
                  <div className="font-semibold text-slate-400 mb-1">Supported Exchanges</div>
                  <div className="flex flex-wrap gap-1">
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px] border border-amber-500/20">Binance</span>
                    <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-[10px] border border-cyan-500/20">MEXC</span>
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px] border border-blue-500/20">Gate.io</span>
                    <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-[10px] border border-purple-500/20">KuCoin</span>
                    <span className="px-2 py-0.5 bg-orange-500/10 text-orange-400 rounded text-[10px] border border-orange-500/20">Bitget</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-4 border-t border-slate-800/50">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              © {currentYear} Arbitra Pro by Cointist. All rights reserved.
            </div>
            
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secure Trading
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Encrypted
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Real-time Data
              </span>
            </div>

            <div className="text-xs text-slate-600">
              v1.0.0 • Built with Next.js & FastAPI
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
