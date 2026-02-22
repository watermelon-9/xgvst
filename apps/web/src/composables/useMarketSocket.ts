import { buildWsUrl } from '~/config/env'

export type MarketSocketState = 'idle' | 'connecting' | 'online' | 'offline'

export function useMarketSocket() {
  const state = ref<MarketSocketState>('idle')
  const reconnectAttempt = ref(0)
  const lastEvent = ref('')
  const connectedAt = ref<number | null>(null)

  let socket: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let pongTimeoutTimer: ReturnType<typeof setTimeout> | null = null
  let shouldReconnect = true

  // 0-RTT 快速重连 + 指数退避
  const backoffSeconds = [0, 0.3, 0.6, 1.2, 2.4]

  function clearTimers() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
    if (pongTimeoutTimer) {
      clearTimeout(pongTimeoutTimer)
      pongTimeoutTimer = null
    }
  }

  function startHeartbeat() {
    if (!socket || socket.readyState !== WebSocket.OPEN)
      return

    heartbeatTimer = setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN)
        return

      socket.send(JSON.stringify({ type: 'ping', ts: Date.now() }))

      if (pongTimeoutTimer)
        clearTimeout(pongTimeoutTimer)

      pongTimeoutTimer = setTimeout(() => {
        lastEvent.value = 'pong timeout > 10s, reconnecting...'
        socket?.close()
      }, 10_000)
    }, 15_000)
  }

  function scheduleReconnect() {
    if (!shouldReconnect)
      return

    clearTimers()

    const idx = Math.min(reconnectAttempt.value, backoffSeconds.length - 1)
    const waitMs = backoffSeconds[idx] * 1000
    reconnectAttempt.value += 1
    state.value = 'offline'
    lastEvent.value = `reconnect in ${waitMs}ms (attempt ${reconnectAttempt.value})`

    reconnectTimer = setTimeout(() => {
      connect()
    }, waitMs)
  }

  function connect() {
    shouldReconnect = true
    clearTimers()

    state.value = 'connecting'
    const wsUrl = buildWsUrl('/ws')
    socket = new WebSocket(wsUrl)
    socket.binaryType = 'arraybuffer'

    socket.onopen = () => {
      reconnectAttempt.value = 0
      state.value = 'online'
      connectedAt.value = Date.now()
      lastEvent.value = 'socket connected'
      startHeartbeat()
    }

    socket.onmessage = (event) => {
      if (typeof event.data === 'string' && event.data.includes('"type":"pong"')) {
        if (pongTimeoutTimer) {
          clearTimeout(pongTimeoutTimer)
          pongTimeoutTimer = null
        }
      }
      lastEvent.value = `msg @ ${new Date().toLocaleTimeString()}`
    }

    socket.onerror = () => {
      lastEvent.value = 'socket error'
    }

    socket.onclose = () => {
      scheduleReconnect()
    }
  }

  function disconnect() {
    shouldReconnect = false
    clearTimers()
    state.value = 'idle'
    socket?.close()
    socket = null
  }

  onBeforeUnmount(() => {
    disconnect()
  })

  return {
    state,
    reconnectAttempt,
    lastEvent,
    connectedAt,
    connect,
    disconnect,
  }
}
