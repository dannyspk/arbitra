'use client'

import React from 'react'

type Msg = { type?: string; payload?: any }

type ConnectionContextType = {
  connected: boolean
  connect: () => void
  disconnect: () => void
  send: (data: any) => void
  lastMessage: Msg | null
  lastHotMessage: Msg | null
}

const ConnectionContext = React.createContext<ConnectionContextType | null>(null)

export function useConnection() {
  const ctx = React.useContext(ConnectionContext)
  if (!ctx) throw new Error('useConnection must be used within ConnectionProvider')
  return ctx
}

export default function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = React.useState(false)
  const [lastMessage, setLastMessage] = React.useState<Msg | null>(null)
  const [lastHotMessage, setLastHotMessage] = React.useState<Msg | null>(null)
  const wsRef = React.useRef<WebSocket | null>(null)
  const hotRef = React.useRef<WebSocket | null>(null)

  const connect = React.useCallback(() => {
    if (wsRef.current) return
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    
    // Get backend URL and convert to WebSocket URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
    const wsBaseUrl = apiUrl.replace(/^http/, 'ws').replace(/^https/, 'wss')
    
    const wsUrl = `${wsBaseUrl}/ws/opportunities`
    const ws = new WebSocket(wsUrl)
    ws.onopen = () => setConnected(true)
    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
    }
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        setLastMessage({ type: 'opps', payload: data })
      } catch (e) {
        setLastMessage({ type: 'raw', payload: ev.data })
      }
    }
    ws.onerror = () => {
      // keep it simple: close on error
      try { ws.close() } catch {}
    }
    wsRef.current = ws
    // also open hotcoins websocket (separate connection)
    try {
      const hotUrl = `${wsBaseUrl}/ws/hotcoins`
      const hws = new WebSocket(hotUrl)
      hws.onopen = () => {}
      hws.onclose = () => { hotRef.current = null }
      hws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          setLastHotMessage({ type: 'hot', payload: data })
        } catch (e) {
          setLastHotMessage({ type: 'raw', payload: ev.data })
        }
      }
      hotRef.current = hws
    } catch (e) {
      // ignore hot ws errors
    }
  }, [])

  const disconnect = React.useCallback(() => {
    if (!wsRef.current) return
    try { wsRef.current.close() } catch {}
    wsRef.current = null
    if (hotRef.current) {
      try { hotRef.current.close() } catch {}
      hotRef.current = null
    }
    setConnected(false)
  }, [])

  const send = React.useCallback((data: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify(data))
  }, [])

  // auto-connect on mount
  React.useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  const value = React.useMemo(() => ({ connected, connect, disconnect, send, lastMessage, lastHotMessage }), [connected, connect, disconnect, send, lastMessage, lastHotMessage])

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>
}
