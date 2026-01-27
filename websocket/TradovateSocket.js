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
    this._reconnectTimer = null
    this._reconnecting = false
}

TradovateSocket.prototype.getSocket = function() {
    return this.ws
}

TradovateSocket.prototype._dbg = function(label, extra = {}) {
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
  const id = this.counter.increment();

  // we keep a reference so we can detach exactly this listener if needed
  const makeListener = () => (msg) => {
    // only array messages
    if (typeof msg?.data !== 'string' || msg.data[0] !== 'a') return;

    let items = [];
    try { items = JSON.parse(msg.data.slice(1)); } catch (_) {}

    for (const item of items) {
      // deliver all items to the consumer
      callback(id, item);
    }
  };

  // initial listener + send
  let wsRef = this.ws

  let listener = makeListener();
  wsRef.addEventListener('message', listener);
  this._dbg('REQUEST_ATTACH', { url, requestId: id })

  const send = () => {
    if (wsRef && wsRef.readyState === WebSocket.OPEN) { // WebSocket.OPEN
      wsRef.send(`${url}\n${id}\n${query}\n${JSON.stringify(body)}`);
    }
  };
  send();

  // this function will be used on reconnect to rebind the listener AND resend
  const resubscribe = () => {
    try {wsRef?.removeEventListener('message', listener)
    } catch (_) {}

    // reattach a fresh listener bound to the NEW ws instance
    wsRef = this.ws
    listener = makeListener();
    wsRef.addEventListener('message', listener);
    this._dbg('REQUEST_RESUB_ATTACH', { url, requestId: id })
    send();
    console.log('[tsRequest] resubscribed:', url);
  };

  const unsubscribe = () => {
    try {
      if (disposer && typeof disposer === 'function') disposer();
      try { wsRef?.removeEventListener('message', listener) } catch (_) {}
    } finally {
      this.subscriptions = this.subscriptions.filter(sub => sub.id !== id);
    };

  // keep everything we need to resubscribe later
  this.subscriptions.push({ url, query, body, callback, disposer, resubscribe, unsubscribe, id });

  return unsubscribe;
  }
}

TradovateSocket.prototype.synchronize = function(callback) {
    if(!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.warn('no websocket connection available, please connect the websocket and try again.')
        return
    }
    return this.request({
        url: 'user/syncrequest',
        body: { accounts: [parseInt(process.env.ID, 10)] },
        callback: (id, data) => { 
            if(data.i === id
            || (data.e && data.e === 'props')
            || (data.e && data.e === 'clock')) {
                callback(data.d)
            }
        }
    })
}

// /**
//  * Set a function to be called when the socket synchronizes.
//  */
TradovateSocket.prototype.onSync = function (callback) {
  this._onSyncCallback = callback

  if (!this._onSyncHandler) {
    this._onSyncHandler = (msg) => {
      const { data } = msg
      if (typeof data !== 'string') return
      if (data[0] !== 'a') return

      let parsed
      try { parsed = JSON.parse(data.slice(1)) } catch (_) { return }
      if (!Array.isArray(parsed)) return

      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue
        const d = item.d

        // 1) Initial sync snapshot typically contains users[]
        if (d && typeof d === 'object' && Array.isArray(d.users)) {
          this._onSyncCallback?.(d)
          continue
        }

        // 2) Real-time user updates come as props (positions, cashBalance, orders, etc.)
        // Position updates contain: d.entityType === 'position' and d.entity.netPos  [oai_citation:1‡Tradovate Forum](https://community.tradovate.com/t/request-rate-limitations-of-orders-positions-and-getting-list-of-positions-list-of-orders-and-etc-in-tradovate-api/3255?utm_source=chatgpt.com)
        if (item.e === 'props' && d && typeof d === 'object') {
          this._onSyncCallback?.(d)
          continue
        }

        // (optional) some clients also forward clock events to the same callback
        if (item.e === 'clock' && d && typeof d === 'object') {
          this._onSyncCallback?.(d)
          continue
        }
      }
    }
  }

  // attach once per socket
  if (this.ws && !this._onSyncAttachedToWs) {
    this._syncAttachCount += 1
    this._dbg('ONSYNC_ATTACH', { syncAttachCount: this._syncAttachCount })
    this.ws.addEventListener('message', this._onSyncHandler)
    this._onSyncAttachedToWs = true
  }
}

TradovateSocket.prototype.setupHeartbeat = function(wsRef) {
    const heartbeatInterval = 2500
    clearInterval(this.heartbeatInterval)
    this.heartbeatInterval = setInterval(() => {
        if(wsRef && wsRef.readyState === WebSocket.OPEN) {
            wsRef.send('[]')
            //console.log('INTERVAL heartbeat sent to server')
        }
    }, heartbeatInterval)
}
/**
 * Modify the connect method to handle connection failures and auto-reconnect.
 */
