const { calculateSma } = require("./helpers")

module.exports = function twoLineCrossover(shortPeriod, longPeriod) {
    function nextTLC(prevState, data) {
        const { timestamp, open, high, low, close } = data
        const newData = data.sort((a, b) => a.timestamp - b.timestamp)

        const shortSma = newData.slice(newData.length - shortPeriod).reduce((a, b) => a + b.close || b.price, 0) / shortPeriod
        const longSma = newData.slice(newData.length - longPeriod).reduce((a, b) => a + b.close || b.price, 0) / longPeriod
        const distance = shortSma - longSma
        const currentPrice = newData[newData.length - 1].close || newData[newData.length - 1].price

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

        const updatedDistanceValues = [...prevState.distanceValues.slice(1), distance]
        const distanceMomentum = updatedDistanceValues.reduce((sum, value, index, arr) => {
            if (index === 0) return sum
            return sum + (arr[index - 1] !== 0 ? (value - arr[index - 1]) / arr[index - 1] : 0)
        }, 0) / (updatedDistanceValues.length - 1)

        const momentumPeak = prevState.momentum > prevState.prevMomentum && momentum < prevState.momentum
        const distancePeak = prevState.distanceMomentum > prevState.prevDistanceMomentum && distanceMomentum < prevState.distanceMomentum

        const updatedMomentumPeak = [...prevState.updatedMomentumPeak.slice(1), momentumPeak]
        if (updatedMomentumPeak.length > 10) updatedMomentumPeak.shift()
        const updatedDistancePeak = [...prevState.updatedDistancePeak.slice(1), distancePeak]
        if (updatedDistancePeak.length > 10) updatedDistancePeak.shift()

        const slowingMomentumNegativeCrossoverCount = prevState.slowingMomentumNegativeCrossoverCount || 0

        const SMAPositiveCrossover = (prevState.shortSma <= prevState.longSma && distance > 0.00)
        //const BouncePositiveCrossover = (prevState.distance > 0.50 && distance < 3.50 && (shortSma - prevState.shortSma) > 0.25)
        const positiveCrossover = SMAPositiveCrossover //|| BouncePositiveCrossover

        const SMANegativeCrossover = (prevState.shortSma >= prevState.longSma && distance < 0.00)
        const NegativeBounceNegativeCrossover = (prevState.distance >= -0.17 && distance < -0.17)
        const LikelyNegativeCrossover = (prevState.distance > 0.28 && distance < 0.31)
        const SlowingMomentumNegativeCrossover = (distance > 3.70 && updatedSlowingMomentum.slice(-5).filter(v => v).length >= 4 && updatedDistancePeak.slice(-5).filter(v => v).length >= 1)
        //const BigDistancePullback = (prevState.distance > 4.00 && distance < 4.00) || (prevState.distance > 3.00 && distance < 3.00)
        //const MomentumPeakNegativeCrossover = (prevState.distance > 2.50 && distance < 20.50 && momentumPeak === true)
        //const DistancePeakNegativeCrossover = (prevState.distance > 2.50 && distance < 20.50 && distancePeak === true)
        const negativeCrossover =  SMANegativeCrossover || LikelyNegativeCrossover || NegativeBounceNegativeCrossover || SlowingMomentumNegativeCrossover //|| MomentumPeakNegativeCrossover || DistancePeakNegativeCrossover

        const updatedSlowingMomentumNegativeCrossoverCount = SlowingMomentumNegativeCrossover ? slowingMomentumNegativeCrossoverCount + 1 : 0 

        const buyTriggerSource = [...(prevState.triggerSource || [])]
        const sellTriggerSource = [...(prevState.triggerSource || [])]

        if (positiveCrossover) {
            if (SMAPositiveCrossover) buyTriggerSource.push(`${now} - SMApc`)
            //if (BouncePositiveCrossover) buyTriggerSource.push(`${now} - Bpc`)
        }
        if (negativeCrossover) {
            if (SMANegativeCrossover) sellTriggerSource.push(`${now} - SMAnc`)
            if (LikelyNegativeCrossover) sellTriggerSource.push(`${now} - Lnc`)
            if (NegativeBounceNegativeCrossover) sellTriggerSource.push(`${now} - NBnc`)
            if (SlowingMomentumNegativeCrossover) sellTriggerSource.push(`${now} - SLMnc`)    
            //if (BigDistancePullback) sellTriggerSource.push(`${now} - BigDistancePullback`)
            //if (MomentumPeakNegativeCrossover) sellTriggerSource.push(`${now} - MPnc`)
            //if (DistancePeakNegativeCrossover) sellTriggerSource.push(`${now} - DPnc`)
        }

        const next = {
            shortSma: shortSma,
            longSma: longSma,
            distance: distance,
            positiveCrossover: positiveCrossover,
            negativeCrossover: negativeCrossover,
            momentum: momentum,
            momentumDifferences: updatedMomentumDifferences,
            momentumDifference: momentumDifference,
            NegativeBounceNegativeCrossover: NegativeBounceNegativeCrossover,
            LikelyNegativeCrossover: LikelyNegativeCrossover,
            SlowingMomentumNegativeCrossover: SlowingMomentumNegativeCrossover,
            slowingMomentumNegativeCrossoverCount: updatedSlowingMomentumNegativeCrossoverCount,
            slowingMomentum: updatedSlowingMomentum,
            distanceMomentum: distanceMomentum,
            shortSmaValues: updatedShortSmaValues,
            distanceValues: updatedDistanceValues,
            prevMomentum: prevState.momentum,
            prevDistanceMomentum: prevState.distanceMomentum,
            momentumPeak: momentumPeak,
            distancePeak: distancePeak,
            updatedMomentumPeak: updatedMomentumPeak,
            updatedDistancePeak: updatedDistancePeak,
            buyTriggerSource: buyTriggerSource,
            sellTriggerSource: sellTriggerSource,
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
            positiveCrossover: false,
            negativeCrossover: false,
            momentum: 0,
            distanceMomentum: 0,
            shortSmaValues: Array(5).fill(0), // Initialize with an array of 5 zeros
            distanceValues: Array(5).fill(0), // Initialize with an array of 5 zeros
            prevMomentum: 0,
            prevDistanceMomentum: 0,
            momentumPeak: false,
            distancePeak: false,
            updatedMomentumPeak: Array(5).fill(false), // Initialize with an array of 5 falses
            updatedDistancePeak: Array(5).fill(false), // Initialize with an array of 5 falses
            buyTriggerSource: [],
            sellTriggerSource: [],                                                                                                        
            momentumDifference: 0,
            momentumDifferences: Array(5).fill(0), // Initialize with an array of 5 zeros
            slowingMomentum: Array(5).fill(false), // Initialize with an array of 5 falses
            slowingMomentumNegativeCrossoverCount: 0,
        }
    }

    nextTLC.init()

    return nextTLC
}
