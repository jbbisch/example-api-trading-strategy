const { LongShortMode } = require("../common/longShortMode")
const { placeOrder } = require("../../endpoints/placeOrder")
console.log('[onChart] placeOrder:', placeOrder)

const onChart = (prevState, {data, props}) => {
    const { mode, buffer, hlv, tlc, } = prevState
    const { contract, orderQuantity } = props

    buffer.push(data)        
    const bufferData = buffer.getData()
    
    //const lastHlv = hlv.state
    const lastTlc = tlc.state

    //const { variance } = hlv(lastHlv, bufferData)
    const { negativeCrossover, positiveCrossover } = tlc(lastTlc, bufferData)

    //const round_s = num => Math.round((num + Number.EPSILON) * 100) / 100

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
    
    if(mode === LongShortMode.Watch && negativeCrossover) {
        console.log('[onChart] placeOrder 1:', placeOrder)
        console.log('[onChart] mode 1:', mode)
        placeOrder({
            accountId: parseInt(process.env.ID),
            contractId: contract.id,
            admin: true,
            accountSpec: process.env.SPEC,
            deviceId: process.env.DEVICE_ID,
            symbol: contract.name,
            action: "Sell",
            orderQty: 6,
            orderType: "Market"
        }).then(response => {
            console.log('[onChart] response 1:', response)
            return {
                state: {
                    ...prevState,
                    mode: LongShortMode.Short,
                },
                effects: [
                    // FOR WEBSOCKET Liquidates any existing position
//                    {
//                        url: 'order/liquidatePosition', 
//                        data: {
//                            accountId: parseInt(process.env.ID),
//                            contractId: contract.id,
//                            admin: true,
//                            accountSpec: process.env.SPEC,
//                            deviceId: process.env.DEVICE_ID,
//                            symbol: contract.name,
//                            action: "Sell",
//                            orderQuantity: orderQuantity,
//                        }   
//                    },
                    { event: 'crossover/draw' },                   
                ]
            },
            console.log('[onChart] mode after placeOrder 1:', mode)
        }).catch(err => {
            console.error('[onChart] Error:', err)
        })
    }
 
    if(mode === LongShortMode.Long && negativeCrossover) {
        console.log('[onChart] placeOrder 2:', placeOrder)
        console.log('[onChart] mode 2:', mode)
        placeOrder({
            accountId: parseInt(process.env.ID),
            contractId: contract.id,
            admin: true,
            accountSpec: process.env.SPEC,
            deviceId: process.env.DEVICE_ID,
            symbol: contract.name,
            action: "Sell",
            orderQty: 6,
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
//                    {
//                        url: 'order/liquidatePosition',
//                        data: {
//                            accountId: parseInt(process.env.ID),
//                            contractId: contract.id,
//                            admin: true,
//                            accountSpec: process.env.SPEC,
//                            deviceId: process.env.DEVICE_ID,
//                            symbol: contract.name,
//                            action: "Sell",
//                            orderQuantity: orderQuantity,
//                        }
//                    },
                    { event: 'crossover/draw' },      
                ]
            },
            console.log('[onChart] mode after placeOrder 2:', mode)
        }).catch(err => {
            console.error('[onChart] Error:', err)
        })
    }

    if(mode === LongShortMode.Watch && positiveCrossover) {   
        console.log('[onChart] placeOrder 3:', placeOrder)
        console.log('[onChart] mode 3:', mode)  
        placeOrder({
            accountId: parseInt(process.env.ID),
            contractId: contract.id,
            admin: true,
            accountSpec: process.env.SPEC,
            deviceId: process.env.DEVICE_ID,
            symbol: contract.name,
            action: "Buy",
            orderQty: 6,
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
//                    {
//                        url: 'orderStrategy/startOrderStrategy',
//                        data: {
//                            accountId: parseInt(process.env.ID),
//                            accountSpec: process.env.SPEC,
//                            symbol: contract.id,
//                            action: "Buy",
//                            orderStrategyTypeId: 2,
//                            entryVersion: JSON.stringify(entryVersion),
//                            brackets: JSON.stringify(longBracket),
//                        }   
//                    },
                    { event: 'crossover/draw' },    
                ]
            },
            console.log('[onChart] mode after placeOrder 3:', mode)
        }).catch(err => {
            console.error('[onChart] Error:', err)
        })
    }

    if(mode === LongShortMode.Short && positiveCrossover) {   
        console.log('[onChart] placeOrder 4:', placeOrder)
        console.log('[onChart] mode 4:', mode)
        placeOrder({
            accountId: parseInt(process.env.ID),
            contractId: contract.id,
            admin: true,
            accountSpec: process.env.SPEC,
            deviceId: process.env.DEVICE_ID,
            symbol: contract.name,
            action: "Buy",
            orderQty: 6,
            orderType: "Market"
        }).then(response => {
            console.log('[onChart] response 4:', response)
            return {
                state: {
                    ...prevState,
                    mode: LongShortMode.Long,
                },
                effects: [
                    // FOR WEBSOCKET
//                    {
//                        url: 'orderStrategy/startOrderStrategy',
//                        data: {
//                            accountId: parseInt(process.env.ID),
//                            accountSpec: process.env.SPEC,
//                            symbol: contract.id,
//                            action: "Buy",
//                            orderStrategyTypeId: 2,
//                            entryVersion: JSON.stringify(entryVersion),
//                            brackets: JSON.stringify(longBracket),
//                        }
//                    },
                    { event: 'crossover/draw' },
                ]
            },
            console.log('[onChart] mode after placeOrder 4:', mode)
        }).catch(err => {
            console.error('[onChart] Error:', err)
        })
    }
    return { state: prevState, effects: [] }
}

module.exports = { onChart }
