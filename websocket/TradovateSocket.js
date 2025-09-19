const WebSocket = require('ws')
const { writeToLog } = require('../utils/helpers')
const { clear } = require('winston')
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
}

TradovateSocket.prototype.getSocket = function() {
    return this.ws
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
  let listener = makeListener();
  this.ws.addEventListener('message', listener);

  const send = () => {
    if (this.ws.readyState === 1) { // WebSocket.OPEN
      this.ws.send(`${url}\n${id}\n${query}\n${JSON.stringify(body)}`);
    }
  };
  send();

  // this function will be used on reconnect to rebind the listener AND resend
  const resubscribe = () => {
    // reattach a fresh listener bound to the NEW ws instance
    listener = makeListener();
    this.ws.addEventListener('message', listener);
    send();
    console.log('[tsRequest] resubscribed:', url);
  };

  const unsubscribe = () => {
    try {
      if (disposer && typeof disposer === 'function') disposer();
      if (listener) this.ws.removeEventListener('message', listener);
    } catch (_) {}
  };

  // keep everything we need to resubscribe later
  this.subscriptions.push({ url, query, body, callback, disposer, resubscribe, unsubscribe, id });

  return unsubscribe;
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
TradovateSocket.prototype.onSync = function(callback) {
    this.ws.addEventListener('message', async msg => {
        const { data } = msg
        const kind = data.slice(0,1)
        switch(kind) {
            case 'a':
                const  parsedData = JSON.parse(msg.data.slice(1))
                // console.log(parsedData)
                let schemaOk = {}
                const schemafields = ['users']
                parsedData.forEach(data => {
                    if (!data.d || typeof data.d !== 'object') 
                        return
                    schemafields.forEach(k => {
                        if(schemaOk && !schemaOk.value) {
                            return
                        }
                        if(Object.keys(data.d).includes(k) && Array.isArray(data.d[k])) {
                            schemaOk = { value: true }
                        } 
                        else {
                            schemaOk = { value: false }
                        }
                    })
                    
                    if(schemaOk.value) {
                        callback(data.d)
                    }
                })
                break
            default:
                break
        }
    })
}
TradovateSocket.prototype.setupHeartbeat = function() {
    const heartbeatInterval = 2500
    clearInterval(this.heartbeatInterval)
    this.heartbeatInterval = setInterval(() => {
        if(this.isConnected()) {
            this.ws.send('[]')
            //console.log('INTERVAL heartbeat sent to server')
        }
    }, heartbeatInterval)
}
/**
 * Modify the connect method to handle connection failures and auto-reconnect.
 */
TradovateSocket.prototype.connect = async function(url) {
    //console.log('connecting to url:', url)
    this.ws = new WebSocket(url)
    this.wsUrl = url
    this.ws.setMaxListeners(24)
    this.counter = new Counter()
    
    let interval

    await new Promise((res, rej) => {
        if(!this.ws) {
            rej('no websocket connection available')
            return
        }
        this.ws.addEventListener('open', () => {
            console.log('[ConnectOpenEvent] Websocket connection opened. Sending auth request...')
            this.ws.send(`authorize\n0\n\n${process.env.ACCESS_TOKEN}`)
            this.reconnectAttempts = 0
            this.setupHeartbeat()
            res()
        })

        this.ws.addEventListener('error', err => {
            console.error('[ConnectErrorEvent] Websocket error: ' + err)
            clearInterval(this.heartbeatInterval)
            this.reconnect()
            this.reconnectAttempts += 1
            rej(err)
        })

        this.ws.addEventListener('close', event => {
            console.warn(`[ConnectCloseEvent] WebSocket closed with code: ${event.code}, reason: ${event.reason}`)
            clearInterval(this.heartbeatInterval) // Clear the heartbeat interval on close
            if(event.code !== 1000) { // Non-normal closure should try to reconnect
                console.log('(onClose) Attempting to reconnect...')
                this.reconnect()
                this.reconnectAttempts += 1
            }
            res()
        })

        this.ws.addEventListener('message', async msg => {
            //console.log('[ConnectMessageEvent] Message received:', msg.data)
            const { type, data } = msg

            const kind = data.slice(0,1)
            if(type !== 'message') {
                console.log('non-message type received')
                return
            }

            //message discriminator
            switch(kind) {
                case 'o':      
                    // console.log('Making WS auth request...')
                    const token = this.constructor.name === 'TradovateSocket' ? process.env.ACCESS_TOKEN : process.env.MD_ACCESS_TOKEN
                    this.ws.send(`authorize\n0\n\n${token}`)          
                    interval = setInterval(() => {
                        if(this.ws.readyState == 0 || this.ws.readyState == 3 || this.ws.readyState == 2) {
                            clearInterval(interval)
                            return
                        }
                        this.ws.send('[]')
                    }, 2500)
                    break
                case 'h':
                    this.setupHeartbeat()
                    res()
                    break
                case 'a':
                    const parsedData = JSON.parse(msg.data.slice(1))

                    const [first] = parsedData
                    if(first.i === 0 && first.s === 200) {
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

TradovateSocket.prototype.disconnect = function() {
    console.log('closing websocket connection')
    this.ws.removeAllListeners('message')
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

    if (!this.isConnected()) {
        const backoff = Math.min(30000, Math.pow(2, this.reconnectAttempts) * 1000);
        console.log(`[TsReconnect] Waiting ${backoff}ms before reconnect attempt...`);

        setTimeout(async () => {
            try {
                console.log('[TsReconnect] Renewing access token...');
                const tokenResult = await renewAccessToken();
                if (!tokenResult) {
                    console.error('[TsReconnect] Token renewal failed.');
                    this.reconnectAttempts += 1;
                    return;
                }
                console.log('[TsReconnect] Token successfully renewed.');

                // Save current buffer before disconnecting
                const oldBuffer = this.strategy?.state?.buffer?.getData() || [];

                // Clean up any existing connection
                if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
                    this.disconnect();
                }

                console.log('[TsReconnect] Reconnecting to:', this.wsUrl);
                await this.connect(this.wsUrl);
                console.log('[TsReconnect] WebSocket reconnected.');

                // Resubscribe to stored subscriptions
                this.subscriptions.forEach(sub => sub.subscription());
                console.log('[TsReconnect] Resubscriptions complete.');

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

                    // Manually trigger next() and drawEffect
                    const last = state.buffer?.last?.() || oldBuffer[oldBuffer.length - 1];
                    if (last) {
                        if (typeof this.strategy.next === 'function') {
                            this.strategy.state = this.strategy.next(state, ['Chart', { data: last, props: strategyProps }]).state;
                            console.log('[TsReconnect] Manually triggered strategy.next()');
                        }

                        if (typeof this.strategy.drawEffect === 'function') {
                            this.strategy.drawEffect(this.strategy.state, ['crossover/draw', { props: strategyProps }]);
                            console.log('[TsReconnect] Manually triggered strategy.drawEffect()');
                        }
                    }
                } else {
                    console.log('[TsReconnect] No strategy to reinitialize.');
                }

                // Resynchronize with server
                this.synchronize(data => {
                    console.log('[TsReconnect] Synchronized with server.');
                    if (typeof this.onSync === 'function') {
                        this.onSync(data);
                        console.log('[TsReconnect] Subscribed to sync events.');
                    }
                });

                this.reconnectAttempts = 0; // success — reset counter
            } catch (err) {
                console.error('[TsReconnect] Reconnection failed:', err);
                this.reconnectAttempts += 1;
                this.reconnect(); // try again
            }
        }, backoff);
    }
}
module.exports = { TradovateSocket }
