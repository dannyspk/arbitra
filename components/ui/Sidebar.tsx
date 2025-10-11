"use client"
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/', label: 'Dashboard', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M3 6h18M3 18h18"/></svg>
  ) },
  { href: '/opportunities', label: 'Market Signals', icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2"/></svg>
  ) },
{ href: '/trading', label: 'Trading', icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M9 18h6"/></svg>
  ) },
  { href: '/defi', label: 'DeFi Savings', icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
  ) },

  { href: '/arbitrage', label: 'Arbitrage', icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>
  ) },
  { href: '/execution', label: 'Liquidation', icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 8v8M8 12h8"/></svg>
  ) },
  { href: '/balances', label: 'Balances', icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 2l9 4.5v11L12 22 3 17.5v-11L12 2z"/></svg>
  ) },
  
  
  { href: '/logs', label: 'Logs', icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M5 3v18l7-3 7 3V3H5z"/></svg>
  ) },
  { href: '/settings', label: 'Settings', icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82L4.2 4.6A2 2 0 017 1.77l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001 1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51h.12a1.65 1.65 0 001.82-.33l.06-.06A2 2 0 0119.4 4.6l-.06.06a1.65 1.65 0 00-.33 1.82V8a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
  ) },
]

export default function Sidebar() {
  const pathname = usePathname() || '/'
  return (
    <nav className="p-4 overflow-y-auto h-[calc(100vh-73px)] bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 scrollbar-hide">
      <ul className="space-y-2">
        {items.map((it) => {
          const active = pathname === it.href || (it.href !== '/' && pathname.startsWith(it.href))
          return (
            <li key={it.href}>
              <Link 
                href={it.href} 
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                  active 
                    ? 'bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 text-white border border-cyan-500/40 shadow-lg shadow-cyan-500/20' 
                    : 'text-slate-400 hover:text-white hover:bg-gradient-to-r hover:from-slate-800/80 hover:to-slate-800/50 border border-slate-700/30 hover:border-slate-600/50 hover:shadow-md hover:shadow-slate-700/20'
                }`}
              >
                {active && (
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 animate-pulse"></div>
                )}
                <span className={`relative z-10 transition-all duration-300 ${
                  active 
                    ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' 
                    : 'text-slate-500 group-hover:text-slate-300'
                }`}>
                  {it.icon}
                </span>
                <span className={`relative z-10 font-medium transition-all duration-300 ${
                  active ? 'text-white' : 'group-hover:text-white'
                }`}>
                  {it.label}
                </span>
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-r-full shadow-lg shadow-cyan-500/50"></div>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
