const { LongShortMode } = require("../common/longShortMode")
const { placeOrder } = require("../../endpoints/placeOrder")
const { liquidatePosition } = require("../../endpoints/liquidatePosition")
console.log('[onChart] placeOrder:', placeOrder)

const maxPosition = 1 // 1 contract

const onChart = (prevState, {data, props}) => {
    
    const { mode, buffer, tlc, position } = prevState
    const { contract, orderQuantity } = props

    buffer.push(data)        
    const bufferData = buffer.getData()

    const now = new Date()
    
    // Update SMA only at specific intervals
    const dataPause = 1 * 60 * 1000 // 1 minute pause after processing data
    if (prevState.lastSMAUpdate && now - prevState.lastSMAUpdate < dataPause) {
        console.log('[onChart] Waiting for next SMA update interval', prevState.lastSMAUpdate);
        return { state: prevState, effects: [] };
    }

    const chillOut = 4 * 60 * 1000 // 4 minutes pause after placing an order
    if (prevState.lastTradeTime && now - prevState.lastTradeTime < chillOut) {
        console.log('[OnChart] Chill out time')
        return { state: prevState, effects: [] }
    }

    const minutes = now.getMinutes()
    const seconds = now.getSeconds()

    if(minutes % 5 !== 0 || seconds > 10 ) { 
        console.log('[onChart] Not a 5 minute interval - skip processing')
        return { state: prevState, effects: [] }
    } // 10 second window on every 5th minute interval to update SMA and place order
      // allows for delay in data feed and tries to avoid false signals
        
    const lastTlc = tlc.state
    prevState.lastSMAUpdate = Date.now()
    const { negativeCrossover, positiveCrossover, distance } = tlc(lastTlc, bufferData)

    const longBracket = {
        qty: orderQuantity,
        profitTarget: 200, //round_s(variance/1.33), // 200 (for tick count)
        stopLoss: -80, //round_s(-variance/5), //-80 (for tick count) 
        trailingStop: false //true //false?
    }
      
    const shortBracket = {
        qty: orderQuantity,
        profitTarget: 100, //round_s(-variance/1.33), // 200 (for tick count)
        stopLoss: -40, //round_s(variance/5), //-80 (for tick count)
        trailingStop: false //true //false?
    }

    const entryVersion = {
        orderQty: orderQuantity,
        orderType: "Market",
    }
    
    const currentPositionSize = prevState.position?.netPos || 0

    // USE DURING BEAR MARKET INSTEAD OF WATCH AND LONG ##########
    // if(mode === LongShortMode.Watch && negativeCrossover ) {
    //    if(currentPositionSize === 0) {
        //     console.log('[onChart] liquidatePosition 1:', placeOrder)
        //     console.log('[onChart] mode 1 placeOrder:', mode)
        //     prevState.lastTradeTime = Date.now()
        //     placeOrder({
        //         accountId: parseInt(process.env.ID),
        //         contractId: contract.id,
        //         admin: true,
        //         accountSpec: process.env.SPEC,
        //         deviceId: process.env.DEVICE_ID,
        //         symbol: contract.name,
        //         action: "Sell",
        //         orderQty: 1,
        //         orderType: "Market"
        //     }).then(response => {
        //         console.log('[onChart] response 1:', response)
        //         return {
        //             state: {
        //                 ...prevState,
        //                 mode: LongShortMode.Short,
        //             },
        //             effects: [
        //                  FOR WEBSOCKET Liquidates any existing position
        //                 {
        //                     url: 'order/liquidatePosition', 
        //                     data: {
        //                         accountId: parseInt(process.env.ID),
        //                         contractId: contract.id,
        //                         admin: true,
        //                         accountSpec: process.env.SPEC,
        //                         deviceId: process.env.DEVICE_ID,
        //                         symbol: contract.name,
        //                         action: "Sell",
        //                         orderQuantity: orderQuantity,
        //                     }   
        //                 },
        //                 { event: 'crossover/draw' },
        //             ],
        //         }
        //     }).catch(err => {
        //         console.error('[onChart] Error:', err)
        //     })
        // } else {
        //    console.log('[onChart] short position already exists')
        //    return { state: prevState, effects: [] }
        // }
    // }

    // USE DURING BEAR MARKET INSTEAD OF WATCH AND LONG ##########    
    // if(mode === LongShortMode.Short && positiveCrossover ) { 
        //    if(currentPositionSize < 0) {
        //     console.log('[onChart] placeOrder 4:', placeOrder)
        //     console.log('[onChart] mode 4 buyOrder:', mode)
        //     prevState.lastTradeTime = Date.now()
        //     placeOrder({
        //         accountId: parseInt(process.env.ID),
        //         contractId: contract.id,
        //         admin: true,
        //         accountSpec: process.env.SPEC,
        //         deviceId: process.env.DEVICE_ID,
        //         symbol: contract.name,
        //         action: "Buy",
        //         orderQty: 1,
        //         orderType: "Market"
        //     }).then(response => {
        //         console.log('[onChart] response 4:', response)
        //         return {
        //             state: {
        //                 ...prevState,
        //                 mode: LongShortMode.Long,
        //             },
        //             effects: [
        //                     FOR WEBSOCKET
        //                 {
        //                     url: 'orderStrategy/startOrderStrategy',
        //                     data: {
        //                         accountId: parseInt(process.env.ID),
        //                         accountSpec: process.env.SPEC,
        //                         symbol: contract.id,
        //                         action: "Buy",
        //                         orderStrategyTypeId: 2,
        //                         entryVersion: JSON.stringify(entryVersion),
        //                         brackets: JSON.stringify(longBracket),
        //                     }
        //                 },
        //                 { event: 'crossover/draw' },
        //             ],
        //         }
        //     }).catch(err => {
        //         console.error('[onChart] Error:', err)
        //     })
        // } else {
        //    console.log('[onChart] no short position to liquidate')
        //    return { state: prevState, effects: [] }
        // }    
    // }

    // USE DURING BULL MARKET INSTEAD OF WATCH AND SHORT ##########
    if(mode === LongShortMode.Long && negativeCrossover ) {
        if(currentPositionSize >= maxPosition) {
            console.log('[onChart] liquidatePosition 2:', placeOrder)
            console.log('[onChart] mode 2 placeOrder:', mode)
            prevState.lastTradeTime = Date.now()
            placeOrder({
                accountId: parseInt(process.env.ID),
                contractId: contract.id,
                admin: true,
                accountSpec: process.env.SPEC,
                deviceId: process.env.DEVICE_ID,
                symbol: contract.name,
                action: "Sell",
                orderQty: 1,
                orderType: "Market"
            }).then(response => {
                console.log('[onChart] response 2:', response)
                return {
                    state: {
                        ...prevState,
                        mode: LongShortMode.Short,
                    },
                    effects: [
                        // FOR WEBSOCKET Liquidates any existing position
                        // {
                        //     url: 'order/liquidatePosition',
                        //     data: {
                        //         accountId: parseInt(process.env.ID),
                        //         contractId: contract.id,
                        //         admin: true,
                        //         accountSpec: process.env.SPEC,
                        //         deviceId: process.env.DEVICE_ID,
                        //         symbol: contract.name,
                        //         action: "Sell",
                        //         orderQuantity: orderQuantity,
                        //     }
                        // },
                        { event: 'crossover/draw' },
                    ],
                }
            }).catch(err => {
                console.error('[onChart] Error:', err)
            })
        } else {
            console.log('[onChart] no position to liquidate')
            return { state: prevState, effects: [] }
        }
    }

    // USE DURING BULL MARKET INSTEAD OF WATCH AND SHORT ##########
    if(mode === LongShortMode.Watch && positiveCrossover ) {
        if(currentPositionSize < maxPosition) { 
            console.log('[onChart] placeOrder 3:', placeOrder)
            console.log('[onChart] mode 3 buyOrder:', mode)  
            prevState.lastTradeTime = Date.now()
            placeOrder({
                accountId: parseInt(process.env.ID),
                contractId: contract.id,
                admin: true,
                accountSpec: process.env.SPEC,
                deviceId: process.env.DEVICE_ID,
                symbol: contract.name,
                action: "Buy",
                orderQty: 1,
                orderType: "Market"
            }).then(response => {
                console.log('[onChart] response 3:', response)
                return {
                    state: {
                        ...prevState,
                        mode: LongShortMode.Long,
                    },
                    effects: [
                        // FOR WEBSOCKET
                        // {
                        //     url: 'orderStrategy/startOrderStrategy',
                        //     data: {
                        //         accountId: parseInt(process.env.ID),
                        //         accountSpec: process.env.SPEC,
                        //         symbol: contract.id,
                        //         action: "Buy",
                        //         orderStrategyTypeId: 2,
                        //         entryVersion: JSON.stringify(entryVersion),
                        //         brackets: JSON.stringify(longBracket),
                        //     }   
                        // },
                        { event: 'crossover/draw' },
                    ],
                }
            }).catch(err => {
                console.error('[onChart] Error:', err)
            })
        } else {
            console.log('[onChart] max position reached')
            return { state: prevState, effects: [] }
        }
    }
    return { state: prevState, effects: [] }
}

module.exports = { onChart }
