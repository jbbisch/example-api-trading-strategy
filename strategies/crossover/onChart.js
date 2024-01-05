const { LongShortMode } = require("../common/longShortMode")
const { startingOrderStrategy } = require("../endpoints/startingOrderStrategy")

const onChart = (prevState, {data, props}) => {
    const { mode, buffer, hlv, tlc, } = prevState
    const { contract, orderQuantity } = props
    //console.log('[onChart] props:', props)

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
        startingOrderStrategy()
        return {
            state: {
                ...prevState,
                mode: LongShortMode.Short,
            },
            effects: [
                // Liquidates any existing position
                {
                    url: 'order/liquidatePosition', 
                    data: {
                        accountId: parseInt(process.env.ID, 10),
                        contractId: contract.id,
                        accountSpec: process.env.SPEC,
                        admin: true,
                        symbol: contract.name,
                        action: "Sell",
                        orderQuantity: orderQuantity,
                    }  
                },
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
        startingOrderStrategy()
        return {
            state: {
                ...prevState,
                mode: LongShortMode.Short,
            },
            effects: [
                // Liquidates any existing position
                {
                    url: 'order/liquidatePosition',
                    data: {
                        accountId: parseInt(process.env.ID, 10),
                        contractId: contract.id,
                        accountSpec: process.env.SPEC,
                        admin: true,
                        symbol: contract.name,
                        action: "Sell",
                        orderQuantity: orderQuantity,
                    }
                },
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
        startingOrderStrategy()
        return {
            state: {
                ...prevState,
                mode: LongShortMode.Long,
            },
            effects: [
                // Liquidates any existing position
                //{
                //    url: 'order/liquidatePosition',
                //    data: {
                //        accountId: parseInt(process.env.ID, 10),
                //        contractId: contract.id,
                //        admin: true
                //    }
                //},
                {
                    url: 'orderStrategy/startOrderStrategy',
                    data: {
                        accountId: parseInt(process.env.ID, 10),
                        accountSpec: process.env.SPEC,
                        symbol: contract.name,
                        action: "Buy",
                        orderStrategyTypeId: 2,
                        entryVersion: JSON.stringify(entryVersion),
                        brackets: JSON.stringify([longBracket]),
                    }   
                },
                { event: 'crossover/draw' },
                
            ]
        }
    }

    if(mode === LongShortMode.Short && positiveCrossover) {
        startingOrderStrategy()
        return {
            state: {
                ...prevState,
                mode: LongShortMode.Long,
            },
            effects: [
                // Liquidates any existing position
                //{
                //    url: 'order/liquidatePosition',
                //    data: {
                //        accountId: parseInt(process.env.ID, 10),
                //        contractId: contract.id,
                //        admin: true
                //    }
                //},
                {
                    url: 'orderStrategy/startOrderStrategy',
                    data: {
                        accountId: parseInt(process.env.ID, 10),
                        accountSpec: process.env.SPEC,
                        symbol: contract.name,
                        action: "Buy",
                        orderStrategyTypeId: 2,
                        entryVersion: JSON.stringify(entryVersion, null, 2),
                        brackets: JSON.stringify([longBracket], null, 2),
                    }
                },
                { event: 'crossover/draw' },
                
            ]
        }
    }//console.log('[onChart] result', prevState)
    return { state: prevState, effects: [] }
}

module.exports = { onChart }