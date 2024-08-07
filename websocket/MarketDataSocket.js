const { renewAccessToken } = require('../endpoints/renewAccessToken')
const { BarsTransformer } = require('../utils/dataBuffer')
const { TicksTransformer } = require('../utils/dataBuffer')
const { TradovateSocket } = require('./TradovateSocket')

/**
 * Constructor for the MarketData Socket.
 */
function MarketDataSocket() {
    TradovateSocket.call(this)
    this.subscriptions = []    
}

//MarketDataSocket extends TradovateSocket, clone its prototype using Object.assign
MarketDataSocket.prototype = Object.assign({}, TradovateSocket.prototype)


MarketDataSocket.prototype.unsubscribe = function(symbol) {
    this.subscriptions
        .filter(sub => sub.symbol === symbol)
        .forEach(({ subscription }, i) => {
            console.log(`Closing subscription to ${symbol}.`)
            this.subscriptions.splice(this.subscriptions.indexOf(this.subscriptions[i]), 1)
            subscription()
        })    
}

MarketDataSocket.prototype.subscribeQuote = function({symbol, contractId: cid, callback}) {

    const isQuote = data => data.e && data.e === 'md' && data.d && data.d.quotes

    const subscription = this.request({
        url: 'md/subscribeQuote',
        body: { symbol },
        callback: (id, item) => {
            if(!isQuote(item)) return

            item.d.quotes
                .filter(({contractId}) => contractId === cid)
                .forEach(callback)
                //console.log(`Received data for symbol: ${symbol}`, item.d)

        },
        disposer: () => {
            let d = this.request({
                url: 'md/unsubscribeQuote',
                body: {
                    symbol
                },
                callback: () => d()
            })
        },
    })

    this.subscriptions.push({ symbol, subscription })
    return subscription
}

MarketDataSocket.prototype.subscribeDOM = function({symbol, contractId: cid, callback}) {
    const isDom = data => data.e && data.e === 'md' && data.d && data.d.doms

    const subscription = this.request({
        url:  'md/subscribeDOM',
        body: { symbol },
        callback: (id, item) => {            

            if(!isDom(item)) return
        
            item.d.doms
                .filter(({contractId}) => contractId === cid)
                .forEach(callback)         
        },
        disposer: () => {
            let d = this.request({
                url: 'md/unsubscribeDOM',
                body: {
                    symbol
                },
                callback: () => {
                    d()
                }
            })
        },
    })
    
    this.subscriptions.push({ symbol, subscription })

    return subscription
        
}

MarketDataSocket.prototype.subscribeHistogram = function({symbol, contractId: cid, callback}) {
    const isHistogram = data => data.e && data.e === 'md' && data.d && data.d.histograms

    const subscription = this.request({
        url:  'md/subscribeHistogram',
        body: { symbol },
        callback: (id, item) => {            

            if(!isHistogram(item)) return
        
            item.d.histograms
                .filter(({contractId}) => contractId === cid )
                .forEach(callback)          
        },
        disposer: () => {
            let d = this.request({
                url: 'md/unsubscribeHistogram',
                body: {
                    symbol
                },
                callback: d
            })
        },
    })
    
    this.subscriptions.push({ symbol, subscription })

    return subscription
}


MarketDataSocket.prototype.getChart = function({symbol, chartDescription, timeRange, callback}) {
    const isChart = data => data.e && data.e === 'chart'

    let realtimeId, historicalId
    
    const subscription = this.request({
        url: 'md/getChart',
        body: {
            symbol,
            chartDescription: {
                underlyingType: 'MinuteBar',
                elementSize: chartDescription.elementSize,
                elementSizeUnit: chartDescription.elementSizeUnit,
                withHistograms: chartDescription.withHistograms,
            },
            timeRange
        },
        callback: (id, item) => {

            if(item.i === id) {
                realtimeId = item.d.realtimeId
                historicalId = item.d.historicalId
            }
            
            if(!isChart(item)) return

            item.d.charts
                .filter(({id}) => id === realtimeId || id === historicalId)
                .forEach(callback)            
        },
        disposer: () => {
            let d = this.request({
                url: 'md/cancelChart',
                body: {
                    subscriptionId: historicalId
                },
                callback: () => d()
            })
        }
    })
    this.subscriptions.push({symbol, subscription})
    
    return subscription
}

MarketDataSocket.prototype.disconnect = function() {
    this.subscriptions.forEach(({subscription}) => subscription())
    this.subscriptions = []
    TradovateSocket.prototype.disconnect.call(this)
}

module.exports = { MarketDataSocket } 
