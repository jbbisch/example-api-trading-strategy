const { LongShortMode } = require("../common/longShortMode")
const { placeOrder } = require("../../endpoints/placeOrder")
const { liquidatePosition } = require("../../endpoints/liquidatePosition")
const { TradeExcelLogger } = require("../../utils/tradingExcelLogger")
const { getFillsByOrderId, computeAvgFillPrice, extractFillTimestamp } = require("../../utils/tradovateFills")
//console.log('[onChart] placeOrder:', placeOrder)

const tradeLogger = new TradeExcelLogger({
    workbookPath: "./Trade_Pairs_Analysis.xlsx",
    sheetName: "Raw Trades",
    valuePerPoint: 5.0, //MES
    openTradePath: "./data/openTrade.json"
})

const maxPosition = 1 // 1 contract

const onChart = (prevState, {data, props}) => {
    
    const { mode, buffer, tlc, position, buyDistance, sellDistance } = prevState
    const { contract, orderQuantity } = props

    buffer.push(data)        
    const bufferData = buffer.getData()

    const now = new Date()
    
    // Update SMA only at specific intervals
    const dataPause = 1 * 60 * 1000 // 1 minute pause after processing data
    if (prevState.lastSMAUpdate && now - prevState.lastSMAUpdate < dataPause) {
        //console.log('[onChart] Waiting for next SMA update interval', prevState.lastSMAUpdate);
        return { state: prevState, effects: [] };
    }

    const chillOut = 4 * 60 * 1000 // 4 minutes pause after placing an order
    const inChillOut = prevState.lastTradeTime && (now - prevState.lastTradeTime < chillOut)

    const minutes = now.getMinutes()
    const seconds = now.getSeconds()

    if(minutes % 5 !== 0 || seconds > 30 ) { 
        //console.log('[onChart] Not a 5 minute interval - skip processing')
        return { state: prevState, effects: [] }
    } // 30 second window on every 5th minute interval to update SMA and place order
      // allows for delay in data feed and tries to avoid false signals
    
    const ORDER_TIMEOUT_MS = 15 * 1000 // 15 seconds

    const lastTlc = {
        ...tlc.state,
        ptArmed: !!prevState.ptArmed,
        ptArmedBy: prevState.ptArmedBy || null,
        ptBarsSinceArmed: prevState.ptBarsSinceArmed || 0,
        ptArmedAt: prevState.ptArmedAt || null,
        ptTriggeredAt: prevState.ptTriggeredAt || null,
        
        tradeJustEntered: !!prevState.tradeJustEntered,
        tradeEntrySignal: prevState.tradeEntrySignal || null,
        lastEntryTime: prevState.lastEntryTime || null,
    }
    prevState.lastSMAUpdate = Date.now()
    const nextTlcState = tlc(lastTlc, bufferData)
    const { negativeCrossover, positiveCrossover, distance } = nextTlcState

    const currentPositionSize =
        (typeof prevState.strategyNetPos === 'number' ? prevState.strategyNetPos : (position?.netPos || 0))

    let nextStrategyNetPos = currentPositionSize

    if (prevState.orderInFlight) {
        const nowTs = Date.now()
        const lockAge = nowTs - (prevState.orderInFlightAt ?? nowTs)

        if (lockAge > ORDER_TIMEOUT_MS) {
            //console.warn('[onChart] FAILSAFE UNLOCK:', 'OrderInFlight stuck for', lockAge, 'ms - unlocking')
            prevState = {...prevState, orderInFlight: false, orderInFlightAt: null }
        }
    }

    const canUsePositive = currentPositionSize <= 0
    const canUseNegative = currentPositionSize >= 1

    const rawNegEdge = negativeCrossover && !lastTlc.negativeCrossover
    const rawPosEdge = positiveCrossover && !lastTlc.positiveCrossover

    const ordersLocked = !!prevState.orderInFlight

    // EDGE TRIGGERING
    const negEdge = (!ordersLocked && !inChillOut && canUseNegative) ? rawNegEdge : false
    const posEdge = (!ordersLocked && !inChillOut && canUsePositive) ? rawPosEdge : false

    const longBracket = {
        qty: orderQuantity,
        profitTarget: 200, //round_s(variance/1.33), // 200 (for tick count)
        stopLoss: -80, //round_s(-variance/5), //-80 (for tick count) 
        trailingStop: false //true //false?
    }
      
    const shortBracket = {
        qty: orderQuantity,
        profitTarget: 100, //round_s(-variance/1.33), // 200 (for tick count)
        stopLoss: -40, //round_s(variance/5), //-80 (for tick count)
        trailingStop: false //true //false?
    }

    const trackDistance = (distanceArray, prevDistance, distance) => {
        if (distance !== undefined) {
            distanceArray.push({
                time: now,
                prevDistance: prevDistance,
                distance: distance
            })
            //console.log('[onChart] distanceArray:', distanceArray)
        } else {
            //console.log('[onChart] distance is undefined')
        }
    }

    const trackTrigger = (triggerArray, label) => {
        if (label) {
            const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false})
            triggerArray.push(`${timestamp} - ${label}`)
            //console.log('[onChart] trigger logged:', `${timestamp} - ${label}`)
        } else {
            //console.log('[onChart] triggerSource is undefined')
        }
    }

    const entryVersion = {
        orderQty: orderQuantity,
        orderType: "Market",
    }
    

    function isNineAMEastern() {
        const nowUTC = new Date()
        const nowET = new Date(nowUTC.toLocaleString("en-US", {timeZone: "America/New_York"}))
        return nowET.getHours() === 9 && nowET.getMinutes() === 0
    }

    function isDailyExit() {
        const nowUTC = new Date()
        const nowET = new Date(
            nowUTC.toLocaleString("en-US", { timeZone: "America/New_York" })
        )

        const day = nowET.getDay() // 0 (Sunday) to 6 (Saturday)
        const totalMinutes = nowET.getHours() * 60 + nowET.getMinutes()
        
        const isWeekday = day >= 1 && day <= 5 // Monday to Friday
        const isTime = totalMinutes >= (16 * 60 + 40) // 4:40 PM ET or later

        return isWeekday && isTime
    }

    const flattenForSession = isDailyExit()
    
    function getEasternTimeParts() {
    const nowUTC = new Date()
    const nowET = new Date(
        nowUTC.toLocaleString("en-US", { timeZone: "America/New_York" })
    )

    const day = nowET.getDay() // 0=Sun, 1=Mon, ... 5=Fri, 6=Sat
    const totalMinutes = nowET.getHours() * 60 + nowET.getMinutes()

    return { day, totalMinutes }
}

