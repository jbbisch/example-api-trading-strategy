const calculatePnL = require("../../utils/calculatePnL")
const drawToConsole = require("../../utils/drawToConsole")

const drawEffect = (state, action) => {
    const [event, payload] = action

    if(event === 'crossover/draw') {
        const { props } = payload
        const { contract } = props
        const { product, position, mode, buffer, tlc, realizedPnL, buyDistance, sellDistance, buyTriggerSource, sellTriggerSource,} = state
        const { AAGMpcBreak, AAGMpcBreakCount, SAGMncBreakCount, SAGMncBreak, slopeFlatHistory, SharpDroppingVelocityNegativeCrossoverCount, SharpDroppingVelocityNegativeCrossoverHistory, flatVelocityHistory, flatMarketEntryConditionCount, flatMarketExitConditionCount, DriftingVelocityPositiveCrossoverConfirmedCount, DriftingVelocityPositiveCrossoverHistory, DriftingVelocityNegativeCrossoverHistory, DriftingVelocityNegativeCrossoverConfirmedCount, shortSmaVelocities, longSmaVelocities, distanceVelocities, distance, shortSma, SMAPositiveCrossoverCount, SMANegativeCrossoverCount, NegativeBounceNegativeCrossoverCount, BouncePositiveCrossoverCount, updatedDistanceValley, AcceleratingAbsoluteGapMomentumCrossoverCount, longSma, distanceOpen, GapMomentumLowCrossover, gapMomentumLowCrossoverCount, absoluteGapMomentum, absoluteGapMomentums, absoluteGapMomentumDifference, absoluteGapMomentumDifferences, slowingAbsoluteGapMomentum, momentum, momentumDifferences, shortSmaValues, distanceMomentum, distanceOpenValues, distanceValues, slowingDistanceMomentum, distanceMomentumDifferences, distanceMomentumDifference, momentumPeak, distancePeak, updatedMomentumPeak, updatedDistancePeak, triggerSource, slowingMomentum, momentumDifference, slowingMomentumNegativeCrossoverCount, slowingDistanceMomentumCrossoverCount, slowingAbsoluteGapMomentumCrossoverCount, momentumPeakNegativeCrossoverCount} = tlc.state  

        const formatDistanceArray = (distanceArray) => {
            if (!distanceArray || distanceArray.length === 0) return 'No Distance'

            const formatted = distanceArray.map(item => {
                const pre = item.prevDistance !== undefined ? item.prevDistance.toFixed(2) : 'N/A'
                const dist = item.distance !== undefined ? item.distance.toFixed(2) : 'N/A'
                return `Pre: ${pre}, Dist: ${dist}`
            })

            const rows = []
            for (let i = 0; i < formatted.length; i += 5) {
                rows.push(formatted.slice(i, i + 5).join(' | '))
            }
            return rows.join('\n')
        }

        const formattedBuyDistance = formatDistanceArray(buyDistance)
        const formattedSellDistance = formatDistanceArray(sellDistance)

        //const formattedBuyTriggers = (buyTriggerSourceArray) => {
            //return buyTriggerSourceArray && buyTriggerSourceArray.length > 0 ? buyTriggerSourceArray.join(', ') : 'No Triggers'
        //}
        //const formattedSellTriggers = (sellTriggerSourceArray) => {
            //return sellTriggerSourceArray && sellTriggerSourceArray.length > 0 ? sellTriggerSourceArray.join(', ') : 'No Triggers'
        //}

        const formatTriggerSourceArray = (arr) => {
            if (!arr || arr.length === 0) return 'No Triggers'

            const rows = []
            for (let i = 0; i < arr.length; i += 6) {
                rows.push(arr.slice(i, i + 6).join(' | '))
            }
            return rows.join('\n')
        }

        const buyTriggers = formatTriggerSourceArray(buyTriggerSource)
        const sellTriggers = formatTriggerSourceArray(sellTriggerSource)

        drawToConsole({
            'Distance on prevClose': distanceValues.map(value => value.toFixed(2)).join(', '),
            'Distance on currentOpen': distanceOpenValues.map(value => value.toFixed(2)).join(', '),
            //AbsoluteGapMomentum: absoluteGapMomentum !== undefined ? absoluteGapMomentum.toFixed(8) : 'N/A',
            AbsoluteGapMomentums: (absoluteGapMomentums || []).map(v => v.toFixed(8)).join(', '),
            //AbsoluteGapMomentumDifference: absoluteGapMomentumDifference !== undefined ? absoluteGapMomentumDifference.toFixed(8) : 'N/A',
            //AbsoluteGapMomentumDifferences: (absoluteGapMomentumDifferences || []).map(v => v.toFixed(8)).join(', '),
            //DistanceMomentum: distanceMomentum.toFixed(8),
            //slowingDistanceMomentum: slowingDistanceMomentum.join(', '),
            //distanceMomentumDifference: distanceMomentumDifference.toFixed(8),
            //'Distance Momentum Differences': distanceMomentumDifferences.map(v => v.toFixed(8)).join(', '),
            DistanceValley: updatedDistanceValley ? updatedDistanceValley.join(', ') : 'N/A',
            DistancePeak: updatedDistancePeak ? updatedDistancePeak.join(', ') : 'N/A',
            MomentumPeak: updatedMomentumPeak ? updatedMomentumPeak.join(', ') : 'N/A',
            DVpcHistory: (DriftingVelocityPositiveCrossoverHistory || []).map(v => v ? 'true' : 'false').join(', '),
            DVncHistory: (DriftingVelocityNegativeCrossoverHistory || []).map(v => v ? 'true' : 'false').join(', '),
            flatVelocityHistory: flatVelocityHistory.map(v => v ? 'true' : 'false').join(', '),
            slopeFlatHistory: (slopeFlatHistory || []).map(v => v ? 'true' : 'false').join(', '),
            SDVncHistory: (SharpDroppingVelocityNegativeCrossoverHistory || []).map(v => v ? 'true' : 'false').join(', '),
            shortSmaVelocities: (shortSmaVelocities || []).map(v => v.toFixed(8)).join(", "),
            longSmaVelocities: (longSmaVelocities || []).map(v => v.toFixed(8)).join(", "),
            distanceVelocities: (distanceVelocities || []).map(v => v.toFixed(8)).join(", "),
            slowingAbsoluteGapMomentum: (slowingAbsoluteGapMomentum || []).join(', '),
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
            //buyDistance: formattedBuyDistance,
            SMApcCount: SMAPositiveCrossoverCount,
            DVpcCount: DriftingVelocityPositiveCrossoverConfirmedCount,
            FMEpcCount: flatMarketEntryConditionCount,
            AAGMpcCount: AAGMpcBreakCount,
            //BpcCount: BouncePositiveCrossoverCount,
            sellTriggerSource: sellTriggers,
            //sellDistance: formattedSellDistance,
            SMAncCount: SMANegativeCrossoverCount,
            DVncCount: DriftingVelocityNegativeCrossoverConfirmedCount,
            //FMEncCount: flatMarketExitConditionCount,
            SAGMncCount: SAGMncBreakCount,
            NBncCount: NegativeBounceNegativeCrossoverCount,
            //SDVncCount: SharpDroppingVelocityNegativeCrossoverCount,
            //MPncCount: momentumPeakNegativeCrossoverCount,
            //SLMncCount: slowingMomentumNegativeCrossoverCount,
            //SDMncCount: slowingDistanceMomentumCrossoverCount,
            //GMLncCount: gapMomentumLowCrossoverCount,
            mode,
            contract: contract.name,      
            netPos: position?.netPos || 0,
            realizedPnL: `$${realizedPnL.toFixed(2)}`,
        })    
    }

    return action
}

module.exports = { drawEffect }
