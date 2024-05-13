const WebSocket = require('ws')
const { writeToLog } = require('../utils/helpers')
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
    this.ws.send(`${url}\n${id}\n${query}\n${JSON.stringify(body)}`)

    return () => {
        if(disposer && typeof disposer === 'function'){
            disposer()
        }
        this.ws.removeListener('message', resSubscription)
    }
}

TradovateSocket.prototype.synchronize = function(callback) {
    if(!this.ws || this.ws.readyState == 3 || this.ws.readyState == 2) {
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

    this.ws = new WebSocket(url)
    this.ws.setMaxListeners(24)
    this.counter = new Counter()
    
    let interval

    await new Promise((res, rej) => {
        if(!this.ws) {
            rej('no websocket connection available')
            return
        }
        this.ws.addEventListener('open', () => {
            console.log('Websocket connection opened. Sending auth request...')
            this.ws.send(`authorize\n0\n\n${process.env.ACCESS_TOKEN}`)
            const interval = setInterval(() => {
                if(this.ws.readyState === WebSocket.OPEN) {
                this.ws.send('[]')
                //console.log('heartbeat sent to server on OPEN')
                } else {
                    console.warn('Websocket is not open. Not sending HeartBeat.')
                }
            }, 2500)
            res()
        })

        this.ws.addEventListener('error', err => {
            console.error('Websocket error: ' + err)
            rej(err)
        })

        this.ws.addEventListener('close', event => {
            console.warn('WebSocket closed with code: ${event.code}, reason: ${event.reason}')
            clearInterval(interval) // Clear the heartbeat interval on close
            if(event.code !== 1000) { // Non-normal closure should try to reconnect
                console.log('Attempting to reconnect...')
                this.reconnect()
            }
        })

        this.ws.addEventListener('message', async msg => {
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
                    clearInterval(interval)
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
    return this.ws && this.ws.readyState != 2 && this.ws.readyState != 3
}

/**
 * Attempts to reconnect the WebSocket after an unexpected closure.
 */
TradovateSocket.prototype.reconnect = function() {
    const maxRetries = 5 // Maximum number of retries
    let attemptCount = 0 // Current attempt count
    const initialDelay = 1000 // Initial delay in milliseconds

    const attemptReconnect = () => {
        if (attemptCount >= maxRetries) {
            console.error('Max reconnect attempts reached. Stopping reconnection attempts.')
            return
        }

        // Wait for the exponential backoff delay before reconnecting
        setTimeout(async () => {
            console.log('Attempting to reconnect... Try ' + (attemptCount + 1))
            try {
                await this.connect(this.ws.url) // Re-attempt the connection
                console.log('Reconnection successful.')
            } catch (error) {
                console.error('Reconnection attempt failed:', error.message)
                attemptCount++
                attemptReconnect() // Recursively attempt to reconnect
            }
        }, initialDelay * Math.pow(2, attemptCount)) // Exponential backoff delay
    }
    attemptReconnect()
}

module.exports = { TradovateSocket }
