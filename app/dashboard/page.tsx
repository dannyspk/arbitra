'use client'

import React from 'react'

export default function Page() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-semibold">Dashboard</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded shadow">P&L Today</div>
        <div className="p-4 bg-white rounded shadow">Successful fills</div>
        <div className="p-4 bg-white rounded shadow">Win rate</div>
      </div>
      <div className="mt-4 md:mt-6 p-4 bg-white rounded shadow">Live Spread Heatmap (placeholder)</div>
      <div className="mt-4 md:mt-6 p-4 bg-white rounded shadow">Top 10 Opportunities (placeholder)</div>
    </div>
  )
}
