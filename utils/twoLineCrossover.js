const { calculateSma } = require("./helpers")
const { calculateSmaOpen } = require("./helpers")

module.exports = function twoLineCrossover(shortPeriod, longPeriod) {
    function nextTLC(prevState, data) {
        const { timestamp, open, high, low, close } = data
        const newData = data.sort((a, b) => a.timestamp - b.timestamp)

        const shortSma = newData.slice(newData.length - shortPeriod).reduce((a, b) => a + b.close || b.price, 0) / shortPeriod
        const longSma = newData.slice(newData.length - longPeriod).reduce((a, b) => a + b.close || b.price, 0) / longPeriod
        const distance = shortSma - longSma
        const currentPrice = newData[newData.length - 1].close || newData[newData.length - 1].price

        const updatedLongSmaValues = [...prevState.longSmaValues.slice(1), longSma]
        const meanLongSma = updatedLongSmaValues.reduce((sum, val) => sum + val, 0) / updatedLongSmaValues.length
        const stdDevLongSma = Math.sqrt(
            updatedLongSmaValues.reduce((sum, val) => sum + Math.pow(val - meanLongSma, 2), 0) / updatedLongSmaValues.length
        )

        const shortSmaVelocity = (shortSma - prevState.prevShortSma) / (prevState.prevShortSma || 1);
        const longSmaVelocity = (longSma - prevState.prevLongSma) / (prevState.prevLongSma || 1);
        const distanceVelocity = (distance - prevState.prevDistance) / (Math.abs(prevState.prevDistance) || 1);

        const updatedShortSmaVelocities = [...prevState.shortSmaVelocities.slice(1), shortSmaVelocity]
        const updatedLongSmaVelocities = [...prevState.longSmaVelocities.slice(1), longSmaVelocity]
        const updatedDistanceVelocities = [...prevState.distanceVelocities.slice(1), distanceVelocity]

        const longSmaReady = updatedLongSmaVelocities.length >= 10 && updatedLongSmaVelocities.filter(v => v !== 0).length >= 7
        const flatVelocity = longSmaReady && updatedLongSmaVelocities.slice(-10).filter(v => Math.abs(v) < 0.00005).length >= 7
        const velocityBreakingOut = updatedLongSmaVelocities.slice(-3).some(v => Math.abs(v) >= 0.00005)

        const updatedFlatVelocityHistory = [...prevState.flatVelocityHistory.slice(1), flatVelocity]

        const shortSmaOpen = newData.slice(newData.length - shortPeriod).reduce((a, b) => a + b.open || b.price, 0) / shortPeriod
        const longSmaOpen = newData.slice(newData.length - longPeriod).reduce((a, b) => a + b.open || b.price, 0) / longPeriod
        const distanceOpen = shortSmaOpen - longSmaOpen

        const now = new Date().toLocaleTimeString('en-US', { hour12: false})

        // Calculate momentum over the last 4 periods plus the current period
        const updatedShortSmaValues = [...prevState.shortSmaValues.slice(1), shortSma]
        const momentum = updatedShortSmaValues.reduce((sum, value, index, arr) => {
            if (index === 0) return sum
            return sum + (arr[index - 1] !== 0 ? (value - arr[index - 1]) / arr[index - 1] : 0)
        }, 0) / (updatedShortSmaValues.length - 1)

        const momentumDifference = momentum - prevState.prevMomentum
        const updatedMomentumDifferences = [...(prevState.momentumDifferences || []). slice(1), momentumDifference]
        const slowingMomentum = momentumDifference < prevState.momentumDifference
        const updatedSlowingMomentum = [...prevState.slowingMomentum.slice(1), slowingMomentum]

        const updatedDistanceOpenValues = [...prevState.distanceOpenValues.slice(1), distanceOpen]

        const updatedDistanceValues = [...prevState.distanceValues.slice(1), distance]
        const distanceMomentumSum = updatedDistanceValues.reduce((sum, value, index, arr) => {
            if (index === 0 || arr[index - 1] === 0) return sum
            return sum + (value - arr[index - 1]) / arr[index - 1]
            }, 0) 
        const distanceMomentumCount = updatedDistanceValues.reduce((count, value, index, arr) => {
            if (index === 0 || arr[index - 1] === 0) return count
            return count + 1
        }, 0)
        const distanceMomentum = distanceMomentumSum / (distanceMomentumCount || 1)

        const absDistanceValues = updatedDistanceValues.map(value => Math.abs(value))

        let absoluteGapMomentum = 0

        if (absDistanceValues.length > 1 && absDistanceValues.every(v => typeof v === 'number')) {
            const absoluteGapMomentumSum = absDistanceValues.reduce((sum, value, index, arr) => {
                if (index === 0 || arr[index - 1] === 0) return sum
                return sum + (value - arr[index - 1]) / arr[index - 1]
            }, 0)
            const absoluteGapMomentumCount = absDistanceValues.reduce((count, value, index, arr) => {
                if (index === 0 || arr[index - 1] === 0) return count
                return count + 1
            }, 0)
            absoluteGapMomentum = absoluteGapMomentumSum / (absoluteGapMomentumCount || 1)
        }

        const updatedAbsoluteGapMomentums = [...(prevState.absoluteGapMomentums || []).slice(1), absoluteGapMomentum]
        const absoluteGapMomentumDifference = absoluteGapMomentum - prevState.prevAbsoluteGapMomentum
        const updatedAbsoluteGapMomentumDifferences = [...(prevState.absoluteGapMomentumDifferences || []).slice(1), absoluteGapMomentumDifference]
        const slowingAbsoluteGapMomentum = absoluteGapMomentumDifference < prevState.absoluteGapMomentumDifference
        const updatedSlowingAbsoluteGapMomentum = [...(prevState.slowingAbsoluteGapMomentum || []).slice(1), slowingAbsoluteGapMomentum]

        const distanceMomentumDifference = distanceMomentum - prevState.prevDistanceMomentum
        const updatedDistanceMomentumDifferences = [...(prevState.distanceMomentumDifferences || []). slice(1), distanceMomentumDifference]
        const slowingDistanceMomentum = distanceMomentumDifference < prevState.distanceMomentumDifference
        const updatedSlowingDistanceMomentum = [...(prevState.slowingDistanceMomentum || []).slice(1), slowingDistanceMomentum]

        const momentumPeak = prevState.momentum > prevState.prevMomentum && momentum < prevState.momentum
        const distancePeak = prevState.distanceMomentum > prevState.prevDistanceMomentum && distanceMomentum < prevState.distanceMomentum
        const distanceValley = prevState.distanceMomentum < prevState.prevDistanceMomentum && distanceMomentum > prevState.distanceMomentum

        const updatedMomentumPeak = [...prevState.updatedMomentumPeak.slice(1), momentumPeak]
        if (updatedMomentumPeak.length > 10) updatedMomentumPeak.shift()
        const updatedDistancePeak = [...prevState.updatedDistancePeak.slice(1), distancePeak]
        if (updatedDistancePeak.length > 10) updatedDistancePeak.shift()
        const updatedDistanceValley = [...prevState.updatedDistanceValley.slice(1), distanceValley]
        if (updatedDistanceValley.length > 10) updatedDistanceValley.shift()

        const slowingMomentumNegativeCrossoverCount = prevState.slowingMomentumNegativeCrossoverCount || 0
        //const slowingDistanceMomentumCrossoverCount = prevState.slowingDistanceMomentumCrossoverCount || 0
        const momentumPeakNegativeCrossoverCount = prevState.momentumPeakNegativeCrossoverCount || 0
        const slowingAbsoluteGapMomentumCrossoverCount = prevState.slowingAbsoluteGapMomentumCrossoverCount || 0
        const gapMomentumLowCrossoverCount = prevState.gapMomentumLowCrossoverCount || 0
        const SMANegativeCrossoverCount = prevState.SMANegativeCrossoverCount || 0
        const AcceleratingAbsoluteGapMomentumCrossoverCount = prevState.AcceleratingAbsoluteGapMomentumCrossoverCount || 0
        const BouncePositiveCrossoverCount = prevState.BouncePositiveCrossoverCount || 0
        const DriftingVelocityNegativeCrossoverCount = prevState.DriftingVelocityNegativeCrossoverCount || 0
        const flatMarketEntryConditionCount = prevState.flatMarketEntryConditionCount || 0
        const flatMarketExitConditionCount = prevState.flatMarketExitConditionCount || 0

        const SMAPositiveCrossover = (prevState.shortSmaOpen <= prevState.longSmaOpen && distanceOpen > 0.00)
        const AcceleratingAbsoluteGapMomentumCrossover = (distanceOpen < -2.70 && updatedSlowingAbsoluteGapMomentum.slice(-5).filter(v => v).length >= 3 && updatedDistanceValley.slice(-3).filter(v => v).length >= 1)
        const BouncePositiveCrossover = false //(prevState.distanceOpen > 0.50 && distanceOpen < 3.50 && (prevState.shortSmaValues.slice(-4).every((val, i, arr) => i === 0 || val > arr[i - 1]))) // - prevState.shortSma) > 1.25)
        const flatMarketEntryCondition = (flatVelocity && !velocityBreakingOut && currentPrice <= longSma - stdDevLongSma && currentPrice > longSma - 1.5 * stdDevLongSma)
        const positiveCrossover = SMAPositiveCrossover || AcceleratingAbsoluteGapMomentumCrossover || BouncePositiveCrossover || flatMarketEntryCondition

        const SMANegativeCrossover = (prevState.shortSma >= prevState.longSma && distance < 0.00)
        const NegativeBounceNegativeCrossover = (prevState.distance >= -0.28 && distance < -0.28)
        //const LikelyNegativeCrossover = (prevState.distance > 0.28 && distance < 0.31)
        const SlowingAbsoluteGapMomentumCrossover = (distance > 2.70 && updatedSlowingAbsoluteGapMomentum.slice(-5).filter(v => v).length >= 3 && updatedDistancePeak.slice(-3).filter(v => v).length >= 1)
        const SlowingMomentumNegativeCrossover = false //(distance > 2.70 && updatedSlowingMomentum.slice(-5).filter(v => v).length >= 3 && updatedDistancePeak.slice(-3).filter(v => v).length >= 1)
        //const BigDistancePullback = (prevState.distance > 4.00 && distance < 4.00) || (prevState.distance > 3.00 && distance < 3.00)
        const GapMomentumLowCrossover = false //(distance < 2.70 && momentumPeak === true && updatedAbsoluteGapMomentums.slice(-4).every(v => v > 0.00) && updatedAbsoluteGapMomentums.slice(-4).every(v => v < 0.90485211))
        const MomentumPeakNegativeCrossover = false //(distance > 0.00 && distance < 2.70 && momentumPeak === true && updatedSlowingAbsoluteGapMomentum.slice(-6).filter(v => v).length >= 4)
        //const DistancePeakNegativeCrossover = (distance < 2.70 && distancePeak === true)
        const DriftingVelocityNegativeCrossover = (updatedDistanceOpenValues.slice(-3).every(v => v > 0.00 && v < 2.50)) && updatedShortSmaVelocities.slice(-5).filter(v => Math.abs(v) < 0.0012).length >= 3 && updatedLongSmaVelocities.slice(-5).filter(v => Math.abs(v) < 0.0012).length >= 3 && updatedDistanceVelocities.slice(-5).filter(v => Math.abs(v) < 0.25).length >= 3
        const updatedDVncHistory = [...prevState.DriftingVelocityNegativeCrossoverHistory.slice(1), DriftingVelocityNegativeCrossover]
        const DVncConfirmed = updatedDVncHistory.slice(-3).every(v => v === true)
        const flatMarketExitCondition = (flatVelocity && !velocityBreakingOut && currentPrice >= longSma + stdDevLongSma && currentPrice < longSma + 1.5 * stdDevLongSma)
        const negativeCrossover =  SMANegativeCrossover || SlowingAbsoluteGapMomentumCrossover || GapMomentumLowCrossover || NegativeBounceNegativeCrossover || SlowingMomentumNegativeCrossover || MomentumPeakNegativeCrossover || DVncConfirmed || flatMarketExitCondition //|| DistancePeakNegativeCrossover

        const updatedAcceleratingAbsoluteGapMomentumCrossoverCount = AcceleratingAbsoluteGapMomentumCrossover ? AcceleratingAbsoluteGapMomentumCrossoverCount + 1 : AcceleratingAbsoluteGapMomentumCrossoverCount
        const updatedSMANegativeCrossoverCount = SMANegativeCrossover ? SMANegativeCrossoverCount + 1 : SMANegativeCrossoverCount
        const updatedSlowingMomentumNegativeCrossoverCount = SlowingMomentumNegativeCrossover ? slowingMomentumNegativeCrossoverCount + 1 : slowingMomentumNegativeCrossoverCount
        //const updatedSlowingDistanceMomentumCrossoverCount = SlowingDistanceMomentumCrossover ? slowingDistanceMomentumCrossoverCount + 1 : slowingDistanceMomentumCrossoverCount
        const updatedSlowingAbsoluteGapMomentumCrossoverCount = SlowingAbsoluteGapMomentumCrossover ? slowingAbsoluteGapMomentumCrossoverCount + 1 : slowingAbsoluteGapMomentumCrossoverCount
        const updatedGapMomentumLowCrossoverCount = GapMomentumLowCrossover ? gapMomentumLowCrossoverCount + 1 : gapMomentumLowCrossoverCount
        const updatedMomentumPeakNegativeCrossoverCount = MomentumPeakNegativeCrossover ? momentumPeakNegativeCrossoverCount + 1 : momentumPeakNegativeCrossoverCount
        const updatedBouncePositiveCrossoverCount = BouncePositiveCrossover ? BouncePositiveCrossoverCount + 1 : BouncePositiveCrossoverCount
        const updatedDriftingVelocityNegativeCrossoverCount = DriftingVelocityNegativeCrossover ? DriftingVelocityNegativeCrossoverCount + 1 : DriftingVelocityNegativeCrossoverCount
        const updatedFlatMarketEntryConditionCount = flatMarketEntryCondition ? flatMarketEntryConditionCount + 1 : flatMarketEntryConditionCount
        const updatedFlatMarketExitConditionCount = flatMarketExitCondition ? flatMarketExitConditionCount + 1 : flatMarketExitConditionCount

        const buyTriggerSource = [...(prevState.triggerSource || [])]
        const sellTriggerSource = [...(prevState.triggerSource || [])]

        if (positiveCrossover) {
            if (SMAPositiveCrossover) buyTriggerSource.push(`${now} - SMApc`)
            if (AcceleratingAbsoluteGapMomentumCrossover) buyTriggerSource.push(`${now} - AAGMpc`)
            if (BouncePositiveCrossover) buyTriggerSource.push(`${now} - Bpc`)
            if (flatMarketEntryCondition) buyTriggerSource.push(`${now} - FMEpc`)
        }
        if (negativeCrossover) {
            if (SMANegativeCrossover) sellTriggerSource.push(`${now} - SMAnc`)
            if (SlowingAbsoluteGapMomentumCrossover) sellTriggerSource.push(`${now} - SAGMnc`)
            if (NegativeBounceNegativeCrossover) sellTriggerSource.push(`${now} - NBnc`)
            if (SlowingMomentumNegativeCrossover) sellTriggerSource.push(`${now} - SLMnc`)
            if (GapMomentumLowCrossover) sellTriggerSource.push(`${now} - GMLnc`)
            //if (BigDistancePullback) sellTriggerSource.push(`${now} - BigDistancePullback`)
            if (MomentumPeakNegativeCrossover) sellTriggerSource.push(`${now} - MPnc`)
            //if (DistancePeakNegativeCrossover) sellTriggerSource.push(`${now} - DPnc`)
            if (DriftingVelocityNegativeCrossover) sellTriggerSource.push(`${now} - DVnc`)
            if (DVncConfirmed) sellTriggerSource.push(`${now} - DVncC`)
            if (flatMarketExitCondition) sellTriggerSource.push(`${now} - FMEnc`)
        }

        const next = {
            shortSma: shortSma,
            longSma: longSma,
            distance: distance,
            distanceOpen: distanceOpen,
            shortSmaOpen: shortSmaOpen,
            longSmaOpen: longSmaOpen,
            positiveCrossover: positiveCrossover,
            negativeCrossover: negativeCrossover,
            SMANegativeCrossoverCount: updatedSMANegativeCrossoverCount,
            momentum: momentum,
            MomentumPeakNegativeCrossover: MomentumPeakNegativeCrossover,
            momentumPeakNegativeCrossoverCount: updatedMomentumPeakNegativeCrossoverCount,
            momentumDifferences: updatedMomentumDifferences,
            momentumDifference: momentumDifference,
            NegativeBounceNegativeCrossover: NegativeBounceNegativeCrossover,
            //LikelyNegativeCrossover: LikelyNegativeCrossover,
            SlowingMomentumNegativeCrossover: SlowingMomentumNegativeCrossover,
            slowingMomentumNegativeCrossoverCount: updatedSlowingMomentumNegativeCrossoverCount,
            //SlowingDistanceMomentumCrossover: SlowingDistanceMomentumCrossover,
            //slowingDistanceMomentumCrossoverCount: updatedSlowingDistanceMomentumCrossoverCount,
            slowingMomentum: updatedSlowingMomentum,
            distanceMomentum: distanceMomentum,
            absoluteGapMomentum: absoluteGapMomentum,
            absoluteGapMomentums: updatedAbsoluteGapMomentums,
            absoluteGapMomentumDifference: absoluteGapMomentumDifference,
            absoluteGapMomentumDifferences: updatedAbsoluteGapMomentumDifferences,
            slowingAbsoluteGapMomentum: updatedSlowingAbsoluteGapMomentum,
            SlowingAbsoluteGapMomentumCrossover: SlowingAbsoluteGapMomentumCrossover,
            slowingAbsoluteGapMomentumCrossoverCount: updatedSlowingAbsoluteGapMomentumCrossoverCount,
            AcceleratingAbsoluteGapMomentumCrossover: AcceleratingAbsoluteGapMomentumCrossover,
            AcceleratingAbsoluteGapMomentumCrossoverCount: updatedAcceleratingAbsoluteGapMomentumCrossoverCount,
            BouncePositiveCrossover: BouncePositiveCrossover,
            BouncePositiveCrossoverCount: updatedBouncePositiveCrossoverCount,  
            updatedDistanceValley: updatedDistanceValley,
            GapMomentumLowCrossover: GapMomentumLowCrossover,
            gapMomentumLowCrossoverCount: updatedGapMomentumLowCrossoverCount,
            prevAbsoluteGapMomentum: absoluteGapMomentum,
            distanceMomentumDifferences: updatedDistanceMomentumDifferences,
            distanceMomentumDifference: distanceMomentumDifference,
            slowingDistanceMomentum: updatedSlowingDistanceMomentum,
            shortSmaValues: updatedShortSmaValues,
            distanceValues: updatedDistanceValues,
            distanceOpenValues: updatedDistanceOpenValues,
            prevMomentum: prevState.momentum,
            prevDistanceMomentum: prevState.distanceMomentum,
            momentumPeak: momentumPeak,
            distancePeak: distancePeak,
            updatedMomentumPeak: updatedMomentumPeak,
            updatedDistancePeak: updatedDistancePeak,
            buyTriggerSource: buyTriggerSource,
            sellTriggerSource: sellTriggerSource,
            shortSmaVelocities: updatedShortSmaVelocities,
            longSmaVelocities: updatedLongSmaVelocities,
            distanceVelocities: updatedDistanceVelocities,
            prevShortSma: shortSma,
            prevLongSma: longSma,
            prevDistance: distance,
            DriftingVelocityNegativeCrossover: DriftingVelocityNegativeCrossover,
            DriftingVelocityNegativeCrossoverCount: updatedDriftingVelocityNegativeCrossoverCount,
            DriftingVelocityNegativeCrossoverHistory: updatedDVncHistory,
            longSmaValues: updatedLongSmaValues,
            stdDevLongSma: stdDevLongSma,
            flatVelocity: flatVelocity,
            flatVelocityHistory: updatedFlatVelocityHistory,
            flatMarketExitCondition: flatMarketExitCondition,
            flatMarketEntryCondition: flatMarketEntryCondition,
            flatMarketEntryConditionCount: updatedFlatMarketEntryConditionCount,
            flatMarketExitConditionCount: updatedFlatMarketExitConditionCount,
        }

        console.log('Updating state with new SMA values: Previous State - Short SMA: ', prevState.shortSma, ' Long SMA: ', prevState.longSma, ' Distance: ', prevState.distance, ' Current State - Short SMA: ', next.shortSma, ' Long SMA: ', next.longSma, ' Distance: ', next.distance, ' Positive Crossover: ', next.positiveCrossover, ' Negative Crossover: ', next.negativeCrossover, ' Momentum: ', next.momentum, ' Distance Momentum: ', next.distanceMomentum, 'MomentumPeak: ', next.momentumPeak, 'DistancePeak: ', next.distancePeak, 'Updated Momentum Peak: ', next.updatedMomentumPeak, 'Updated Distance Peak: ', next.updatedDistancePeak)

        nextTLC.state = next

        return next
    }

    nextTLC.init = () => {
        nextTLC.state = {
            shortSma: 0,
            longSma: 0,
            distance: 0,
            distanceOpen: 0,
            shortSmaOpen: 0,
            longSmaOpen: 0,
            positiveCrossover: false,
            negativeCrossover: false,
            SMANegativeCrossoverCount: 0,
            momentum: 0,
            distanceMomentum: 0,
            distanceMomentumDifferences: Array(5).fill(0), // Initialize with an array of 5 zeros
            distanceMomentumDifference: 0,
            slowingDistanceMomentum: Array(5).fill(false), // Initialize with an array of 6 falses
            shortSmaValues: Array(5).fill(0), // Initialize with an array of 5 zeros
            distanceValues: Array(5).fill(0), // Initialize with an array of 5 zeros
            distanceOpenValues: Array(5).fill(0), // Initialize with an array of 5 zeros
            prevMomentum: 0,
            prevDistanceMomentum: 0,
            momentumPeak: false,
            momentumPeakNegativeCrossoverCount: 0,
            distancePeak: false,
            updatedMomentumPeak: Array(3).fill(false), // Initialize with an array of 5 falses
            updatedDistancePeak: Array(3).fill(false), // Initialize with an array of 6 falses
            buyTriggerSource: [],
            sellTriggerSource: [],                                                                                                        
            momentumDifference: 0,
            momentumDifferences: Array(5).fill(0), // Initialize with an array of 5 zeros
            slowingMomentum: Array(5).fill(false), // Initialize with an array of 6 falses
            slowingMomentumNegativeCrossoverCount: 0,
            //slowingDistanceMomentumCrossoverCount: 0,
            absoluteGapMomentum: 0,
            absoluteGapMomentums: Array(5).fill(0), // Initialize with an array of 5 zeros
            absoluteGapMomentumDifference: 0,
            absoluteGapMomentumDifferences: Array(5).fill(0), // Initialize with an array of 5 zeros
            slowingAbsoluteGapMomentum: Array(5).fill(false), // Initialize with an array of 6 falses
            slowingAbsoluteGapMomentumCrossoverCount: 0,
            AcceleratingAbsoluteGapMomentumCrossoverCount: 0,
            BouncePositiveCrossoverCount: 0,
            distanceValley: false,
            updatedDistanceValley: Array(3).fill(false), // Initialize with an array of 5 falses
            prevAbsoluteGapMomentum: 0,
            gapMomentumLowCrossoverCount: 0,
            shortSmaVelocities: Array(10).fill(0),
            longSmaVelocities: Array(10).fill(0),
            distanceVelocities: Array(10).fill(0),
            prevShortSma: 0,
            prevLongSma: 0,
            prevDistance: 0,
            DriftingVelocityNegativeCrossover: false,
            DriftingVelocityNegativeCrossoverCount: 0,
            DriftingVelocityNegativeCrossoverHistory: Array(3).fill(false),
            longSmaValues: Array(10).fill(0),
            stdDevLongSma: 0,
            flatVelocity: false,
            flatVelocityHistory: Array(5).fill(false),
            flatMarketExitCondition: false,
            flatMarketEntryCondition: false,
            flatMarketEntryConditionCount: 0,
            flatMarketExitConditionCount: 0,
        }
    }

    nextTLC.init()

    return nextTLC
}
