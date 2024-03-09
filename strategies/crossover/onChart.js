const { LongShortMode } = require("../common/longShortMode")
const { placeOrder } = require("../../endpoints/placeOrder")
console.log('[onChart] placeOrder:', placeOrder)

const onChart = async (prevState, {data, props}) => {
    const { mode, buffer, hlv, tlc, } = prevState
    const { contract, orderQuantity } = props
    console.log('[onChart] mode deconstructed:', mode)

    buffer.push(data)        
    const bufferData = buffer.getData()
    
    //const lastHlv = hlv.state
    const lastTlc = tlc.state
    //console.log('[onChart] Last TLC:', lastTlc)

    //const { variance } = hlv(lastHlv, bufferData)
    const { negativeCrossover, positiveCrossover } = tlc(lastTlc, bufferData)

    const round_s = num => Math.round((num + Number.EPSILON) * 100) / 100

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
        try {
            const response = await placeOrder({
                accountId: parseInt(process.env.ID),
                contractId: contract.id,
                admin: true,
                accountSpec: process.env.SPEC,
                deviceId: process.env.DEVICE_ID,
                symbol: contract.name,
                action: "Sell",
                orderQty: orderQuantity,
                orderType: "Market"
            })
            console.log('[onChart] response 1:', response)
        } catch (err) {
            console.error('[onChart] Error in placeOrder (IF block line 56) FUNCTION CALL:', err)
            throw err
        }
        return {
            state: {
                ...prevState,
                mode: LongShortMode.Short,
            },
            effects: [
        //            try {
        //                const response = await placeOrder({
        //                    action: 'Sell',
        //                    symbol: contract.id,
        //                    orderQty: orderQuantity,
        //                    orderType: 'Market',
        //                })
        //                console.log('[onChart] response:', response)
        //            } catch (err) {
        //                console.error('[onChart] Error in placeOrder FUNCTION CALL:', err)
        //            }
                // Liquidates any existing position
                //{
                //    url: 'order/liquidatePosition', 
                //    data: {
                //        accountId: parseInt(process.env.ID),
                //        contractId: contract.id,
                //        admin: true,
                //        accountSpec: process.env.SPEC,
                //        deviceId: process.env.DEVICE_ID,
                //        symbol: contract.name,
                //        action: "Sell",
                //        orderQuantity: orderQuantity,
                //    }   
                //},
                { event: 'crossover/draw' },
                //{    
                //    url: 'orderStrategy/startOrderStrategy',
                //    data: {
                //        contract,
                //        action: 'Sell',
                //        brackets: [shortBracket],
                //        entryVersion,
                //    }
                //},
                    
            ]
        }
    }
 
    if(mode === LongShortMode.Long && negativeCrossover) {
        console.log('[onChart] placeOrder 2:', placeOrder)
        console.log('[onChart] mode 2:', mode)
        try {
            const response = await placeOrder({
                accountId: parseInt(process.env.ID),
                contractId: contract.id,
                admin: true,
                accountSpec: process.env.SPEC,
                deviceId: process.env.DEVICE_ID,
                symbol: contract.name,
                action: "Sell",
                orderQty: orderQuantity,
                orderType: "Market"
            })
            console.log('[onChart] response 2:', response)
        } catch (err) {
            console.error('[onChart] Error in placeOrder (IF block line 120) FUNCTION CALL:', err)
            throw err
        }
        return {
            state: {
                ...prevState,
                mode: LongShortMode.Short,
            },
            effects: [
        //            try {
        //                const response = await placeOrder({
        //                    action: 'Sell',
        //                    symbol: contract.id,
        //                    orderQty: orderQuantity,
        //                    orderType: 'Market',
        //                })
        //                console.log('[onChart] response:', response)
        //            } catch (err) {
        //                console.error('[onChart] Error in placeOrder FUNCTION CALL:', err)
        //            }    
                // Liquidates any existing position
                //{
                //    url: 'order/liquidatePosition',
                //    data: {
                //        accountId: parseInt(process.env.ID),
                //        contractId: contract.id,
                //        admin: true,
                //        accountSpec: process.env.SPEC,
                //        deviceId: process.env.DEVICE_ID,
                //        symbol: contract.name,
                //        action: "Sell",
                //        orderQuantity: orderQuantity,
                //    }
                //},
                { event: 'crossover/draw' },
                //{
                //    url: 'orderStrategy/startOrderStrategy',
                //    data: {
                //        contract,
                //        action: 'Sell',
                //        brackets: [shortBracket],
                //        entryVersion,
                //    }
                //},
                    
            ]
        }
    }

    if(mode === LongShortMode.Watch && positiveCrossover) {   
        console.log('[onChart] placeOrder 3:', placeOrder)
        console.log('[onChart] mode 3:', mode)  
        try {
            const response = await placeOrder({
                accountId: parseInt(process.env.ID),
                contractId: contract.id,
                admin: true,
                accountSpec: process.env.SPEC,
                deviceId: process.env.DEVICE_ID,
                symbol: contract.name,
                action: "Buy",
                orderQty: orderQuantity,
                orderType: "Market"
            })
            console.log('[onChart] response 3:', response)
        } catch (err) {
            console.error('[onChart] Error in placeOrder (IF block line 184) FUNCTION CALL:', err)
            throw err
        }   
        return {
            state: {
                ...prevState,
                mode: LongShortMode.Long,
            },
            effects: [
        //            try {
        //                const response = await placeOrder({
        //                    action: 'Buy',
        //                    symbol: contract.id,
        //                    orderQty: orderQuantity,
        //                    orderType: 'Market',
        //                })
        //                console.log('[onChart] response:', response)
        //            } catch (err) {
        //                console.error('[onChart] Error in submitOrder FUNCTION CALL:', err)
        //            }    
                // Liquidates any existing position
                //{
                //    url: 'order/liquidatePosition',
                //    data: {
                //        accountId: parseInt(process.env.ID, 10),
                //        contractId: contract.id,
                //        admin: true
                //    }
                //},
                //{
                //    url: 'orderStrategy/startOrderStrategy',
                //    data: {
                //        accountId: parseInt(process.env.ID),
                //        accountSpec: process.env.SPEC,
                //        symbol: contract.id,
                //        action: "Buy",
                //        orderStrategyTypeId: 2,
                //        entryVersion: JSON.stringify(entryVersion),
                //        brackets: JSON.stringify(longBracket),
                //    }   
                //},
                { event: 'crossover/draw' },    
            ]
        }
    }

    if(mode === LongShortMode.Short && positiveCrossover) {   
        console.log('[onChart] placeOrder 4:', placeOrder)
        console.log('[onChart] mode 4:', mode)
        try {
            const response = await placeOrder({
                accountId: parseInt(process.env.ID),
                contractId: contract.id,
                admin: true,
                accountSpec: process.env.SPEC,
                deviceId: process.env.DEVICE_ID,
                symbol: contract.name,
                action: "Buy",
                orderQty: orderQuantity,
                orderType: "Market"
            })
            console.log('[onChart] response 4:', response)
        } catch (err) {
            console.error('[onChart] Error in placeOrder (IF block line 245) FUNCTION CALL:', err)
            throw err
        }     
        return {
            state: {
                ...prevState,
                mode: LongShortMode.Long,
            },
            effects: [
        //            try {
        //                const response = await placeOrder({
        //                    action: 'Buy',
        //                    symbol: contract.id,
        //                    orderQty: orderQuantity,
        //                    orderType: 'Market',
        //                })
        //                console.log('[onChart] response:', response)
        //            } catch (err) {
        //                console.error('[onChart] Error in placeOrder FUNCTION CALL:', err)
        //            }    
                // Liquidates any existing position
                //{
                //    url: 'order/liquidatePosition',
                //    data: {
                //        accountId: parseInt(process.env.ID, 10),
                //        contractId: contract.id,
                //        admin: true
                //    }
                //},
                //{
                //    url: 'orderStrategy/startOrderStrategy',
                //    data: {
                //        accountId: parseInt(process.env.ID),
                //        accountSpec: process.env.SPEC,
                //        symbol: contract.id,
                //        action: "Buy",
                //        orderStrategyTypeId: 2,
                //        entryVersion: JSON.stringify(entryVersion),
                //        brackets: JSON.stringify(longBracket),
                //    }
                //},
                { event: 'crossover/draw' },
            ]
        }
    }//console.log('[onChart] result', prevState)
    return { state: prevState, effects: [] }
}

module.exports = { onChart }
