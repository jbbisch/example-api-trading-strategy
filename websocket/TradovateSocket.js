const WebSocket = require('ws')
const { writeToLog } = require('../utils/helpers')
const { clear, error } = require('winston')
const { renewAccessToken } = require('../endpoints/renewAccessToken')
// const logger = require('../utils/logger')

function Counter() {
  this.current = 0
  this.increment = () => {
    this.current += 1
    return this.current
  }
}

/**
 * Constructor for the Tradovate WebSocket
 */
function TradovateSocket() {
  this.ws = null
  this.counter = new Counter()
  this.reconnectAttempts = 0
  this.subscriptions = []
  this.strategy = null
  this.wsUrl = null
  this._connId = 0
  this._syncAttachCount = 0
  this._reconnectCalls = 0
  this._lastReconnectAt = 0
  this._reconnectTimer = null
  this._reconnecting = false
}

TradovateSocket.prototype.getSocket = function () {
  return this.ws
}

TradovateSocket.prototype._dbg = function (label, extra = {}) {
  const ws = this.ws
  const messageListeners =
    ws && typeof ws.listenerCount === 'function' ? ws.listenerCount('message') : 'n/a'

  console.log(`[DBG:${label}]`, {
    pid: process.pid,
    connId: this._connId,
    wsState: ws ? ws.readyState : null,
    messageListeners,
    ...extra,
  })
}

/**
 * Sets up a request/response pairing that will call `callback` when the response is received.
 * This function will return a cancellable subscription in the form of a function with zero parameters
 * that removes the event listener.
 */
TradovateSocket.prototype.request = function ({ url, query = '', body = {}, callback, disposer }) {
  const id = this.counter.increment()

  // The socket instance this subscription is currently bound to
  let wsRef = this.ws

  // Build a listener that is bound to THIS requestId and only processes array messages
  const makeListener = () => (msg) => {
    // only array messages (Tradovate sends arrays with leading 'a')
    if (typeof msg?.data !== 'string' || msg.data[0] !== 'a') return

    let items = []
    try {
      items = JSON.parse(msg.data.slice(1))
    } catch (_) {}

    for (const item of items) {
      callback(id, item)
    }
  }

  let listener = makeListener()

  const attach = () => {
    if (!wsRef) return
    wsRef.addEventListener('message', listener)
    this._dbg('REQUEST_ATTACH', {
      url,
      requestId: id,
      boundConnId: this._connId,
      boundWsState: wsRef.readyState,
      boundListeners:
        typeof wsRef.listenerCount === 'function' ? wsRef.listenerCount('message') : 'n/a',
    })
  }

  const detach = () => {
    if (!wsRef || !listener) return
    try {
      wsRef.removeEventListener('message', listener)
    } catch (_) {}
    this._dbg('REQUEST_DETACH', {
      url,
      requestId: id,
      boundConnId: this._connId,
      boundWsState: wsRef.readyState,
      boundListeners:
        typeof wsRef.listenerCount === 'function' ? wsRef.listenerCount('message') : 'n/a',
    })
  }

  const send = () => {
    if (!wsRef) return
    if (wsRef.readyState === WebSocket.OPEN) {
      wsRef.send(`${url}\n${id}\n${query}\n${JSON.stringify(body)}`)
    }
  }

  // initial bind + send
  attach()
  send()

  // used on reconnect to rebind listener to the NEW ws instance AND resend
  const resubscribe = () => {
    // 1) detach from the OLD socket instance
    detach()

    // 2) move the reference to the CURRENT socket instance
    wsRef = this.ws

    // 3) create a fresh listener and attach to the NEW socket instance
    listener = makeListener()
    attach()

    // 4) resend on the new socket
    send()

    console.log('[tsRequest] resubscribed:', url)
  }

  const unsubscribe = () => {
    try {
      if (disposer && typeof disposer === 'function') disposer()
    } catch (_) {}

    // detach from whichever socket instance we're currently bound to
    detach()

    this.subscriptions = this.subscriptions.filter((sub) => sub.id !== id)
  }

  // keep everything we need to resubscribe later
  this.subscriptions.push({ url, query, body, callback, disposer, resubscribe, unsubscribe, id })

  return unsubscribe
}

