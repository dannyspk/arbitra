import { useEffect, useRef, useState, useCallback } from 'react'

export interface LiveBalance {
  wallet_balance: number
  unrealized_pnl: number
  realized_pnl: number
  total_fees_paid: number
  net_balance: number
}

export interface LivePosition {
  symbol: string
  side: string
  entry_price: number
  size: number
  unrealized_pnl: number
  unrealized_pnl_pct?: number
  leverage?: number
  liquidation_price?: number
  stop_loss?: number
  take_profit?: number
  entry_time?: number
  current_price?: number
  position_id?: string // Unique ID for hedge mode (symbol_LONG or symbol_SHORT)
}

export interface LiveOrder {
  id: string
  symbol: string
  type: string
  side: string
  status: string
  price: number
  amount: number
  filled: number
  remaining: number
  timestamp: number
}

export interface LiveDashboardData {
  balance: LiveBalance | null
  positions: LivePosition[]
  orders: LiveOrder[]
  connected: boolean
  error: string | null
  lastUpdate: number
}

export function useLiveDashboardWebSocket() {
  const [data, setData] = useState<LiveDashboardData>({
    balance: null,
    positions: [],
    orders: [],
    connected: false,
    error: null,
    lastUpdate: 0,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
    const wsUrl = backend.replace('http', 'ws') + '/ws/live-dashboard'

    console.log('[WS] Connecting to:', wsUrl)

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WS] ✅ Connected to live dashboard WebSocket')
        reconnectAttempts.current = 0
        setData((prev) => ({ ...prev, connected: true, error: null }))
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          switch (message.type) {
            case 'connected':
              console.log('[WS] Connected:', message.message)
              break

            case 'balance':
              setData((prev) => ({
                ...prev,
                balance: message.data,
                lastUpdate: message.timestamp,
              }))
              break

            case 'positions':
              setData((prev) => ({
                ...prev,
                positions: message.data,
                lastUpdate: message.timestamp,
              }))
              break

            case 'pnl_update':
              // Update specific position with latest P&L (use position_id for hedge mode)
              setData((prev) => ({
                ...prev,
                positions: prev.positions.map((pos) => {
                  const posId = pos.position_id || `${pos.symbol}_${pos.side?.toUpperCase()}`
                  const updateId = message.data.position_id || `${message.data.symbol}_${message.data.side?.toUpperCase()}`
                  
                  return posId === updateId
                    ? {
                        ...pos,
                        current_price: message.data.current_price,
                        unrealized_pnl: message.data.unrealized_pnl,
                        unrealized_pnl_pct: message.data.unrealized_pnl_pct,
                        stop_loss: message.data.stop_loss,
                        take_profit: message.data.take_profit,
                      }
                    : pos
                }),
                lastUpdate: message.timestamp,
              }))
              break

            case 'orders':
              setData((prev) => ({
                ...prev,
                orders: message.data,
                lastUpdate: message.timestamp,
              }))
              break

            case 'ping':
              // Keepalive ping from server - acknowledge silently
              // Server sends these every 30s to keep connection alive
              break

            case 'error':
              console.error('[WS] Error:', message.message)
              setData((prev) => ({
                ...prev,
                error: message.message,
                connected: false,
              }))
              break

            default:
              console.log('[WS] Unknown message type:', message.type)
          }
        } catch (error) {
          console.error('[WS] Failed to parse message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('[WS] WebSocket error:', error)
        setData((prev) => ({
          ...prev,
          error: 'WebSocket connection error',
          connected: false,
        }))
      }

      ws.onclose = () => {
        console.log('[WS] Connection closed')
        setData((prev) => ({ ...prev, connected: false }))

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
          console.log(`[WS] Reconnecting in ${delay}ms... (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`)

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++
            connect()
          }, delay)
        } else {
          console.log('[WS] Max reconnection attempts reached')
          setData((prev) => ({
            ...prev,
            error: 'Failed to reconnect to WebSocket',
          }))
        }
      }
    } catch (error) {
      console.error('[WS] Failed to create WebSocket:', error)
      setData((prev) => ({
        ...prev,
        error: 'Failed to create WebSocket connection',
        connected: false,
      }))
    }
  }, [])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    ...data,
    reconnect: connect,
    disconnect,
  }
}
