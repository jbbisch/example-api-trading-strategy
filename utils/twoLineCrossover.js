const { calculateSma } = require("./helpers")

module.exports = function twoLineCrossover(shortPeriod, longPeriod) {
    function nextTLC(prevState, data) {

        const shortSma = data.slice(data.length - shortPeriod).reduce((a, b) => a + b.price || b.price, 0)/shortPeriod
        const longSma = data.slice(data.length - longPeriod).reduce((a, b) => a + b.price || b.price, 0)/longPeriod
        const distance = shortSma - longSma

        next = {
            shortSma,
            longSma,
            distance,
            positiveCrossover: shortSma > longSma && prevState.shortSma <= prevState.longSma,
            negativeCrossover: shortSma < longSma && prevState.shortSma >= prevState.longSma,
        }         

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