TradovateSocket.prototype.synchronize = function (callback) {
  if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
    console.warn('no websocket connection available, please connect the websocket and try again.')
    return
  }
  return this.request({
    url: 'user/syncrequest',
    body: { accounts: [parseInt(process.env.ID, 10)] },
    callback: (id, data) => {
      if (
        data.i === id ||
        (data.e && data.e === 'props') ||
        (data.e && data.e === 'clock')
      ) {
        callback(data.d)
      }
    },
  })
}

// /**
//  * Set a function to be called when the socket synchronizes.
//  */
TradovateSocket.prototype.onSync = function(callback) {
  this._syncAttachCount += 1
  this._dbg('ONSYNC_ATTACH', { syncAttachCount: this._syncAttachCount })

  this._onSyncCallback = callback

  // detach old handler from old ws, if present
  if (this._onSyncHandler && this.ws) {
    try { this.ws.removeEventListener('message', this._onSyncHandler) } catch (_) {}
  }

  const wsRef = this.ws  // <-- tiny addition

  this._onSyncHandler = async (msg) => {
    // <-- tiny addition
    if (this.ws !== wsRef) return

    const { data } = msg
    const kind = data.slice(0, 1)

    switch (kind) {
      case 'a': {
        const parsedData = JSON.parse(msg.data.slice(1))
        let schemaOk = {}
        const schemafields = ['users']

        parsedData.forEach((data) => {
          if (!data.d || typeof data.d !== 'object') return
          schemafields.forEach((k) => {
            if (schemaOk && !schemaOk.value) return
            if (Object.keys(data.d).includes(k) && Array.isArray(data.d[k])) {
              schemaOk = { value: true }
            } else {
              schemaOk = { value: false }
            }
          })

          if (schemaOk.value) {
            this._onSyncCallback(data.d)
          }
        })
        break
      }
      default:
        break
    }
  }

  this.ws.addEventListener('message', this._onSyncHandler)
}

TradovateSocket.prototype.setupHeartbeat = function (wsRef) {
  const heartbeatInterval = 2500
  clearInterval(this.heartbeatInterval)
  this.heartbeatInterval = setInterval(() => {
    // IMPORTANT: only send on the same socket instance we started the heartbeat for
    if (this.ws !== wsRef) return
    if (wsRef && wsRef.readyState === WebSocket.OPEN) {
      wsRef.send('[]')
      //console.log('INTERVAL heartbeat sent to server')
    }
  }, heartbeatInterval)
}

/**
 * Modify the connect method to handle connection failures and auto-reconnect.
 */