function shouldFlattenForSession() {
    const { day, totalMinutes } = getEasternTimeParts()
    return day >= 1 && day <= 5 && totalMinutes >= (16 * 60 + 40)
}

function isEntryBlockedForSessionBreak() {
    const { day, totalMinutes } = getEasternTimeParts()

    const breakStart = 16 * 60 + 40 // 4:40 PM ET
    const reopen = 18 * 60 // 6:00 PM ET

    if (day >= 1 && day <= 4) {
        return totalMinutes >= breakStart && totalMinutes < reopen
    }

    if (day === 5) {
        return totalMinutes >= breakStart
    }

    if (day === 6) {
        return true
    }

    if (day === 0) {
        return totalMinutes < reopen
    }

    return false
}

const flattenForSession = shouldFlattenForSession()
const entryBlockedForSessionBreak = isEntryBlockedForSessionBreak()

function shouldFlattenForSession() {
    const { day, totalMinutes } = getEasternTimeParts()
    const flattenStart = 16 * 60 + 40
    const reopen = 18 * 60

    if (day >= 1 && day <= 4) {
        return totalMinutes >= flattenStart && totalMinutes < reopen
    }

    if (day === 5) {
        return totalMinutes >= flattenStart
    }

    return false
}

function isEntryBlockedForSessionBreak() {
    const { day, totalMinutes } = getEasternTimeParts()
    const breakStart = 16 * 60 + 40
    const reopen = 18 * 60

    if (day >= 1 && day <= 4) {
        return totalMinutes >= breakStart && totalMinutes < reopen
    }

    if (day === 5) {
        return totalMinutes >= breakStart
    }

    if (day === 6) {
        return true
    }

    if (day === 0) {
        return totalMinutes < reopen
    }

    return false
}


    // USE DURING BEAR MARKET INSTEAD OF WATCH AND LONG ##########
    // if(mode === LongShortMode.Watch && negativeCrossover ) {
    //    if(currentPositionSize === 0) {
        //     console.log('[onChart] liquidatePosition 1:', placeOrder)
        //     console.log('[onChart] mode 1 placeOrder:', mode)
        //     prevState.lastTradeTime = Date.now()
        //     placeOrder({
        //         accountId: parseInt(process.env.ID),
        //         contractId: contract.id,
        //         admin: true,
        //         accountSpec: process.env.SPEC,
        //         deviceId: process.env.DEVICE_ID,
        //         symbol: contract.name,
        //         action: "Sell",
        //         orderQty: 1,
        //         orderType: "Market"
        //     }).then(response => {
        //         console.log('[onChart] response 1:', response)
        //         return {
        //             state: {
        //                 ...prevState,
        //                 mode: LongShortMode.Short,
        //             },
        //             effects: [
        //                  FOR WEBSOCKET Liquidates any existing position
        //                 {
        //                     url: 'order/liquidatePosition', 
        //                     data: {
        //                         accountId: parseInt(process.env.ID),
        //                         contractId: contract.id,
        //                         admin: true,
        //                         accountSpec: process.env.SPEC,
        //                         deviceId: process.env.DEVICE_ID,
        //                         symbol: contract.name,
        //                         action: "Sell",
        //                         orderQuantity: orderQuantity,
        //                     }   
        //                 },
        //                 { event: 'crossover/draw' },
        //             ],
        //         }
        //     }).catch(err => {
        //         console.error('[onChart] Error:', err)
        //     })
        // } else {
        //    console.log('[onChart] short position already exists')
        //    return { state: prevState, effects: [] }
        // }
    // }

    // USE DURING BEAR MARKET INSTEAD OF WATCH AND LONG ##########    
    // if(mode === LongShortMode.Short && positiveCrossover ) { 
        //    if(currentPositionSize < 0) {
        //     console.log('[onChart] placeOrder 4:', placeOrder)
        //     console.log('[onChart] mode 4 buyOrder:', mode)
        //     prevState.lastTradeTime = Date.now()
        //     placeOrder({
        //         accountId: parseInt(process.env.ID),
        //         contractId: contract.id,
        //         admin: true,
        //         accountSpec: process.env.SPEC,
        //         deviceId: process.env.DEVICE_ID,
        //         symbol: contract.name,
        //         action: "Buy",
        //         orderQty: 1,
        //         orderType: "Market"
        //     }).then(response => {
        //         console.log('[onChart] response 4:', response)
        //         return {
        //             state: {
        //                 ...prevState,
        //                 mode: LongShortMode.Long,
        //             },
        //             effects: [
        //                     FOR WEBSOCKET
        //                 {
        //                     url: 'orderStrategy/startOrderStrategy',
        //                     data: {
        //                         accountId: parseInt(process.env.ID),
        //                         accountSpec: process.env.SPEC,
        //                         symbol: contract.id,
        //                         action: "Buy",
        //                         orderStrategyTypeId: 2,
        //                         entryVersion: JSON.stringify(entryVersion),
        //                         brackets: JSON.stringify(longBracket),
        //                     }
        //                 },
        //                 { event: 'crossover/draw' },
        //             ],
        //         }
        //     }).catch(err => {
        //         console.error('[onChart] Error:', err)
        //     })
        // } else {
        //    console.log('[onChart] no short position to liquidate')
        //    return { state: prevState, effects: [] }
        // }    
    // }

    // USE DURING BULL MARKET INSTEAD OF WATCH AND SHORT ##########
    if ((mode === LongShortMode.Long && negEdge) || flattenForSession) {
        if(currentPositionSize >= maxPosition) {
            //console.log('[onChart] liquidatePosition 2:', placeOrder)
            //console.log('[onChart] mode 2 placeOrder:', mode)
            nextStrategyNetPos = Math.max(currentPositionSize - 1, 0)
            prevState.lastTradeTime = Date.now()
            const exitSignal =
              nextTlcState.PTbandPeakExit ? "PTbandPeak" :
              nextTlcState.SAGMncBreak ? "SGM" :
            //   nextTlcState.GapMomentumLowCrossover ? "GML" :
            //   nextTlcState.MomentumPeakNegativeCrossover ? "MP" :
            //   nextTlcState.DistancePeakNegativeCrossover ? "DP" :
            //   nextTlcState.flatMarketExitCondition ? "FME" :
              nextTlcState.DVncConfirmedBreak ? "DVC" :
              nextTlcState.LikelyNegativeCrossover ? "LNC" :
              nextTlcState.SMANegativeCrossover ? "SMA" :
              nextTlcState.NegativeBounceNegativeCrossover ? "NB" :
              nextTlcState.PositiveReversalBreakdown ? `PRB${nextTlcState.PositiveReversalBreakdownReason ? `(${nextTlcState.PositiveReversalBreakdownReason})` : ""}` :
              "SMA";
            const sellLog = [...(prevState.sellTriggerSource || [])]
            trackTrigger(sellLog, exitSignal);
            placeOrder({
                accountId: parseInt(process.env.ID),
                contractId: contract.id,
                admin: true,
                accountSpec: process.env.SPEC,
                deviceId: process.env.DEVICE_ID,
                symbol: contract.name,
                action: "Sell",
                orderQty: 1,
                orderType: "Market"
            }).then(async (response) => {
                trackDistance(sellDistance, lastTlc.distance, distance)
                console.log('[onChart] response 3:', response)

                const exitOrderId = response?.orderId ?? response?.id
                if (!exitOrderId) {
                    console.warn("[tradeLogger] No exit orderId found in response")
                    return
                }

                const baseUrl = process.env.HTTP_URL
                const accessToken = process.env.ACCESS_TOKEN

                if (!accessToken) {
                    console.warn("[TRADELOG] ACCESS_TOKEN missing")
                    return
                }

                try {
                    const row = await tradeLogger.finalizeExitAndAppend({
                        exitOrderId,
                        exitTrigger: exitSignal || "unknown",
                        exitAction: "Sell",
                        baseUrl,
                        accessToken,
                        getFillsByOrderId,
                        computeAvgFillPrice,
                        extractFillTimestamp,
                        notes: `${contract.name} qty=1`
                    })
                    console.log("[TRADELOG] appended:", row)
                }   catch (err) {
                    console.error("[TRADELOG] failed:", err?.message || err)
                }
            }).catch(err => {
                //console.error('[onChart] Error:', err)
            })
            
            tlc.state = nextTlcState
            
            return {
                state: {
                    ...prevState,
                    mode: LongShortMode.Watch,
                    strategyNetPos: nextStrategyNetPos,
                    sellTriggerSource: sellLog,
                    sellDistance: [...sellDistance],
                    orderInFlight: true,
                    orderInFlightAt: Date.now(),
                    tradeJustEntered: false,
                    lastEntryTime: null,
                    ptArmed: false,
                    ptArmedBy: null,
                    ptBarsSinceArmed: 0,
                    ptArmedAt: null,
                    ptTriggeredAt: nextTlcState.ptTriggeredAt || prevState.ptTriggeredAt || null,
                },
                effects: [
                    // FOR WEBSOCKET Liquidates any existing position
                    // {
                    //     url: 'order/liquidatePosition',
                    //     data: {
                    //         accountId: parseInt(process.env.ID),
                    //         contractId: contract.id,
                    //         admin: true,
                    //         accountSpec: process.env.SPEC,
                    //         deviceId: process.env.DEVICE_ID,
                    //         symbol: contract.name,
                    //         action: "Sell",
                    //         orderQuantity: orderQuantity,
                    //     }
                    // },
                    { event: 'crossover/draw' },
                ],
            }
        } else {
            //console.log('[onChart] no position to liquidate')
            return { state: prevState, effects: [] }
        }
    }

    // USE DURING BULL MARKET INSTEAD OF WATCH AND SHORT ##########
    if(mode === LongShortMode.Watch && posEdge && !flattenForSession) {
        if(currentPositionSize < maxPosition) { 
            //console.log('[onChart] placeOrder 3:', placeOrder)
            //console.log('[onChart] mode 3 buyOrder:', mode)  
            nextStrategyNetPos = Math.min(currentPositionSize + 1, maxPosition)
            prevState.lastTradeTime = Date.now()
            prevState.lastEntryTime = Date.now()
            const smaEdge = !!nextTlcState.SMAPositiveCrossover && !lastTlc.SMAPositiveCrossover;
            const entrySignal =
              nextTlcState.DVpcConfirmed ? "DV" :
              nextTlcState.flatMarketEntryCondition ? "FM" :
              nextTlcState.AAGMpcBreak ? "AGM" :
              smaEdge ? "SMA" :
              "SMA";
            const buyLog = [...(prevState.buyTriggerSource || [])]
            trackTrigger(buyLog, entrySignal);
            placeOrder({
                accountId: parseInt(process.env.ID),
                contractId: contract.id,
                admin: true,
                accountSpec: process.env.SPEC,
                deviceId: process.env.DEVICE_ID,
                symbol: contract.name,
                action: "Buy",
                orderQty: 1,
                orderType: "Market"
            }).then(async (response) => {
                trackDistance(buyDistance, lastTlc.distance, distance)
                console.log('[onChart] response 3:', response)
                try {
                    const entryOrderId = response?.orderId ?? response?.id;
                    if (!entryOrderId) {
                        console.warn("[tradeLogger] No entry orderId found in  response")
                        return
                    }
                    
                    tradeLogger.startEntry({
                        entryOrderId,
                        entryTrigger: entrySignal || "unknown",
                        entryAction: "Buy",
                        qty: 1,
                        symbol: contract.name,
                    })
                    console.log("[TRADELOG] entry orderId:", entryOrderId, "signal:", entrySignal)
                }   catch (e) {
                    console.warn("[tradeLogger] startEntry failed:", e?.message || e)
                }
            }).catch(err => {
                //console.error('[onChart] Error:', err)
            })
            const shouldArmPT = smaEdge

            const prevPtArmed = !!prevState.ptArmed
            const nextPtArmed = !!(shouldArmPT ? true : (prevState.ptArmed || false))
            const ptArmEdge = !prevPtArmed && nextPtArmed
            const nextPTarmCount = (prevState.PTarmCount || 0) + (ptArmEdge ? 1 : 0)
            
            tlc.state = {
              ...nextTlcState,
              ptArmed: shouldArmPT ? true : !!nextTlcState.ptArmed,
              ptArmedBy: shouldArmPT ? 'SMApc' : (nextTlcState.ptArmedBy || null),
              ptBarsSinceArmed: shouldArmPT ? 0 : (nextTlcState.ptBarsSinceArmed || 0),
              ptArmedAt: shouldArmPT ? new Date().toISOString() : (nextTlcState.ptArmedAt || null),
              ptTriggeredAt: shouldArmPT ? null : (nextTlcState.ptTriggeredAt || null),
            };

            return {
                state: {
                    ...prevState,
                    mode: LongShortMode.Long,
                    strategyNetPos: nextStrategyNetPos,
                    tradeEntrySignal: entrySignal,
                    tradeJustEntered: true,
                    lastEntryTime: Date.now(),
                    ptArmed: shouldArmPT ? true : (prevState.ptArmed || false),
                    PTarmCount: nextPTarmCount,
                    ptArmedBy: shouldArmPT ? 'SMApc' : (prevState.ptArmedBy || null),
                    ptBarsSinceArmed: shouldArmPT ? 0 : (prevState.ptBarsSinceArmed || 0),
                    ptArmedAt: shouldArmPT ? new Date().toISOString() : (prevState.ptArmedAt || null),
                    buyTriggerSource: buyLog,
                    buyDistance: [...buyDistance],
                    orderInFlight: true,
                    orderInFlightAt: Date.now(),
                },
                effects: [
                    // FOR WEBSOCKET
                    // {
                    //     url: 'orderStrategy/startOrderStrategy',
                    //     data: {
                    //         accountId: parseInt(process.env.ID),
                    //         accountSpec: process.env.SPEC,
                    //         symbol: contract.id,
                    //         action: "Buy",
                    //         orderStrategyTypeId: 2,
                    //         entryVersion: JSON.stringify(entryVersion),
                    //         brackets: JSON.stringify(longBracket),
                    //     }   
                    // },
                    { event: 'crossover/draw' },
                ],
            }
        } else {
            //console.log('[onChart] max position reached')
            return { state: prevState, effects: [] }
        }
    }
    
    tlc.state = nextTlcState

    const clearTriggers = isNineAMEastern()

    return { 
        state: {
            ...prevState,
            strategyNetPos: nextStrategyNetPos,
            tradeJustEntered: prevState.tradeJustEntered,
            tradeEntrySignal: prevState.tradeEntrySignal ?? null,
            lastEntryTime: prevState.lastEntryTime ?? null,
            buyTriggerSource: clearTriggers ? [] : [...(prevState.buyTriggerSource || []), ...(nextTlcState.buyTriggerSource || [])],
            sellTriggerSource: clearTriggers ? [] : [...(prevState.sellTriggerSource || []), ...(nextTlcState.sellTriggerSource || [])],
            buyDistance: clearTriggers ? [] : [...(prevState.buyDistance || []), ...(nextTlcState.buyDistance || [])],
            sellDistance: clearTriggers ? [] : [...(prevState.sellDistance || []), ...(nextTlcState.sellDistance || [])],
        },
        effects: [] 
    }
}

module.exports = { onChart }
