'use strict'

/**
 * Trade efficiency exit using Kaufman's Efficiency Ratio.
 *
 *   ER = |end - start| / sum(|bar[i] - bar[i-1]|)
 *
 * 1.0 = perfectly directional move (pure trend)
 * 0.0 = no net movement despite lots of activity (pure chop)
 *
 * Two exit signals while in a Long:
 *   EffDrop     — current efficiency < exitThreshold (market went choppy)
 *   EffStagnant — peak efficiency since entry never reached minPeakEff
 *                 within stagnantBars bars (trade is in a chop regime)
 *
 * Usage (pure-functional — call on every bar while in a Long):
 *
 *   // on entry, reset state:
 *   let effState = null
 *
 *   // on each bar while Long, pass the full sliding bar buffer:
 *   effState = tradeEfficiencyStep(effState, bufferData, opts)
 *   if (effState.exitSignal) { ... exit ... }
 *
 * bufferData — array of objects with .close or .price
 * opts       — { lookback, exitThreshold, minPeakEff, stagnantBars }
 */

function calculateEfficiency(data, lookback = 10) {
    if (data.length < lookback + 1) return null

    const recent = data.slice(-lookback - 1)

    const start = recent[0].close ?? recent[0].price
    const end   = recent[recent.length - 1].close ?? recent[recent.length - 1].price

    const netMovement = Math.abs(end - start)

    let totalMovement = 0
    for (let i = 1; i < recent.length; i++) {
        const prev = recent[i - 1].close ?? recent[i - 1].price
        const curr = recent[i].close ?? recent[i].price
        totalMovement += Math.abs(curr - prev)
    }

    if (totalMovement === 0) return 0

    return netMovement / totalMovement
}

function tradeEfficiencyStep(prevState, bufferData, opts = {}) {
    const {
        lookback      = 10,    // bars used in the efficiency window
        exitThreshold = 0.25,  // exit when efficiency drops below this (chop)
        minPeakEff    = 0.40,  // minimum peak efficiency the trade should have hit
        stagnantBars  = 8,     // bars after entry before checking minPeakEff
    } = opts

    const s = prevState || { barsInTrade: 0, peakEff: 0 }
    const barsInTrade = s.barsInTrade + 1

    const efficiency = calculateEfficiency(bufferData, lookback)

    // Not enough data yet — update count, carry forward
    if (efficiency === null) {
        return { barsInTrade, peakEff: s.peakEff, efficiency: null, exitSignal: false, exitType: null }
    }

    const peakEff = Math.max(s.peakEff, efficiency)

    const effDropExit  = efficiency < exitThreshold
    const stagnantExit = barsInTrade >= stagnantBars && peakEff < minPeakEff

    const exitSignal = effDropExit || stagnantExit

    return {
        barsInTrade,
        peakEff,
        efficiency,
        effDropExit,
        stagnantExit,
        exitSignal,
        exitType: effDropExit ? 'EffDrop' : stagnantExit ? 'EffStagnant' : null,
    }
}

// How far current price is from the mean of the lookback window.
// High amplitude = price moved away from mean (trending).
// Low amplitude = price hugging the mean (choppy / stalling).
function calculateAmplitude(data, lookback = 20) {
    if (data.length < lookback) return null

    const recent = data.slice(-lookback)
    const closes = recent.map(d => d.close ?? d.price)

    const mean = closes.reduce((sum, v) => sum + v, 0) / closes.length
    const current = closes[closes.length - 1]

    return Math.abs(current - mean)
}

module.exports = { calculateEfficiency, calculateAmplitude, tradeEfficiencyStep }