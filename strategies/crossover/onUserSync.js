const { LongShortMode } = require("../common/longShortMode")

const onUserSync = (prevState, {data, props}) => {

    const { contract } = props
    const { positions, products, cashBalances } = data
    
    let product     = products.find(p => contract.name.startsWith(p.name))
    const position  = positions.find(pos => pos.contractId === contract.id)
    let realizedPnL = cashBalances[0]?.realizedPnL || 0

    const netPos = position?.netPos ?? 0

    return {
        state: {
            ...prevState,
            mode: 
                netPos > 0 ? LongShortMode.Long 
            :   netPos < 0 ? LongShortMode.Short 
            :   /*else*/     LongShortMode.Watch,
            product,
            position,
            realizedPnL,
            strategyNetPos: netPos,
            orderInFlight: prevState.orderInFlight && netPos !== prevState.strategyNetPos ? false : prevState.orderInFlight,
            orderInFlightAt: null
        },
        effects: [{ event: 'crossover/draw' }]
    }
}

module.exports = { onUserSync }
