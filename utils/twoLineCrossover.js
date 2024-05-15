const { calculateSma } = require("./helpers")

module.exports = function twoLineCrossover(shortPeriod, longPeriod) {
    function nextTLC(prevState, data) {
        const { timestamp, open, high, low, close } = data
        const newData = data.sort((a, b) => a.timestamp - b.timestamp)

        const shortSma = newData.slice(newData.length - shortPeriod).reduce((a, b) => a + b.close || b.price, 0)/shortPeriod
        const longSma = newData.slice(newData.length - longPeriod).reduce((a, b) => a + b.close || b.price, 0)/longPeriod
        const distance = shortSma - longSma

        const positiveCrossover = (prevState.distance <= -0.17 && distance > -0.17) || (prevState.shortSma <= prevState.longSma && distance > 0.00) || (prevState.distance <= 0.17 && distance > 0.17) // EarlyBuy, TrueCrossOver, PositiveBounce
        const negativeCrossover = (prevState.distance >= -0.17 && distance < -0.17) || (prevState.shortSma >= prevState.longSma && distance < 0.00) || (prevState.distance >= 0.17 && distance < 0.17) || (prevState.distance >= 0.43 && distance < 0.43) || (prevState.distance >= 1.17 && distance < 1.17) || (prevState.distance >= 2.17 && distance < 2.17) // NegativeBounce, TrueCrossUnder, EarlySells
        
        next = {
            shortSma: shortSma,
            longSma: longSma,
            distance: distance,
            positiveCrossover: positiveCrossover,
            negativeCrossover: negativeCrossover,
        }         

        console.log('Updating state with new SMA values: Previous State - Short SMA: ', prevState.shortSma, ' Long SMA: ', prevState.longSma, ' Distance: ', prevState.distance, ' Current State - Short SMA: ', next.shortSma, ' Long SMA: ', next.longSma, ' Distance: ', next.distance, ' Positive Crossover: ', next.positiveCrossover, ' Negative Crossover: ', next.negativeCrossover)

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
        }
    }

    nextTLC.init()

    return nextTLC
}
