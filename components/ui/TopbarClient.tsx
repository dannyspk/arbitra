'use client'

import React from 'react'
import Topbar from './Topbar'
import ConnectionProvider from '../..//components/ConnectionProvider'

export default function TopbarClient() {
  return (
    <ConnectionProvider>
      <Topbar />
    </ConnectionProvider>
  )
}
