import React from 'react'

export function Button({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="px-3 py-1 rounded bg-sky-600 text-white hover:bg-sky-700">
      {children}
    </button>
  )
}
