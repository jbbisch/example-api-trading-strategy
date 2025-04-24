const calculatePnL = require("../../utils/calculatePnL")
const drawToConsole = require("../../utils/drawToConsole")

const drawEffect = (state, action) => {
    const [event, payload] = action

    if(event === 'crossover/draw') {
        const { props } = payload
        const { contract } = props
        const { product, position, mode, buffer, tlc, realizedPnL, buyDistance, sellDistance, buyTriggerSource, sellTriggerSource,} = state
        const { distance, shortSma, longSma, momentum, momentumDifferences, shortSmaValues,distanceMomentum, distanceValues, momentumPeak, distancePeak, updatedMomentumPeak, updatedDistancePeak, triggerSource, slowingMomentum, momentumDifference, slowingMomentumNegativeCrossoverCount} = tlc.state  

        const formatDistanceArray = (distanceArray) => {
            return distanceArray && distanceArray.length > 0 ? distanceArray.map(item => `Pre: ${item.prevDistance !== undefined ? item.prevDistance.toFixed(2) : 'N/A'}, Distance: ${item.distance !== undefined ? item.distance.toFixed(2) : 'N/A'}`).join(', ') : 'No Distance'
        }

        const formattedBuyDistance = formatDistanceArray(buyDistance)
        const formattedSellDistance = formatDistanceArray(sellDistance)

        const formattedBuyTriggers = (buyTriggerSourceArray) => {
            return buyTriggerSourceArray && buyTriggerSourceArray.length > 0 ? buyTriggerSourceArray.join(', ') : 'No Triggers'
        }
        const formattedSellTriggers = (sellTriggerSourceArray) => {
            return sellTriggerSourceArray && sellTriggerSourceArray.length > 0 ? sellTriggerSourceArray.join(', ') : 'No Triggers'
        }

        const buyTriggers = formattedBuyTriggers(buyTriggerSource)
        const sellTriggers = formattedSellTriggers(sellTriggerSource)

        drawToConsole({
            mode,
            contract: contract.name,      
            netPos: position?.netPos || 0,
            realizedPnL: `$${realizedPnL.toFixed(2)}`,
            DistanceMomentum: distanceMomentum.toFixed(8),
            'Distance Values': distanceValues.map(value => value.toFixed(2)).join(', '),
            DistancePeak: updatedDistancePeak ? updatedDistancePeak.join(', ') : 'N/A',
            MomentumPeak: updatedMomentumPeak ? updatedMomentumPeak.join(', ') : 'N/A',
            ShortSmaMomentum: momentum.toFixed(8),
            'Short SMA Values': shortSmaValues.map(value => value.toFixed(2)).join(', '),
            LONGsma: longSma.toFixed(2),
            slowingMomentum: slowingMomentum.join(', '),
            momentumDifference: momentumDifference.toFixed(8),
            'Momentum Differences': momentumDifferences.map(value => value.toFixed(8)).join(', '),
            // 'p&l': position && position.netPos !== 0 && product 
            //     ? `$${calculatePnL({
            //         price: buffer.last()?.price || buffer.last()?.price || 0, 
            //         contract,
            //         position,
            //         product,
            //     }).toFixed(2)}` 
            //     : '$0.00',
            buyTriggerSource: buyTriggers,
            buyDistance: formattedBuyDistance,
            SLMncCount: slowingMomentumNegativeCrossoverCount,
            sellTriggerSource: sellTriggers,
            sellDistance: formattedSellDistance,
        })    
    }

    return action
}

module.exports = { drawEffect }
