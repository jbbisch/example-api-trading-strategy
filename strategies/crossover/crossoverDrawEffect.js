const calculatePnL = require("../../utils/calculatePnL")
const drawToConsole = require("../../utils/drawToConsole")

const drawEffect = (state, action) => {
    const [event, payload] = action

    if(event === 'crossover/draw') {
        const { props } = payload
        const { contract } = props
        const { product, position, mode, buffer, tlc, realizedPnL, buyDistance, sellDistance } = state
        const { distance, shortSma, longSma, momentum, shortSmaValues,distanceMomentum, distanceValues, momentumPeak, distancePeak, updatedMomentumPeak, updatedDistancePeak } = tlc.state  

        const formatDistanceArray = (distanceArray) => {
            return distanceArray && distanceArray.length > 0 ? distanceArray.map(item => `Pre: ${item.prevDistance !== undefined ? item.prevDistance.toFixed(2) : 'N/A'}, Distance: ${item.distance !== undefined ? item.distance.toFixed(2) : 'N/A'}`).join(', ') : 'No Distance'
        }

        const formattedBuyDistance = formatDistanceArray(buyDistance)
        const formattedSellDistance = formatDistanceArray(sellDistance)

        drawToConsole({
            mode,
            contract: contract.name,      
            netPos: position?.netPos || 0,
            DistanceMomentum: distanceMomentum.toFixed(8),
            'Distance Values': distanceValues.map(value => value.toFixed(2)).join(', '),
            DistancePeak: updatedDistancePeak ? updatedDistancePeak.join(', ') : 'N/A',
            MomentumPeak: updatedMomentumPeak ? updatedMomentumPeak.join(', ') : 'N/A',
            ShortSmaMomentum: momentum.toFixed(8),
            'Short SMA Values': shortSmaValues.map(value => value.toFixed(2)).join(', '),
            LONGsma: longSma.toFixed(2),
            'p&l': position && position.netPos !== 0 && product 
                ? `$${calculatePnL({
                    price: buffer.last()?.price || buffer.last()?.price || 0, 
                    contract,
                    position,
                    product,
                }).toFixed(2)}` 
                : '$0.00',
            realizedPnL: `$${realizedPnL.toFixed(2)}`,
            buyDistance: formattedBuyDistance,
            sellDistance: formattedSellDistance,
        })    
    }

    return action
}

module.exports = { drawEffect }
