/**
 * Persistence exit gate.
 *
 * Wraps any strategy that exposes `distance` and crossover signals, and emits
 * an early-exit flag based on post-entry velocity persistence.
 *
 * Once a positive crossover fires the module arms itself and tracks per-bar
 * velocity (dist[b] - dist[b-1]).  If K consecutive bars have velocity below
 * `threshold` — and at least `minBars` bars have elapsed since entry — the
 * module emits `persistenceExitSignal: true`.
 *
 * Why: after entry, SAGM trades sustain positive velocity for 3-4 bars;
 * LNC trades drop to negative velocity within 1-2 bars.  Requiring 2
 * consecutive negative-velocity bars (K=2, T=0, minBars=2) exits ~27% of
 * LNC trades early while barely touching SAGMnc trades.
 *
 * Combined with vel>0.75 pre-entry gate:
 *   baseline (no gates): NET=+$2,322   OOS= -$550   n=2,416
 *   vel>0.75 gate only : NET=+$3,751   OOS= +$232   n=1,151
 *   + persistenceExit  : NET=+$4,094   OOS= +$426   n=1,151  (K=2 T=0 min2)
 *
 * Usage:
 *   const exit = require('./persistenceExit')(innerOrGatedStrategy, { K: 2, threshold: 0.00, minBars: 2 })
 *   // const next = exit(prevState, buffer)
 *   // next.persistenceExitSignal — true when early exit should fire
 *   // next.negVelStreak          — current count of consecutive low-vel bars
 *   // next.tradeBar              — bars elapsed since entry (0 outside trade)
 */

module.exports = function createPersistenceExit(innerStrategy, {
    threshold = 0.00,
    K         = 2,
    minBars   = 2,
} = {}) {

    let prevDistance = null
    let inTrade      = false
    let barsInTrade  = 0
    let negVelStreak = 0

    function wrapper(prevState, buffer) {
        const next = innerStrategy(prevState, buffer)

        const posEdge = next.positiveCrossover  && !prevState.positiveCrossover
        const negEdge = next.negativeCrossover  && !prevState.negativeCrossover

        // Velocity relative to prior bar (computed before we update prevDistance)
        const vel = prevDistance !== null ? next.distance - prevDistance : null
        prevDistance = next.distance

        if (posEdge) {
            // New trade starts: reset all per-trade counters
            inTrade      = true
            barsInTrade  = 0
            negVelStreak = 0
        } else if (inTrade) {
            barsInTrade++
            // Only update streak once we have enough bars in the trade
            if (vel !== null && barsInTrade >= minBars) {
                if (vel < threshold) {
                    negVelStreak++
                } else {
                    negVelStreak = 0
                }
            }
        }

        // Natural exit resets internal tracking
        if (negEdge) {
            inTrade      = false
            barsInTrade  = 0
            negVelStreak = 0
        }

        const persistenceExitSignal = inTrade && negVelStreak >= K

        return Object.assign({}, next, {
            persistenceExitSignal,
            negVelStreak,
            tradeBar: inTrade ? barsInTrade : 0,
        })
    }

    Object.defineProperty(wrapper, 'state', {
        get() { return innerStrategy.state },
    })

    wrapper.threshold = threshold
    wrapper.K         = K
    wrapper.minBars   = minBars
    return wrapper
}