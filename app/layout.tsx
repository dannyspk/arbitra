import './globals.css'
import React from 'react'
import ResponsiveLayout from '../components/ui/ResponsiveLayout'
import Footer from '../components/ui/Footer'
import dynamic from 'next/dynamic'
import { WalletProvider } from '../components/WalletProvider'

const TopbarClient = dynamic(() => import('../components/ui/TopbarClient'), { ssr: false })
const ClientShell = dynamic(() => import('../components/ClientShell'), { ssr: false })

export const metadata = {
  title: 'Arbitrage Dashboard',
  description: 'Live arbitrage opportunities',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950">
        <WalletProvider>
          <ResponsiveLayout>
            <ClientShell>
              <header className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm min-h-[10px] md:min-h-[88px] flex items-center">
                <div className="w-full">
                  <TopbarClient />
                </div>
              </header>
              <main className="flex-1 overflow-auto">
                {children}
                <Footer />
              </main>
            </ClientShell>
          </ResponsiveLayout>
        </WalletProvider>
      </body>
    </html>
  )
}
