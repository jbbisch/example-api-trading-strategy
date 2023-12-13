const { LongShortMode } = require("../common/longShortMode")

const onChart = (prevState, {data, props}) => {

    const { mode, buffer, hlv, tlc, } = prevState
    const { contract, orderQuantity } = props
    
    buffer.push(data)        
    const bufferData = buffer.getData()

    const lastHlv = hlv.state
    const lastTlc = tlc.state

    const { variance } = hlv(lastHlv, bufferData)
    const { negativeCrossover, positiveCrossover } = tlc(lastTlc, bufferData)

    const round_s = num => Math.round((num + Number.EPSILON) * 100) / 100

    const longBracket = {
        qty: orderQuantity,
        profitTarget: round_s(variance/1.33),//200 (for tick count)
        stopLoss: round_s(-variance/5),//-80 (for tick count)
        trailingStop: true //false?
    }
      
    const shortBracket = {
        qty: orderQuantity,
        profitTarget: round_s(-variance/1.33),//200 (for tick count)
        stopLoss: round_s(variance/5),//-80 (for tick count)
        trailingStop: true //false?
    }

    const entryVersion = {
        orderQty: orderQuantity,
        orderType: 'Market',
    }
    
    if(mode === LongShortMode.Watch && negativeCrossover) {
        return {
            state: {
                ...prevState,
                mode: LongShortMode.Short,
            },
            effects: [
                //liquidates any existing position
                //{
                    //url: 'order/liquidatePosition',
                    //data: {
                        //accountId: parseInt(process.env.ID, 10),
                        //contractId: contract.id,
                        //admin: true
                    //}
                //},
                {
                    url: 'orderStrategy/startOrderStrategy',
                    data: {
                        contract,
                        action: 'Sell',
                        brackets: [shortBracket],
                        entryVersion,
                    }
                },
                { event: 'crossover/draw' }
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
                //liquidates any existing position
                //{
                    //url: 'order/liquidatePosition',
                    //data: {
                        //accountId: parseInt(process.env.ID, 10),
                        //contractId: contract.id,
                        //admin: true
                    //}
                //},
                {
                    url: 'orderStrategy/startOrderStrategy',
                    data: {
                        contract,
                        action: 'Buy',
                        brackets: [longBracket],
                        entryVersion
                    }
                },
                { event: 'crossover/draw' }
            ]
        }
    }

    return { state: prevState }
}

module.exports = { onChart }