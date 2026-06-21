/**
 * Pre-entry velocity gate.
 *
 * Wraps any strategy that exposes `positiveCrossover` and `distance` in its
 * state and gates long entries on momentum: the distance signal must have been
 * moving at least `velocityThreshold` units/bar in the bar immediately before
 * the positive crossover fires.
 *
 * Why this works: trades that exit via SGMnc (profitable) enter with ~1.53
 * median velocity at bar -1, vs ~0.55 for LNC (losing) trades.  Requiring
 * vel[-1] > 0.75 keeps 47.6% of the bearScore<2+ATR>=80 universe while
 * capturing disproportionately more SGMnc-quality entries.
 *
 * Usage:
 *   const gate = require('./preEntryVelocityGate')(innerStrategy, 0.75)
 *   // gate exposes the same interface as innerStrategy
 *   // gate.state  — current state (adds velocityGateBlocked)
 *   // const next = gate(prevState, buffer)
 *
 * State additions:
 *   velocityGateBlocked : boolean  — true if this bar's positive crossover was
 *                                    suppressed by the gate
 *   preEntryVelocity    : number|null  — vel[-1] computed at the crossover bar
 */

module.exports = function createPreEntryVelocityGate(innerStrategy, velocityThreshold = 0.75) {
    // innerStrategy is already instantiated (e.g. tlc = require('...')(5, 10))

    // We keep a 3-element rolling window of the last 3 distance values so we
    // can compute vel[-1] = dist[-1] - dist[-2] at the moment a crossover fires.
    // Indices: [oldest, middle, newest(=current bar)]
    let distWindow = [null, null, null]

    function gate(prevState, buffer) {
        const next = innerStrategy(prevState, buffer)

        // Slide the distance window
        distWindow = [distWindow[1], distWindow[2], next.distance]

        let velocityGateBlocked = false
        let preEntryVelocity    = null

        // Has a new positive crossover edge fired?
        const posEdge = next.positiveCrossover && !prevState.positiveCrossover

        if (posEdge && distWindow[1] !== null && distWindow[2] !== null) {
            // velocity = how fast distance moved INTO this crossover bar
            // distWindow[2] = dist[0]  (this bar, the crossover bar)
            // distWindow[1] = dist[-1] (previous bar)
            preEntryVelocity = distWindow[2] - distWindow[1]

            if (preEntryVelocity <= velocityThreshold) {
                velocityGateBlocked = true
                // Suppress the positive crossover in the returned state
                // so downstream consumers (entry logic) see no signal
                return Object.assign({}, next, {
                    positiveCrossover:   false,
                    velocityGateBlocked: true,
                    preEntryVelocity,
                })
            }
        }

        return Object.assign({}, next, {
            velocityGateBlocked,
            preEntryVelocity: posEdge ? preEntryVelocity : null,
        })
    }

    // Expose the inner strategy's state so callers can read it
    Object.defineProperty(gate, 'state', {
        get() { return innerStrategy.state },
    })

    gate.velocityThreshold = velocityThreshold
    return gate
}