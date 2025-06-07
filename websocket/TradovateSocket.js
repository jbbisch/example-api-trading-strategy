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
TradovateSocket.prototype.request = function({url, query, body, callback, disposer}) {
    const id = this.counter.increment()

    const resSubscription = msg => {

        if(msg.data.slice(0, 1) !== 'a') { return }

        let data
        try {
            data = JSON.parse(msg.data.slice(1))
        } catch(err) {
            data = []
            console.log('failed to process message: ' + err)
        }

        if(data.length > 0) {
            data.forEach(item => {
                // console.log(item)
                callback(id, item)
            })
        }
    } 

    this.ws.addEventListener('message', resSubscription)
    if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(`${url}\n${id}\n${query}\n${JSON.stringify(body)}`)
    } 

    const subscription = () => {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(`${url}\n${id}\n${query}\n${JSON.stringify(body)}`)
            console.log('[tsRequest] resubscribing to: ' + url, 'with body:', body)
        }
    }

    this.subscriptions.push({ url, query, body, callback, disposer, subscription })

    return () => {
        if(disposer && typeof disposer === 'function'){
            disposer()
        }
        this.ws.removeListener('message', resSubscription)
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
                    if (typeof this.strategy.init === 'function') {
                        await this.strategy.init();
                        console.log('[TsReconnect] Strategy reinitialized.');
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

                    // Trigger next() manually if we have buffer data
                    if (this.buffer && this.buffer.length && typeof this.strategy?.next === 'function') {
                        const last = this.buffer[this.buffer.length - 1];
                        this.strategy.next(last);
                        console.log('[TsReconnect] Manually triggered strategy.next() with last buffer bar.');
                        if (typeof this.strategy?.drawEffect === 'function') {
                            this.strategy.drawEffect(this.strategy.state, ['crossover/draw', {props: thisstrategy.props}])
                            console.log('[TsReconnect] Manually triggered strategy.drawEffect() with last buffer bar.');
                        }
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
