/**
 * The DataBuffer tracks and transforms incoming tick data based on the `transformer` provided. If no transformer
 * is provided, keeps raw data.
 * @param {*} param0 
 */
 function DataBuffer(transformer = null, data = []) {
    this.buffer = [...data]
    let lastTs
    this.push = tick => {
        let results
        if(transformer && typeof transformer === 'function') {
            results = transformer(tick)
        } else {
            results = tick
        }

        results = results.sort((a, b) => a.timestamp - b.timestamp)
        
        results.forEach(result => {
            if(this.buffer.length === 0 || result.timestamp > lastTs) {
                this.buffer.push(result)
                if(this.maxLength && this.buffer.length > this.maxLength) {
                    this.buffer.shift()
                }
                lastTs = result.timestamp
            } else if(result.timestamp === lastTs) {
                this.buffer[this.buffer.length-1] = {...result}
            }
        })

        const minuteBars = transformToMinuteBars(results)

        minuteBars.forEach(result => {
            if(this.buffer.length === 0 || result.timestamp > lastTs) {
                this.buffer.push(result)
                if(this.maxLength && this.buffer.length > this.maxLength) {
                    this.buffer.shift()
                }
                lastTs = result.timestamp
            } else if(result.timestamp === lastTs) {
                this.buffer[this.buffer.length-1] = {...result}
            }
        })
    }

    function transformToMinuteBars(tick) {
        const minuteBars = []
        const minuteGroups = groupTicksByMinute(tick)
        minuteGroups.forEach(group => {
            const open = group[0].price
            const close = group[group.length-1].price
            const high = Math.max(...group.map(tick => tick.price))
            const low = Math.min(...group.map(tick => tick.price))
            const timestamp = new Date(group[0].timestamp)
            const minuteBar = {
                timestamp,
                open,
                close,
                high,
                low,
            }
            minuteBars.push(minuteBar)
        }); console.log('MINUTE BARS', minuteBars)
        return minuteBars
    }

    function groupTicksByMinute(tick) {
        const groups = {}
        tick.forEach(tick => {
            const minuteKey = tick.timestamp.toISOString().substring(0, 16)
            if (!groups[minuteKey]) {
                groups[minuteKey] = []
            }
            groups[minuteKey].push(tick)
        })
        return Object.values(groups)
    }

    this.setMaxLength = max => {
        this.maxLength = max
    }

    this.softPush = item => {
        this.buffer.push(item)
    }

    this.concat = (tick) => {
        this.push(tick)
        return this
    }

    this.slicePeriod = period => period === null ? this.buffer.slice() : this.buffer.slice(this.buffer.length - (period))

    this.getData    = (i = -1) => i > -1 ? this.buffer[i] : this.buffer

    this.forEach    = callback => this.buffer.forEach(callback)

    this.map        = callback => this.buffer.map(callback)

    this.reduce     = (callback, seed) => this.buffer.reduce(callback, seed)

    this.slice      = (start, end) => this.buffer.slice(start, end)

    this.indexOf    = item => this.buffer.indexOf(item)

    this.every      = predicate => this.buffer.every(predicate)

    this.filter     = predicate => this.buffer.filter(predicate)

    this.some       = predicate => this.buffer.some(predicate)

    this.find       = predicate => this.buffer.find(predicate)

    this.last       = (i = 0) => this.buffer[this.buffer.length - (1+i)]
}

Object.defineProperty(DataBuffer.prototype, 'length', {
    get() {
        return this.getData().length
    }
})

/**
 * Transforms the incoming tick stream into usable minute bar data.
 * @param {*} response
 * @returns {Array<{timestamp: Date, open: number, high: number, low: number, close: number, upVolume: number, downVolume: number, upTicks: number, downTicks: number, bidVolume: number, offerVolume: number}>}
 */
const MinuteBarsTransformer = (response) => {
    const {tick} = response
    const minuteBars = []

    if(tick) {
        let currentMinute = null
        let open = null
        let high = null
        let low = null
        let close = null
        let upVolume = 0
        let downVolume = 0
        let upTicks = 0
        let downTicks = 0
        let bidVolume = 0
        let offerVolume = 0

        tick.forEach(tick => {
            const { timestamp, price, volume: tickVolume} = tick
            const minute = new Date(timestamp).getMinutes()

            if (currentMinute === null) {
                currentMinute = minute
                open = price
                high = price
                low = price
                close = price            
            } else if (currentMinute === minute) {
                high = Math.max(high, price)
                low = Math.min(low, price)
                close = price
            } else {
                minuteBars.push({
                    timestamp: new Date(timestamp),
                    open,
                    high,
                    low,
                    close,
                    upVolume,
                    downVolume,
                    upTicks,
                    downTicks,
                    bidVolume,
                    offerVolume,
                })
                currentMinute = minute
                open = price
                high = price
                low = price
                close = price
                upVolume = 0
                downVolume = 0
                upTicks = 0
                downTicks = 0
                bidVolume = 0
                offerVolume = 0
            }
            volume += tickVolume  
        })

        minuteBars.push({
            timestamp: new Date(ticks[ticks.length-1].timestamp),
            open,
            high,
            low,
            close,
            upVolume,
            downVolume,
            upTicks,
            downTicks,
            bidVolume,
            offerVolume,
        })
    }
    return minuteBars
}

/**
 * Transforms the incoming tick stream into usable bar data.
 * @param {*} bar 
 * @returns {Array<{timestamp: Date, open: number, high: number, low: number, close: number, upVolume: number, downVolume: number, upTicks: number, downTicks: number, bidVolume: number, offerVolume: number}>} 
 */
const BarsTransformer = (response) => {
    const {bars} = response
    let results = []
    if(bars) {
        bars.forEach(bar => {
            let result = bar
            results.push(result)
        })
    }
//    console.log(response)
//    console.log('BAR XFORM RESULT')
//    console.log(results)
    return results
}

/**
 * Transforms the incoming tick stream into usable tick data.
 * @param {*} response 
 * @param {*} fields 
 * @returns {Array<{subscriptionId:number, id: number, contractTickSize: number, timestamp: Date, price: number, volume: number, bidPrice: number, bidSize: number, askPrice: number, askSize: number}>}
 */
const TicksTransformer = response => {
    const {id: subId, bp, bt, ts, tks} = response
    let result = []
    if(tks) { 
        tks.forEach(({t, p, s, b, a, bs, as: asks, id}) => {
            result.push({
                subscriptionId: subId,
                id,
                contractTickSize: ts,
                timestamp: new Date(bt + t),
                price: (bp + p) * ts,
                volume: s,
                bidPrice: bs && (bp + b) * ts,
                bidSize: bs,
                askPrice: asks && (bp + a) * ts,
                askSize: asks
            })
        })
    }
    return result
}

module.exports = { DataBuffer, BarsTransformer, TicksTransformer, MinuteBarsTransformer }
