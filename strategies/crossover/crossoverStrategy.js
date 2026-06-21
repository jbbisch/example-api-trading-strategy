const highLowVariance = require("../../utils/highLowVariance")
const twoLineCrossover = require("../../utils/twoLineCrossover")
const preEntryVelocityGate = require("./preEntryVelocityGate")
const persistenceExit = require("./persistenceExit")

const { DataBuffer, BarsTransformer, TicksTransformer } = require("../../utils/dataBuffer")
const { Strategy } = require("../strategy/strategy")
const { onUserSync } = require("./onUserSync")
const { onProps } = require("./onProps")
const { onChart } = require("./onChart")
const { LongShortMode } = require("../common/longShortMode")
const { drawEffect } = require("./crossoverDrawEffect")
const { onProductFound } = require("../common/onProductFound")
const { onReplayComplete } = require("./onReplayComplete")
const { TdEvent } = require("../strategy/tdEvent")



/**
 * A Simple Strategy based on two Moving Averages and their interactions.
 * Config D: bearScore<2 + ATR≥80th pct + preEntryVelocityGate(0.75) + persistenceExit(K=2)
 */
class CrossoverStrategy extends Strategy {

    constructor(props) {
        super(props)
    }

    init(props) {
        //console.log('CrossoverStrategy init() called', props)
        const { barType } = props || {};
        this.addMiddleware(drawEffect)

        const tlc_inner = twoLineCrossover(5, 10)
        const tlc_gated = preEntryVelocityGate(tlc_inner, 0.75)
        const tlc       = persistenceExit(tlc_gated, { K: 2, threshold: 0, minBars: 2 })

        return {
            mode:           LongShortMode.Watch,
            buffer:         new DataBuffer(barType === 'MinuteBar' ? BarsTransformer : TicksTransformer),
            tlc,
            //hlv:          highLowVariance(20),
            product:        null,
            position:       null,
            realizedPnL:    0,
            buyDistance:    [],
            sellDistance:   [],
            strategyNetPos: 0,
            orderInFlight:  false,
            atrHourState:   null,   // rolling hourly ATR percentile state
        }
    }

    next(prevState, [event, payload]) {
        //console.log('CrossoverStrategy next() called', event, payload)

        switch(event) {
            case TdEvent.Chart: {
                return onChart(prevState, payload)
            }

            case TdEvent.Props: {
                return onProps(prevState, payload)
            }

            case TdEvent.UserSync: {
                return onUserSync(prevState, payload)
            }

            case TdEvent.ProductFound: {
                return onProductFound('crossover', prevState, payload)
            }

            case TdEvent.ReplayComplete: {
                return onReplayComplete(prevState, payload)
            }

            default: {
                return this.catchReplaySessionsDefault(prevState, [event, payload]) || {
                    state: prevState,
                    effects: [
                        { event: 'crossover/draw' }
                    ]
                }
            }
        }
    }

    static params = {
        ...super.params,
        longPeriod:     10,
        shortPeriod:    5,
        //variancePeriod: 20,
        orderQuantity:  1,
    }
}

module.exports = { CrossoverStrategy }