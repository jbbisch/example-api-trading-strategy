const calculatePnL = require("../../utils/calculatePnL")
const drawToConsole = require("../../utils/drawToConsole")

const drawEffect = (state, action) => {
    const [event, payload] = action

    if(event === 'crossover/draw') {
        const { props } = payload
        const { contract } = props
        const { product, position, mode, buffer, tlc, realizedPnL, buyDistance, sellDistance, buyTriggerSource, sellTriggerSource,} = state
        const { distance, shortSma, SMANegativeCrossoverCount, BouncePositiveCrossoverCount, updatedDistanceValley, AcceleratingAbsoluteGapMomentumCrossoverCount, longSma, distanceOpen, GapMomentumLowCrossover, gapMomentumLowCrossoverCount, absoluteGapMomentum, absoluteGapMomentums, absoluteGapMomentumDifference, absoluteGapMomentumDifferences, slowingAbsoluteGapMomentum, momentum, momentumDifferences, shortSmaValues, distanceMomentum, distanceOpenValues, distanceValues, slowingDistanceMomentum, distanceMomentumDifferences, distanceMomentumDifference, momentumPeak, distancePeak, updatedMomentumPeak, updatedDistancePeak, triggerSource, slowingMomentum, momentumDifference, slowingMomentumNegativeCrossoverCount, slowingDistanceMomentumCrossoverCount, slowingAbsoluteGapMomentumCrossoverCount, momentumPeakNegativeCrossoverCount} = tlc.state  

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
            'Distance on prevClose': distanceValues.map(value => value.toFixed(2)).join(', '),
            'Distance on currentOpen': distanceOpenValues.map(value => value.toFixed(2)).join(', '),
            //AbsoluteGapMomentum: absoluteGapMomentum !== undefined ? absoluteGapMomentum.toFixed(8) : 'N/A',
            AbsoluteGapMomentums: (absoluteGapMomentums || []).map(v => v.toFixed(8)).join(', '),
            //AbsoluteGapMomentumDifference: absoluteGapMomentumDifference !== undefined ? absoluteGapMomentumDifference.toFixed(8) : 'N/A',
            AbsoluteGapMomentumDifferences: (absoluteGapMomentumDifferences || []).map(v => v.toFixed(8)).join(', '),
            slowingAbsoluteGapMomentum: (slowingAbsoluteGapMomentum || []).join(', '),
            //DistanceMomentum: distanceMomentum.toFixed(8),
            //slowingDistanceMomentum: slowingDistanceMomentum.join(', '),
            //distanceMomentumDifference: distanceMomentumDifference.toFixed(8),
            //'Distance Momentum Differences': distanceMomentumDifferences.map(v => v.toFixed(8)).join(', '),
            DistanceValley: updatedDistanceValley ? updatedDistanceValley.join(', ') : 'N/A',
            DistancePeak: updatedDistancePeak ? updatedDistancePeak.join(', ') : 'N/A',
            MomentumPeak: updatedMomentumPeak ? updatedMomentumPeak.join(', ') : 'N/A',
            //ShortSmaMomentum: momentum.toFixed(8),
            //'Short SMA Values': shortSmaValues.map(value => value.toFixed(2)).join(', '),
            //LONGsma: longSma.toFixed(2),
            //slowingMomentum: slowingMomentum.join(', '),
            //momentumDifference: momentumDifference.toFixed(8),
            //'Momentum Differences': momentumDifferences.map(value => value.toFixed(8)).join(', '),
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
            AAGMpcCount: AcceleratingAbsoluteGapMomentumCrossoverCount,
            BpcCount: BouncePositiveCrossoverCount,
            SMAncCount: SMANegativeCrossoverCount,
            MPncCount: momentumPeakNegativeCrossoverCount,
            //SLMncCount: slowingMomentumNegativeCrossoverCount,
            //SDMncCount: slowingDistanceMomentumCrossoverCount,
            SAGMncCount: slowingAbsoluteGapMomentumCrossoverCount,
            GMLncCount: gapMomentumLowCrossoverCount,
            sellTriggerSource: sellTriggers,
            sellDistance: formattedSellDistance,
        })    
    }

    return action
}

module.exports = { drawEffect }
