const calculatePnL = require("../../utils/calculatePnL")
const drawToConsole = require("../../utils/drawToConsole")

const drawEffect = (state, action) => {
    const [event, payload] = action

    if(event === 'crossover/draw') {
        const { props } = payload
        const { contract } = props
        const { product, position, mode, buffer, tlc, realizedPnL } = state
        const { distance, shortSma, longSma, momentum, shortSmaValues } = tlc.state  

        drawToConsole({
            mode,
            contract: contract.name,      
            netPos: position?.netPos || 0,
            Distance: distance.toFixed(2),
            SHORTsma: shortSma.toFixed(2),
            LONGsma: longSma.toFixed(2),
            Momentum: momentum.toFixed(8),
            'Short SMA Values': shortSmaValues.map(value => value.toFixed(2)).join(', '),
            'p&l': position && position.netPos !== 0 && product 
                ? `$${calculatePnL({
                    price: buffer.last()?.price || buffer.last()?.price || 0, 
                    contract,
                    position,
                    product,
                }).toFixed(2)}` 
                : '$0.00',
            realizedPnL: `$${realizedPnL.toFixed(2)}`
        })    
    }

    return action
}

module.exports = { drawEffect }