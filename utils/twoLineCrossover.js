const { calculateSma } = require("./helpers")

module.exports = function twoLineCrossover(shortPeriod, longPeriod) {
    function nextTLC(prevState, data) {
        const { timestamp, open, high, low, close } = data
        const newData = data.sort((a, b) => a.timestamp - b.timestamp)

        const shortSma = newData.slice(newData.length - shortPeriod).reduce((a, b) => a + b.close || b.price, 0) / shortPeriod
        const longSma = newData.slice(newData.length - longPeriod).reduce((a, b) => a + b.close || b.price, 0) / longPeriod
        const distance = shortSma - longSma
        const currentPrice = newData[newData.length - 1].close || newData[newData.length - 1].price

        const positiveCrossover = (prevState.distance <= -0.17 && distance > -0.17) || (prevState.shortSma <= prevState.longSma && distance > 0.00) || (prevState.distance > 0.00 && distance < 1.50 && (shortSma - prevState.shortSma) > 0.15)
        const negativeCrossover = (prevState.distance >= -0.17 && distance < -0.17) || (prevState.shortSma >= prevState.longSma && distance < 0.00) || (distance < 1.50 && (distance - prevState.distance) < -0.33) || (prevState.distance > 4.00 && distance < 4.00) || (prevState.distance > 3.00 && distance < 3.00)
        
        // Calculate momentum over the last 4 periods plus the current period
        const updatedShortSmaValues = [...prevState.shortSmaValues.slice(1), shortSma]
        const momentum = updatedShortSmaValues.reduce((sum, value, index, arr) => {
            if (index === 0) return sum
            return sum + (value - arr[index - 1]) / arr[index - 1]
        }, 0) / (updatedShortSmaValues.length - 1)

        const next = {
            shortSma: shortSma,
            longSma: longSma,
            distance: distance,
            positiveCrossover: positiveCrossover,
            negativeCrossover: negativeCrossover,
            momentum: momentum,
            shortSmaValues: updatedShortSmaValues,
        }

        console.log('Updating state with new SMA values: Previous State - Short SMA: ', prevState.shortSma, ' Long SMA: ', prevState.longSma, ' Distance: ', prevState.distance, ' Current State - Short SMA: ', next.shortSma, ' Long SMA: ', next.longSma, ' Distance: ', next.distance, ' Positive Crossover: ', next.positiveCrossover, ' Negative Crossover: ', next.negativeCrossover, ' Momentum: ', next.momentum)

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
            shortSmaValues: Array(5).fill(0), // Initialize with an array of 5 zeros
        }
    }

    nextTLC.init()

    return nextTLC
}