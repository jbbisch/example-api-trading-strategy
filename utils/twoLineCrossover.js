const { calculateSma } = require("./helpers")

module.exports = function twoLineCrossover(shortPeriod, longPeriod) {
    //console.log('TLC function called', shortPeriod, longPeriod)
    function nextTLC(prevState, data) {
        //console.log('TLC RECEIVED prevState', prevState)
        const { timestamp, open, high, low, close } = data
        const newData = data.sort((a, b) => a.timestamp - b.timestamp)

        const shortSma = newData.slice(newData.length - shortPeriod).reduce((a, b) => a + b.close || b.price, 0)/shortPeriod
        const longSma = newData.slice(newData.length - longPeriod).reduce((a, b) => a + b.close || b.price, 0)/longPeriod
        const distance = shortSma - longSma
        //console.log('TLC calculated shortSma', shortSma)
        //console.log('TLC calculated longSma', longSma)

        next = {
            shortSma: shortSma,
            longSma: longSma,
            distance: distance,
            positiveCrossover: shortSma > longSma && prevState.shortSma <= prevState.longSma,
            negativeCrossover: shortSma < longSma && prevState.shortSma >= prevState.longSma,
        }         

        nextTLC.state = next
        //console.log('TLC returning next', next)
        //console.log('TLC returning nextTLC.state', nextTLC.state)

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