TradovateSocket.prototype.connect = async function(url) {
    // if already active, don't open a second socket
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        this._dbg('CONNECT_SKIPPED_ALREADY_ACTIVE', { url })
        return
    }
    //console.log('connecting to url:', url)
    this.ws = new WebSocket(url)
    this.wsUrl = url
    this._connId += 1
    const wsRef = this.ws
    this._onSyncAttachedToWs = false
    if (this._onSyncHandler) {
      wsRef.addEventListener('message', this._onSyncHandler)
      this._onSyncAttachedToWs = true
      this._syncAttachCount += 1
      this._dbg('ONSYNC_ATTACH_CONNECT', { syncAttachCount: this._syncAttachCount })
    }
    this._dbg('WS_CREATED', { url })
    wsRef.setMaxListeners(24)
    this.counter = new Counter()
    
    await new Promise((res, rej) => {

        let settled = false
        const resolveOnce = () => {
            if (!settled) {
                settled = true
                res()
            }
        }
        const rejectOnce = (err) => {
            if (!settled) {
                settled = true
                rej(err)
            }
        }

        wsRef.addEventListener('open', () => {
            if (this.ws !== wsRef) return // stale event
            this._dbg('OPEN_EVENT')
            wsRef.send(`authorize\n0\n\n${process.env.ACCESS_TOKEN}`)
            this.reconnectAttempts = 0
            this.setupHeartbeat(wsRef)
        })

        wsRef.addEventListener('error', err => {
            if (this.ws !== wsRef) return // stale event
            console.error('[ConnectErrorEvent] Websocket error: ' + err)
            clearInterval(this.heartbeatInterval)
            this.reconnect()
            this.reconnectAttempts += 1
            rejectOnce(err)
        })

        wsRef.addEventListener('close', event => {
            if (this.ws !== wsRef) return // stale event
            console.warn(`[ConnectCloseEvent] WebSocket closed with code: ${event.code}, reason: ${event.reason}`)
            clearInterval(this.heartbeatInterval) // Clear the heartbeat interval on close
            if(event.code !== 1000) { // Non-normal closure should try to reconnect
                this.reconnect()
                this.reconnectAttempts += 1
            }
            if (settled) return
            rejectOnce(new Error('Socket closed before ready'))
        })

        wsRef.addEventListener('message', async msg => {
            if (this.ws !== wsRef) return // stale event
            const { type, data } = msg
            if (type !== 'message') return

            const kind = data?.slice?.(0, 1)
            // Only debug for handshake-ish tokens (reduces spam)
            if (kind === 'o' || kind === 'h' || kind === 'c') {
                this._dbg('CONNECT_MESSAGE_KIND', { kind })
            }
        
            //message discriminator
            switch(kind) {
                case 'o': {     
                    // console.log('Making WS auth request...')
                    const token = this.constructor.name === 'TradovateSocket' ? process.env.ACCESS_TOKEN : process.env.MD_ACCESS_TOKEN
                    wsRef.send(`authorize\n0\n\n${token}`)
                    break
                }
                case 'h':
                    this.setupHeartbeat(wsRef)
                    break
                case 'a': {
                    const parsedData = JSON.parse(msg.data.slice(1))
                    const [first] = parsedData
                    if(first.i === 0 && first.s === 200) {
                        resolveOnce()
                    } else rejectOnce(new Error('Authorization failed'))
                    break
                }
                case 'c':
                    clearInterval(this.heartbeatInterval)
                    break
                default:
                    console.error('Unexpected response token received:')
                    console.error(msg)
                    break
            }
        })
    })  
}

TradovateSocket.prototype.disconnect = function() {
    console.log('closing websocket connection')
    this._dbg('DISCONNECT_BEFORE_CLOSE')
    this._syncUnsub?.()
    this._syncUnsub = null
    if (this.ws && this._onSyncHandler) {
        try { this.ws.removeEventListener('message', this._onSyncHandler) } catch (_) {}
    }
    this._onSyncAttachedToWs = false
    this.ws.removeAllListeners()
    this.ws.close(1000, `Client initiated disconnect.`)
    this.ws = null
    clearInterval(this.heartbeatInterval)
}

TradovateSocket.prototype.isConnected = function() {
    return this.ws && this.ws.readyState === WebSocket.OPEN
}

/**
 * Attempts to reconnect the WebSocket after an unexpected closure.
 */
TradovateSocket.prototype.reconnect = async function () {
    if (!this.wsUrl) {
        console.error('[TsReconnect] No WebSocket URL available for reconnection.');
        return;
    }
    // Don't allow concurrent reconnect attempts
    if (this._reconnectTimer || this._reconnecting) {
        this._dbg('RECONNECT_SKIPPED_ALREADY_RECONNECTING')
        return;
    }

    const backoff = Math.min(30000, Math.pow(2, this.reconnectAttempts) * 1000);
    this._dbg('RECONNECT_SCHEDULED', { backoff })

    this._reconnectTimer = setTimeout(async () => {
        this._reconnectTimer = null;
        this._reconnecting = true;

        try {
            const tokenResult = await renewAccessToken()
            if (!tokenResult) throw new Error('Token renewal failed.')

            const oldBuffer = this.strategy?.state?.buffer?.getData() || []

            // hard close current socket if any
            try { this.disconnect() } catch (_) {}

            await this.connect(this.wsUrl)

            //resubscribe
            this.subscriptions.forEach(sub => sub?.resubscribe?.())

            // Reinitialize strategy
            if (this.strategy) {
                const strategyProps = this.strategy.props;
                this.strategy = new this.strategy.constructor(strategyProps);

                const state = await this.strategy.init();
                if (oldBuffer.length && state?.buffer) {
                    oldBuffer.forEach(data => state.buffer.softPush(data));
                }
                this.strategy.state = state;
                console.log('[TsReconnect] Strategy reinitialized and buffer restored.');
            }
            
            this.reconnectAttempts = 0; // success — reset counter
            this._dbg('RECONNECT_SUCCESSFUL');
        }   catch (err) {
            console.error('[TsReconnect] Reconnection failed:', err);
            this.reconnectAttempts += 1;
            this._reconnecting = false;
            return this.reconnect(); // try again
        }   finally {
            this._reconnecting = false;
        }
    }, backoff)
}

TradovateSocket.prototype.getDebugStats = function () {
  const ws = this.ws
  return {
    pid: process.pid,
    connId: this._connId,
    wsState: ws ? ws.readyState : null,
    messageListeners:
      ws && typeof ws.listenerCount === 'function'
        ? ws.listenerCount('message')
        : null,
    syncAttachCount: this._syncAttachCount,
  }
}
module.exports = { TradovateSocket }
