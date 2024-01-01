const { LongShortMode } = require("../common/longShortMode")

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
                        orderStrategyTypeId: 2,
                        action: "Buy",
                        orderQuantity: orderQuantity,
                        entryVersion: entryVersion,
                        brackets: [longBracket],
                    }   
                },
                
            ]
        }
    }

    if(mode === LongShortMode.Short && positiveCrossover) {
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
                        orderStrategyTypeId: 2,
                        action: "Buy",
                        orderQuantity: orderQuantity,
                        entryVersion: entryVersion,
                        brackets: [longBracket],
                    }
                },
                
            ]
        }
    }//console.log('[onChart] result', prevState)
    return { state: prevState, effects: [] }
}

module.exports = { onChart }