TradovateSocket.prototype.connect = async function (url) {
  //console.log('connecting to url:', url)
  this.ws = new WebSocket(url)
  this.wsUrl = url
  this._connId += 1

  const wsRef = this.ws // <— added: snapshot the socket instance for stale-event protection

  this._dbg('WS_CREATED', { url })
  wsRef.setMaxListeners(24)
  this.counter = new Counter()

  let interval

  await new Promise((res, rej) => {
    if (!wsRef) {
      rej('no websocket connection available')
      return
    }

    wsRef.addEventListener('open', () => {
      if (this.ws !== wsRef) return // <— added stale guard
      console.log('[ConnectOpenEvent] Websocket connection opened. Sending auth request...')
      this._dbg('OPEN_EVENT')
      wsRef.send(`authorize\n0\n\n${process.env.ACCESS_TOKEN}`)
      this.reconnectAttempts = 0
      this.setupHeartbeat(wsRef) // <— changed to use wsRef
      res()
    })

    wsRef.addEventListener('error', (err) => {
      if (this.ws !== wsRef) return // <— added stale guard
      console.error('[ConnectErrorEvent] Websocket error: ' + err)
      clearInterval(this.heartbeatInterval)
      if (!this._reconnecting && !this._reconnectTimer) this.reconnect()
      this.reconnectAttempts += 1
      rej(err)
    })

    wsRef.addEventListener('close', (event) => {
      if (this.ws !== wsRef) return // <— added stale guard
      console.warn(
        `[ConnectCloseEvent] WebSocket closed with code: ${event.code}, reason: ${event.reason}`
      )
      clearInterval(this.heartbeatInterval) // Clear the heartbeat interval on close
      if (event.code !== 1000) {
      // Non-normal closure should try to reconnect
      console.log('(onClose) Attempting to reconnect...')
      if (!this._reconnecting && !this._reconnectTimer) this.reconnect()
      this.reconnectAttempts += 1
      }
      res()
    })

    wsRef.addEventListener('message', async (msg) => {
      if (this.ws !== wsRef) return // <— added stale guard

      const { type, data } = msg
      if (type !== 'message') return

      const kind = data?.slice?.(0, 1)

      // Only debug for handshake-ish tokens (reduces spam)
      if (kind === 'o' || kind === 'h' || kind === 'c') {
        this._dbg('CONNECT_MESSAGE_KIND', { kind })
      }

      //message discriminator
      switch (kind) {
        case 'o':
          // console.log('Making WS auth request...')
          const token =
            this.constructor.name === 'TradovateSocket'
              ? process.env.ACCESS_TOKEN
              : process.env.MD_ACCESS_TOKEN
          wsRef.send(`authorize\n0\n\n${token}`)

          interval = setInterval(() => {
            // IMPORTANT: keep interval tied to this socket instance
            if (this.ws !== wsRef) {
              clearInterval(interval)
              return
            }
            if (wsRef.readyState == 0 || wsRef.readyState == 3 || wsRef.readyState == 2) {
              clearInterval(interval)
              return
            }
            wsRef.send('[]')
          }, 2500)
          break

        case 'h':
          this.setupHeartbeat(wsRef) // <— changed to use wsRef
          res()
          break

        case 'a':
          const parsedData = JSON.parse(msg.data.slice(1))
          const [first] = parsedData
          if (first.i === 0 && first.s === 200) {
            res()
          } else rej()
          break

        case 'c':
          clearInterval(this.heartbeatInterval)
          res()
          break

        default:
          console.error('Unexpected response token received:')
          console.error(msg)
          break
      }
    })
  })
}

TradovateSocket.prototype.disconnect = function () {
  console.log('closing websocket connection')
  this._dbg('DISCONNECT_BEFORE_CLOSE')

  // NEW: cancel any scheduled reconnect so it can't fire after an intentional disconnect
  if (this._reconnectTimer) {
    clearTimeout(this._reconnectTimer)
    this._reconnectTimer = null
  }

  if (this.ws) {
    // remove onSync handler if present
    if (this._onSyncHandler) {
      try {
        this.ws.removeEventListener('message', this._onSyncHandler)
      } catch (_) {}
    }

    // remove request listeners via their unsubscribe functions
    this.subscriptions.forEach((sub) => {
      try {
        if (typeof sub.unsubscribe === 'function') sub.unsubscribe()
      } catch (_) {}
    })

    // NEW: hard-kill the socket to avoid "ghost OPEN sockets"
    try {
      if (typeof this.ws.terminate === 'function') this.ws.terminate()
    } catch (_) {}

    try {
      this.ws.close(1000, 'Client initiated disconnect.')
    } catch (_) {}
  }
  
  this.ws = null
  clearInterval(this.heartbeatInterval)
}

TradovateSocket.prototype.isConnected = function () {
  return this.ws && this.ws.readyState === WebSocket.OPEN
}

/**
 * Attempts to reconnect the WebSocket after an unexpected closure.
 */
