/**
 * The DataBuffer tracks and transforms incoming tick data based on the `transformer` provided. If no transformer
 * is provided, keeps raw data.
 * @param {*} param0 
 */
function DataBuffer(transformer = null, data = []) {
    this.buffer = [...data]
    let lastTs
    let lastInterval
    const intervalDuration = 5 * 60 * 1000 // decide minute interval here (replace the current 5)

    this.push = tick => {
        let results
        if(transformer && typeof transformer === 'function') {
            results = transformer(tick)
        } else {
            results = tick
        }
        //console.log('Raw Data Incoming Through DataBuffer:', results)
        results = results.map(result => ({
            ...result,
            timestamp: new Date(result.timestamp)
        
        }))

        results = results.sort((a, b) => a.timestamp - b.timestamp)
        
        results.forEach(result => {
            const currentInterval = Math.floor(result.timestamp / intervalDuration) * intervalDuration
            if (this.buffer.length === 0 || currentInterval !== lastInterval) {
                // Start a new minute bar
                this.buffer.push({
                    timestamp: new Date(currentInterval),
                    open: result.open,
                    high: result.high,
                    low: result.low,
                    close: result.close,
                    volume: result.volume
                    // any other properties
                })
                console.log('New currentInterval Data:', this.buffer[this.buffer.length - 1])
                lastInterval = currentInterval
            } else {
                //Update the current MinureBar
                const currentBar = this.buffer[this.buffer.length - 1]
                currentBar.high = Math.max(currentBar.high, result.high)
                currentBar.low = Math.min(currentBar.low, result.low)
                currentBar.close = result.close
                currentBar.volume += result.volume
                //update any other properties
                //console.log('New currentBar Data:', currentBar)
            }

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
    // console.log('BAR XFORM RESULT')
    // console.log(results)
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
            const timestamp = new Date(bt + t)
            const currentMinute = timestamp.getMinutes()

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

module.exports = { DataBuffer, BarsTransformer, TicksTransformer }
