const calculatePnL = require("../../utils/calculatePnL")
const drawToConsole = require("../../utils/drawToConsole")

const drawEffect = (state, action) => {
    const [event, payload] = action

    if(event === 'crossover/draw') {
        const socketStats = global.__tsSocket?.getDebugStats?.()
        const { props } = payload
        const { contract } = props
        const { PTarmCount, product, position, mode, buffer, tlc, realizedPnL, buyDistance, sellDistance, buyTriggerSource, sellTriggerSource,} = state
        const { PTbandPeak, PTbandPeakExit, ptArmed, ptArmedBy, ptBarsSinceArmed, ptArmedAt, ptTriggeredAt, DVncConfirmedHistory, DVncConfirmedBreak, LikelyNegativeCrossoverCount, PositiveReversalBreakdownReason, prbReasonCounts, prbArmedAt, prbTriggeredAt, PRBArmCount, PRBArmCountAAGMpcBreak, AAGMpcBreakCount, SAGMncBreakCount, SAGMncBreak, slopeFlatHistory, SharpDroppingVelocityNegativeCrossoverCount, SharpDroppingVelocityNegativeCrossoverHistory, flatVelocityHistory, flatMarketEntryConditionCount, flatMarketExitConditionCount, DriftingVelocityPositiveCrossoverConfirmedCount, DriftingVelocityPositiveCrossoverHistory, DriftingVelocityNegativeCrossoverHistory, DriftingVelocityNegativeCrossoverConfirmedCount, shortSmaVelocities, longSmaVelocities, distanceVelocities, distance, shortSma, SMAPositiveCrossoverCount, SMANegativeCrossoverCount, NegativeBounceNegativeCrossoverCount, BouncePositiveCrossoverCount, updatedDistanceValley, AcceleratingAbsoluteGapMomentumCrossoverCount, longSma, distanceOpen, GapMomentumLowCrossover, gapMomentumLowCrossoverCount, absoluteGapMomentum, absoluteGapMomentums, absoluteGapMomentumDifference, absoluteGapMomentumDifferences, slowingAbsoluteGapMomentum, momentum, momentumDifferences, shortSmaValues, distanceMomentum, distanceOpenValues, distanceValues, slowingDistanceMomentum, distanceMomentumDifferences, distanceMomentumDifference, momentumPeak, distancePeak, updatedMomentumPeak, updatedDistancePeak, triggerSource, slowingMomentum, momentumDifference, slowingMomentumNegativeCrossoverCount, slowingDistanceMomentumCrossoverCount, slowingAbsoluteGapMomentumCrossoverCount, momentumPeakNegativeCrossoverCount, PositiveReversalBreakdown, PositiveReversalBreakdownCount, reversalAttemptActive, barsSinceReversalAttempt, reversalEntryDistance, minDistanceSinceReversal} = tlc.state  

        const formatDistanceArray = (distanceArray) => {
            if (!distanceArray || distanceArray.length === 0) return 'No Distance'

            const formatted = distanceArray.map(item => {
                const pre = item.prevDistance !== undefined ? item.prevDistance.toFixed(2) : 'N/A'
                const dist = item.distance !== undefined ? item.distance.toFixed(2) : 'N/A'
                return `Pre: ${pre}, Dist: ${dist}`
            })

            const rows = []
            for (let i = 0; i < formatted.length; i += 5) {
                rows.push(formatted.slice(i, i + 5).join(' | '))
            }
            return rows.join('\n')
        }

        const formattedBuyDistance = formatDistanceArray(buyDistance)
        const formattedSellDistance = formatDistanceArray(sellDistance)

        //const formattedBuyTriggers = (buyTriggerSourceArray) => {
            //return buyTriggerSourceArray && buyTriggerSourceArray.length > 0 ? buyTriggerSourceArray.join(', ') : 'No Triggers'
        //}
        //const formattedSellTriggers = (sellTriggerSourceArray) => {
            //return sellTriggerSourceArray && sellTriggerSourceArray.length > 0 ? sellTriggerSourceArray.join(', ') : 'No Triggers'
        //}

        const formatTriggerSourceArray = (arr) => {
            if (!arr || arr.length === 0) return 'No Triggers'

            const rows = []
            for (let i = 0; i < arr.length; i += 6) {
                rows.push(arr.slice(i, i + 6).join(' | '))
            }
            return rows.join('\n')
        }
        
        const boolText = (v) => v ? 'true' : 'false'

        const fmtNum = (v, digits = 2) =>
            Number.isFinite(v) ? v.toFixed(digits) : 'N/A'

        const fmtArr = (arr, digits = 4) =>
            Array.isArray(arr)
                ? arr.map(v => typeof v === 'boolean' ? (v ? 'true' : 'false') : (Number.isFinite(v) ? v.toFixed(digits) : String(v))).join(', ')
                : 'N/A'

        const buyTriggers = formatTriggerSourceArray(buyTriggerSource)
        const sellTriggers = formatTriggerSourceArray(sellTriggerSource)

        if (PositiveReversalBreakdown) {
          console.log('--- PRBnc TRIGGERED ---',
            `bars=${barsSinceReversalAttempt}`,
            `entryDist=${reversalEntryDistance.toFixed(2)}`,
            `minDist=${minDistanceSinceReversal.toFixed(2)}`
          )
        }

        drawToConsole({
            'Distance on prevClose': distanceValues.map(value => value.toFixed(2)).join(', '),
            'Distance on currentOpen': distanceOpenValues.map(value => value.toFixed(2)).join(', '),
            //AbsoluteGapMomentum: absoluteGapMomentum !== undefined ? absoluteGapMomentum.toFixed(8) : 'N/A',
            AbsoluteGapMomentums: (absoluteGapMomentums || []).map(v => v.toFixed(8)).join(', '),
            //AbsoluteGapMomentumDifference: absoluteGapMomentumDifference !== undefined ? absoluteGapMomentumDifference.toFixed(8) : 'N/A',
            //AbsoluteGapMomentumDifferences: (absoluteGapMomentumDifferences || []).map(v => v.toFixed(8)).join(', '),
            //DistanceMomentum: distanceMomentum.toFixed(8),
            //slowingDistanceMomentum: slowingDistanceMomentum.join(', '),
            //distanceMomentumDifference: distanceMomentumDifference.toFixed(8),
            //'Distance Momentum Differences': distanceMomentumDifferences.map(v => v.toFixed(8)).join(', '),
            DistanceValley: updatedDistanceValley ? updatedDistanceValley.join(', ') : 'N/A',
            DistancePeak: updatedDistancePeak ? updatedDistancePeak.join(', ') : 'N/A',
            MomentumPeak: updatedMomentumPeak ? updatedMomentumPeak.join(', ') : 'N/A',
            DVpcHistory: (DriftingVelocityPositiveCrossoverHistory || []).map(v => v ? 'true' : 'false').join(', '),
            DVncHistory: (DriftingVelocityNegativeCrossoverHistory || []).map(v => v ? 'true' : 'false').join(', '),
            DVncConfirmedHistory: (DVncConfirmedHistory || []).map(v => v ? 'true' : 'false').join(', '),
            DVncConfirmedBreak: DVncConfirmedBreak ? 'true' : 'false',
            flatVelocityHistory: flatVelocityHistory.map(v => v ? 'true' : 'false').join(', '),
            slopeFlatHistory: (slopeFlatHistory || []).map(v => v ? 'true' : 'false').join(', '),
            SDVncHistory: (SharpDroppingVelocityNegativeCrossoverHistory || []).map(v => v ? 'true' : 'false').join(', '),
            shortSmaVelocities: (shortSmaVelocities || []).map(v => v.toFixed(8)).join(", "),
            longSmaVelocities: (longSmaVelocities || []).map(v => v.toFixed(8)).join(", "),
            distanceVelocities: (distanceVelocities || []).map(v => v.toFixed(8)).join(", "),
            slowingAbsoluteGapMomentum: (slowingAbsoluteGapMomentum || []).join(', '),
            //ShortSmaMomentum: momentum.toFixed(8),
            //'Short SMA Values': shortSmaValues.map(value => value.toFixed(2)).join(', '),
            //LONGsma: longSma.toFixed(2),
            //slowingMomentum: slowingMomentum.join(', '),
            //momentumDifference: momentumDifference.toFixed(8),
            //'Momentum Differences': momentumDifferences.map(value => value.toFixed(8)).join(', '),
            // 'p&l': position && position.netPos !== 0 && product 
            //     ? `$${calculatePnL({
            //         price: buffer.last()?.price || buffer.last()?.price || 0, 
            //         contract,
            //         position,
            //         product,
            //     }).toFixed(2)}` 
            //     : '$0.00',
            buyTriggerSource: buyTriggers,
            //buyDistance: formattedBuyDistance,
            SMApcCount: SMAPositiveCrossoverCount,
            DVpcCount: DriftingVelocityPositiveCrossoverConfirmedCount,
            FMEpcCount: flatMarketEntryConditionCount,
            AAGMpcCount: AAGMpcBreakCount,
            //BpcCount: BouncePositiveCrossoverCount,
            sellTriggerSource: sellTriggers,
            //sellDistance: formattedSellDistance,
            SMAncCount: SMANegativeCrossoverCount,
            LncCount: LikelyNegativeCrossoverCount,
            DVncBCount: DriftingVelocityNegativeCrossoverConfirmedCount,
            //FMEncCount: flatMarketExitConditionCount,
            SAGMncCount: SAGMncBreakCount,
            NBncCount: NegativeBounceNegativeCrossoverCount,
            PRBncCount: PositiveReversalBreakdownCount,
            PRB: PositiveReversalBreakdown ? 'true' : 'false',
            PRBactive: reversalAttemptActive ? 'true' : 'false',
            PRBbars: barsSinceReversalAttempt,
            PRBentryDist: Number.isFinite(reversalEntryDistance) ? reversalEntryDistance.toFixed(2) : 'N/A', 
            PRBminDist: Number.isFinite(minDistanceSinceReversal) ? minDistanceSinceReversal.toFixed(2) : 'N/A',
            PRBreason: PositiveReversalBreakdownReason || '—',
            PRBcounts: prbReasonCounts ? Object.entries(prbReasonCounts).map(([k, v]) => `${k}:${v}`).join(', ') : '—',
            PRBarmedAt: prbArmedAt || '—',
            PRBtriggeredAt: prbTriggeredAt || '—',
            PRBarmCount: PRBArmCount || 0,
            PTarmed: ptArmed ? 'true' : 'false',
            PTarmedBy: ptArmedBy || '—',
            PTbars: ptBarsSinceArmed ?? 0,
            PTexit: PTbandPeakExit ? 'true' : 'false',
            PTarmedAt: ptArmedAt || '—',
            PTtriggeredAt: ptTriggeredAt || '—',
            PTarmCount: PTarmCount || 0,
            //SDVncCount: SharpDroppingVelocityNegativeCrossoverCount,
            //MPncCount: momentumPeakNegativeCrossoverCount,
            //SLMncCount: slowingMomentumNegativeCrossoverCount,
            //SDMncCount: slowingDistanceMomentumCrossoverCount,
            //GMLncCount: gapMomentumLowCrossoverCount,
            SAGMnc_signal: boolText(sellSignalDebug?.SAGMncBreak?.signal),
            SAGMnc_setupSignal: boolText(sellSignalDebug?.SAGMncBreak?.setupSignal),
            SAGMnc_distanceOk: boolText(sellSignalDebug?.SAGMncBreak?.distanceOk),
            SAGMnc_distanceValue: fmtNum(sellSignalDebug?.SAGMncBreak?.distanceValue),
            SAGMnc_slowingAbsGapWindow: fmtArr(sellSignalDebug?.SAGMncBreak?.slowingAbsGapMomentumWindow, 0),
            SAGMnc_slowingAbsGapCount: sellSignalDebug?.SAGMncBreak?.slowingAbsGapMomentumCount ?? 'N/A',
            SAGMnc_slowingAbsGapOk: boolText(sellSignalDebug?.SAGMncBreak?.slowingAbsGapMomentumOk),
            SAGMnc_distancePeakWindow: fmtArr(sellSignalDebug?.SAGMncBreak?.distancePeakWindow, 0),
            SAGMnc_distancePeakCount: sellSignalDebug?.SAGMncBreak?.distancePeakCount ?? 'N/A',
            SAGMnc_distancePeakOk: boolText(sellSignalDebug?.SAGMncBreak?.distancePeakOk),
            SAGMnc_historyWindow: fmtArr(sellSignalDebug?.SAGMncBreak?.historyWindow, 0),
            SAGMnc_prevWasTrue: boolText(sellSignalDebug?.SAGMncBreak?.prevWasTrue),
            SAGMnc_nowIsFalse: boolText(sellSignalDebug?.SAGMncBreak?.nowIsFalse),
            DVncCB_signal: boolText(sellSignalDebug?.DVncConfirmedBreak?.signal),
            DVncCB_setupSignal: boolText(sellSignalDebug?.DVncConfirmedBreak?.setupSignal),
            DVncCB_distanceOpenWindow: fmtArr(sellSignalDebug?.DVncConfirmedBreak?.distanceOpenWindow),
            DVncCB_distanceOpenOk: boolText(sellSignalDebug?.DVncConfirmedBreak?.distanceOpenWindowOk),
            DVncCB_shortVelWindow: fmtArr(sellSignalDebug?.DVncConfirmedBreak?.shortVelWindow, 8),
            DVncCB_shortVelQuietCount: sellSignalDebug?.DVncConfirmedBreak?.shortVelQuietCount ?? 'N/A',
            DVncCB_shortVelQuietOk: boolText(sellSignalDebug?.DVncConfirmedBreak?.shortVelQuietOk),
            DVncCB_longVelWindow: fmtArr(sellSignalDebug?.DVncConfirmedBreak?.longVelWindow, 8),
            DVncCB_longVelQuietCount: sellSignalDebug?.DVncConfirmedBreak?.longVelQuietCount ?? 'N/A',
            DVncCB_longVelQuietOk: boolText(sellSignalDebug?.DVncConfirmedBreak?.longVelQuietOk),
            DVncCB_distanceVelWindow: fmtArr(sellSignalDebug?.DVncConfirmedBreak?.distanceVelWindow, 8),
            DVncCB_distanceVelQuietCount: sellSignalDebug?.DVncConfirmedBreak?.distanceVelQuietCount ?? 'N/A',
            DVncCB_distanceVelQuietOk: boolText(sellSignalDebug?.DVncConfirmedBreak?.distanceVelQuietOk),
            DVncCB_dvncHistoryWindow: fmtArr(sellSignalDebug?.DVncConfirmedBreak?.dvncHistoryWindow, 0),
            DVncCB_dvncConfirmed: boolText(sellSignalDebug?.DVncConfirmedBreak?.dvncConfirmed),
            DVncCB_confirmedHistoryWindow: fmtArr(sellSignalDebug?.DVncConfirmedBreak?.confirmedHistoryWindow, 0),
            DVncCB_prevConfirmedWasTrue: boolText(sellSignalDebug?.DVncConfirmedBreak?.prevConfirmedWasTrue),
            DVncCB_nowConfirmedIsFalse: boolText(sellSignalDebug?.DVncConfirmedBreak?.nowConfirmedIsFalse),
            PRBdbg_signal: boolText(sellSignalDebug?.PositiveReversalBreakdown?.signal),
            PRBdbg_active: boolText(sellSignalDebug?.PositiveReversalBreakdown?.reversalAttemptActive),
            PRBdbg_bars: sellSignalDebug?.PositiveReversalBreakdown?.barsSinceReversalAttempt ?? 'N/A',
            PRBdbg_entryDist: fmtNum(sellSignalDebug?.PositiveReversalBreakdown?.reversalEntryDistance),
            PRBdbg_minDist: fmtNum(sellSignalDebug?.PositiveReversalBreakdown?.minDistanceSinceReversal),
            PRBdbg_armedBy: sellSignalDebug?.PositiveReversalBreakdown?.reversalArmedBy || '—',

            PRBdbg_madeLowerLow: boolText(sellSignalDebug?.PositiveReversalBreakdown?.madeLowerLow),
            PRBdbg_lowerLowThreshold: fmtNum(sellSignalDebug?.PositiveReversalBreakdown?.madeLowerLowThreshold),

            PRBdbg_shortVelLast3: fmtArr(sellSignalDebug?.PositiveReversalBreakdown?.shortVelLast3, 8),
            PRBdbg_shortVelAllNonPositive: boolText(sellSignalDebug?.PositiveReversalBreakdown?.shortVelAllNonPositive),
            PRBdbg_longVelLast3: fmtArr(sellSignalDebug?.PositiveReversalBreakdown?.longVelLast3, 8),
            PRBdbg_longVelHasBearish: boolText(sellSignalDebug?.PositiveReversalBreakdown?.longVelHasBearish),
            PRBdbg_distanceVelLast3: fmtArr(sellSignalDebug?.PositiveReversalBreakdown?.distanceVelLast3, 8),
            PRBdbg_distanceVelAllBearish: boolText(sellSignalDebug?.PositiveReversalBreakdown?.distanceVelAllBearish),
            PRBdbg_velocitiesBearish: boolText(sellSignalDebug?.PositiveReversalBreakdown?.velocitiesBearish),

            PRBdbg_touchedBandRecently: boolText(sellSignalDebug?.PositiveReversalBreakdown?.touchedLowerBandRecently),
            PRBdbg_currentPrice: fmtNum(sellSignalDebug?.PositiveReversalBreakdown?.currentPrice),
            PRBdbg_lowerBand: fmtNum(sellSignalDebug?.PositiveReversalBreakdown?.lowerBand),
            PRBdbg_bandBreakMargin: fmtNum(sellSignalDebug?.PositiveReversalBreakdown?.bandBreakMargin),
            PRBdbg_closeBelowBand: boolText(sellSignalDebug?.PositiveReversalBreakdown?.closeBelowBand),
            PRBdbg_noImprovement: boolText(sellSignalDebug?.PositiveReversalBreakdown?.noImprovement),
            PRBdbg_flatVelocity: boolText(sellSignalDebug?.PositiveReversalBreakdown?.flatVelocity),
            PRBdbg_bandRejection: boolText(sellSignalDebug?.PositiveReversalBreakdown?.bandRejection),

            PRBdbg_belowBandStreakLast4: fmtArr(sellSignalDebug?.PositiveReversalBreakdown?.belowBandStreakLast4, 0),
            PRBdbg_belowBandStreakCount: sellSignalDebug?.PositiveReversalBreakdown?.belowBandStreakCount ?? 'N/A',
            PRBdbg_bandSlopeDown: boolText(sellSignalDebug?.PositiveReversalBreakdown?.bandSlopeDown),
            PRBdbg_persistentBandRide: boolText(sellSignalDebug?.PositiveReversalBreakdown?.persistentBandRide),

            PRBdbg_maxBarsToImprove: sellSignalDebug?.PositiveReversalBreakdown?.maxBarsToImprove ?? 'N/A',
            PRBdbg_improvedTowardZero: boolText(sellSignalDebug?.PositiveReversalBreakdown?.improvedTowardZero),
            PRBdbg_timeStopFailed: boolText(sellSignalDebug?.PositiveReversalBreakdown?.timeStopFailed),
            PRBdbg_reason: sellSignalDebug?.PositiveReversalBreakdown?.reason || '—',
            Lnc_signal: boolText(sellSignalDebug?.LikelyNegativeCrossover?.signal),
            Lnc_prevDistance: fmtNum(sellSignalDebug?.LikelyNegativeCrossover?.prevDistance),
            Lnc_prevDistanceOk: boolText(sellSignalDebug?.LikelyNegativeCrossover?.prevDistanceOk),
            Lnc_currentDistance: fmtNum(sellSignalDebug?.LikelyNegativeCrossover?.currentDistance),
            Lnc_currentDistanceOk: boolText(sellSignalDebug?.LikelyNegativeCrossover?.currentDistanceOk),
            PTdbg_signal: boolText(sellSignalDebug?.PTbandPeakExit?.signal),
            PTdbg_ptArmed: boolText(sellSignalDebug?.PTbandPeakExit?.ptArmed),
            PTdbg_ptArmedBy: sellSignalDebug?.PTbandPeakExit?.ptArmedBy || '—',
            PTdbg_ptBarsSinceArmed: sellSignalDebug?.PTbandPeakExit?.ptBarsSinceArmed ?? 'N/A',
            PTdbg_ptMinBarsRequired: sellSignalDebug?.PTbandPeakExit?.ptMinBarsRequired ?? 'N/A',
            PTdbg_requireFlat: boolText(sellSignalDebug?.PTbandPeakExit?.requireFlat),
            PTdbg_flatVelocity: boolText(sellSignalDebug?.PTbandPeakExit?.flatVelocity),
            PTdbg_velocityBreakingOut: boolText(sellSignalDebug?.PTbandPeakExit?.velocityBreakingOut),
            PTdbg_ptContextOk: boolText(sellSignalDebug?.PTbandPeakExit?.ptContextOk),
            PTdbg_currentPrice: fmtNum(sellSignalDebug?.PTbandPeakExit?.currentPrice),
            PTdbg_upperBand: fmtNum(sellSignalDebug?.PTbandPeakExit?.upperBand),
            PTdbg_currentPriceAboveUpperBand: boolText(sellSignalDebug?.PTbandPeakExit?.currentPriceAboveUpperBand),
            PTdbg_ptMinBarsOk: boolText(sellSignalDebug?.PTbandPeakExit?.ptMinBarsOk),
            PTdbg_ptExpired: boolText(sellSignalDebug?.PTbandPeakExit?.ptExpired),
            mode,
            contract: contract.name,      
            netPos: position?.netPos || 0,
            realizedPnL: `$${realizedPnL.toFixed(2)}`,
            'WS pid': socketStats?.pid ?? '—',
            'WS connId': socketStats?.connId ?? '—',
            'WS listeners': socketStats?.messageListeners ?? '—',
            'WS syncAttach': socketStats?.syncAttachCount ?? '—',
            'WS reconnects': socketStats?.reconnectCalls ?? '—',
            'WS lastReconnect': socketStats?.lastReconnectAt ? new Date(socketStats.lastReconnectAt).toLocaleTimeString() : '—',
        })    
    }

    return action
}

module.exports = { drawEffect }
