"use client"

import React from 'react'
import ConnectionProvider from './ConnectionProvider'

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return <ConnectionProvider>{children}</ConnectionProvider>
}