TradovateSocket.prototype.reconnect = async function () {
  // NEW: single-flight reconnect guard
  if (this._reconnecting || this._reconnectTimer) {
    this._dbg('RECONNECT_SKIPPED', {
      reconnecting: this._reconnecting,
      hasTimer: !!this._reconnectTimer,
      wsState: this.ws ? this.ws.readyState : null,
    })
    return
  }
  
  this._reconnectCalls += 1
  this._lastReconnectAt = Date.now()
  this._dbg('RECONNECT_CALL', {
    reconnectCalls: this._reconnectCalls,
    reconnectAttempts: this.reconnectAttempts,
    wsState: this.ws ? this.ws.readyState : null,
    hasUrl: !!this.wsUrl,
  })

  if (!this.wsUrl) {
    console.error('[TsReconnect] No WebSocket URL available for reconnection.')
    return
  }

  if (!this.isConnected()) {
    const backoff = Math.min(30000, Math.pow(2, this.reconnectAttempts) * 1000)
    console.log(`[TsReconnect] Waiting ${backoff}ms before reconnect attempt...`)

    // NEW: store timer id so we can guard + cancel it
    this._reconnectTimer = setTimeout(async () => {
      // timer is now firing; clear it
      this._reconnectTimer = null
      this._reconnecting = true

      try {
        console.log('[TsReconnect] Renewing access token...')
        const tokenResult = await renewAccessToken()
        if (!tokenResult) {
          console.error('[TsReconnect] Token renewal failed.')
          this.reconnectAttempts += 1
          return
        }
        console.log('[TsReconnect] Token successfully renewed.')

        // Save current buffer before disconnecting
        const oldBuffer = this.strategy?.state?.buffer?.getData() || []

        // Clean up any existing connection
        if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
          this.disconnect()
        }

        console.log('[TsReconnect] Reconnecting to:', this.wsUrl)
        await this.connect(this.wsUrl)
        console.log('[TsReconnect] WebSocket reconnected.')
        this._dbg('AFTER_RECONNECT_CONNECTED', {
          reconnectCalls: this._reconnectCalls,
          connId: this._connId,
        })

        this.subscriptions = []
        
        // Reinitialize strategy
        if (this.strategy) {
          const strategyProps = this.strategy.props
          this.strategy = new this.strategy.constructor(strategyProps)

          const state = await this.strategy.init()
          if (oldBuffer.length && state?.buffer) {
            oldBuffer.forEach((data) => state.buffer.softPush(data))
          }
          this.strategy.state = state
          console.log('[TsReconnect] Strategy reinitialized and buffer restored.')

          // Manually trigger next() and drawEffect
          const last = state.buffer?.last?.() || oldBuffer[oldBuffer.length - 1]
          if (last) {
            if (typeof this.strategy.next === 'function') {
              this.strategy.state = this.strategy.next(state, [
                'Chart',
                { data: last, props: strategyProps },
              ]).state
              console.log('[TsReconnect] Manually triggered strategy.next()')
            }

            if (typeof this.strategy.drawEffect === 'function') {
              this.strategy.drawEffect(this.strategy.state, [
                'crossover/draw',
                { props: strategyProps },
              ])
              console.log('[TsReconnect] Manually triggered strategy.drawEffect()')
            }
          }
        } else {
          console.log('[TsReconnect] No strategy to reinitialize.')
        }

        // Resynchronize with server
        this.synchronize((data) => {
          if (typeof this.onSync === 'function') {
            //this.onSync(data);
          }
          console.log('[TsReconnect] Subscribed to sync events.')
        })

        this.reconnectAttempts = 0 // success — reset counter
      } catch (err) {
        console.error('[TsReconnect] Reconnection failed:', err)
        this.reconnectAttempts += 1
        this.reconnect() // try again
      } finally {
        this._reconnecting = false
      }
    }, backoff)
  }
}

TradovateSocket.prototype.getDebugStats = function () {
  const ws = this.ws
  return {
    pid: process.pid,
    connId: this._connId,
    wsState: ws ? ws.readyState : null,
    messageListeners: ws && typeof ws.listenerCount === 'function' ? ws.listenerCount('message') : null,
    syncAttachCount: this._syncAttachCount,
    reconnectCalls: this._reconnectCalls,
    lastReconnectAt: this._lastReconnectAt,
  }
}

module.exports = { TradovateSocket }
