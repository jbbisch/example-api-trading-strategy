const { calculateSma } = require("./helpers")
const { calculateSmaOpen } = require("./helpers")

module.exports = function twoLineCrossover(shortPeriod, longPeriod) {
    function nextTLC(prevState, data) {
        const { timestamp, open, high, low, close } = data
        const newData = [ ...data].sort((a, b) => a.timestamp - b.timestamp)

        const pick = d => (d.close ?? d.price) // prefer close, else price

        const shortSma = newData.slice(-shortPeriod)
          .reduce((sum, d) => sum + pick(d), 0) / shortPeriod

        const longSma = newData.slice(-longPeriod)
          .reduce((sum, d) => sum + pick(d), 0) / longPeriod

        const twentySma = newData.slice(-20)
          .reduce((sum, d) => sum + pick(d), 0) / 20

        const shortSmaOpen = newData.slice(-shortPeriod)
          .reduce((sum, d) => sum + (d.open ?? d.price), 0) / shortPeriod

        const longSmaOpen = newData.slice(-longPeriod)
          .reduce((sum, d) => sum + (d.open ?? d.price), 0) / longPeriod

        const distance = shortSma - longSma
        const currentPrice = newData[newData.length - 1].close || newData[newData.length - 1].price

        const updatedLongSmaValues = [...prevState.longSmaValues.slice(1), longSma]
        const meanLongSma = updatedLongSmaValues.reduce((sum, val) => sum + val, 0) / updatedLongSmaValues.length
        const stdDevLongSma = Math.sqrt(
            updatedLongSmaValues.reduce((sum, val) => sum + Math.pow(val - meanLongSma, 2), 0) / updatedLongSmaValues.length
        )

        const longSmaSlope = []
        for (let i = 1; i < updatedLongSmaValues.length; i ++) {
            const slope = updatedLongSmaValues[i] - updatedLongSmaValues[i - 1]
            longSmaSlope.push(slope)
        }

        const baselineSlopes = longSmaSlope.slice(0, 3)
        const meanSlope = baselineSlopes.reduce((sum, val) => sum + val, 0) / baselineSlopes.length
        const stdDevSlope = Math.sqrt(
            baselineSlopes.reduce((sum, val) => sum + Math.pow(val - meanSlope, 2), 0) / baselineSlopes.length
        )

        const recentSlopes = longSmaSlope.slice(-3)
        const slopeFlat = recentSlopes.every(slope => Math.abs(slope - meanSlope) <= stdDevSlope * 1.05)
        const updatedSlopeFlatHistory = [...prevState.slopeFlatHistory.slice(1), slopeFlat]

        const updatedTwentySmaValues = [...prevState.twentySmaValues.slice(1), twentySma]
        const meanTwentySma = updatedTwentySmaValues.reduce((sum, val) => sum + val, 0) / updatedTwentySmaValues.length
        const stdDevTwentySma = Math.sqrt(
            updatedTwentySmaValues.reduce((sum, val) => sum + Math.pow(val - meanTwentySma, 2), 0) / updatedTwentySmaValues.length
        )

        const shortSmaVelocity = (shortSma - prevState.prevShortSma) / (prevState.prevShortSma || 1);
        const longSmaVelocity = (longSma - prevState.prevLongSma) / (prevState.prevLongSma || 1);
        const distanceVelocity = (distance - prevState.prevDistance) / (Math.abs(prevState.prevDistance) || 1);

        const updatedShortSmaVelocities = [...prevState.shortSmaVelocities.slice(1), shortSmaVelocity]
        const updatedLongSmaVelocities = [...prevState.longSmaVelocities.slice(1), longSmaVelocity]
        const updatedDistanceVelocities = [...prevState.distanceVelocities.slice(1), distanceVelocity]

        const longSmaReady = updatedLongSmaValues.length >= 10 && updatedLongSmaValues.filter(v => v !== 0).length >= 7
        const flatVelocity = longSmaReady && updatedLongSmaVelocities.slice(-10).filter(v => Math.abs(v) < 0.00009000).length >= 7
        const velocityBreakingOut = updatedLongSmaVelocities.slice(-3).some(v => Math.abs(v) >= 0.00009000)

        const updatedFlatVelocityHistory = [...prevState.flatVelocityHistory.slice(1), flatVelocity]

        const distanceOpen = shortSmaOpen - longSmaOpen

        const now = new Date().toLocaleTimeString('en-US', { hour12: false})

        // Calculate momentum over the last 4 periods plus the current period
        const updatedShortSmaValues = [...prevState.shortSmaValues.slice(1), shortSma]
        const momentum = updatedShortSmaValues.reduce((sum, value, index, arr) => {
            if (index === 0) return sum
            return sum + (arr[index - 1] !== 0 ? (value - arr[index - 1]) / arr[index - 1] : 0)
        }, 0) / (updatedShortSmaValues.length - 1)

        const momentumDifference = momentum - prevState.prevMomentum
        const updatedMomentumDifferences = [...(prevState.momentumDifferences || []). slice(1), momentumDifference]
        const slowingMomentum = momentumDifference < prevState.momentumDifference
        const updatedSlowingMomentum = [...prevState.slowingMomentum.slice(1), slowingMomentum]

        const updatedDistanceOpenValues = [...prevState.distanceOpenValues.slice(1), distanceOpen]

        const updatedDistanceValues = [...prevState.distanceValues.slice(1), distance]
        const distanceMomentumSum = updatedDistanceValues.reduce((sum, value, index, arr) => {
            if (index === 0 || arr[index - 1] === 0) return sum
            return sum + (value - arr[index - 1]) / arr[index - 1]
            }, 0) 
        const distanceMomentumCount = updatedDistanceValues.reduce((count, value, index, arr) => {
            if (index === 0 || arr[index - 1] === 0) return count
            return count + 1
        }, 0)
        const distanceMomentum = distanceMomentumSum / (distanceMomentumCount || 1)

        const absDistanceValues = updatedDistanceValues.map(value => Math.abs(value))

        let absoluteGapMomentum = 0

        if (absDistanceValues.length > 1 && absDistanceValues.every(v => typeof v === 'number')) {
            const absoluteGapMomentumSum = absDistanceValues.reduce((sum, value, index, arr) => {
                if (index === 0 || arr[index - 1] === 0) return sum
                return sum + (value - arr[index - 1]) / arr[index - 1]
            }, 0)
            const absoluteGapMomentumCount = absDistanceValues.reduce((count, value, index, arr) => {
                if (index === 0 || arr[index - 1] === 0) return count
                return count + 1
            }, 0)
            absoluteGapMomentum = absoluteGapMomentumSum / (absoluteGapMomentumCount || 1)
        }

        const updatedAbsoluteGapMomentums = [...(prevState.absoluteGapMomentums || []).slice(1), absoluteGapMomentum]
        const absoluteGapMomentumDifference = absoluteGapMomentum - prevState.prevAbsoluteGapMomentum
        const updatedAbsoluteGapMomentumDifferences = [...(prevState.absoluteGapMomentumDifferences || []).slice(1), absoluteGapMomentumDifference]
        const slowingAbsoluteGapMomentum = absoluteGapMomentumDifference < prevState.absoluteGapMomentumDifference
        const updatedSlowingAbsoluteGapMomentum = [...(prevState.slowingAbsoluteGapMomentum || []).slice(1), slowingAbsoluteGapMomentum]

        const distanceMomentumDifference = distanceMomentum - prevState.prevDistanceMomentum
        const updatedDistanceMomentumDifferences = [...(prevState.distanceMomentumDifferences || []). slice(1), distanceMomentumDifference]
        const slowingDistanceMomentum = distanceMomentumDifference < prevState.distanceMomentumDifference
        const updatedSlowingDistanceMomentum = [...(prevState.slowingDistanceMomentum || []).slice(1), slowingDistanceMomentum]

        const momentumPeak = prevState.momentum > prevState.prevMomentum && momentum < prevState.momentum
        const distancePeak = prevState.distanceMomentum > prevState.prevDistanceMomentum && distanceMomentum < prevState.distanceMomentum
        const distanceValley = prevState.distanceMomentum < prevState.prevDistanceMomentum && distanceMomentum > prevState.distanceMomentum

        const updatedMomentumPeak = [...prevState.updatedMomentumPeak.slice(1), momentumPeak]
        if (updatedMomentumPeak.length > 10) updatedMomentumPeak.shift()
        const updatedDistancePeak = [...prevState.updatedDistancePeak.slice(1), distancePeak]
        if (updatedDistancePeak.length > 10) updatedDistancePeak.shift()
        const updatedDistanceValley = [...prevState.updatedDistanceValley.slice(1), distanceValley]
        if (updatedDistanceValley.length > 10) updatedDistanceValley.shift()

        const slowingMomentumNegativeCrossoverCount = prevState.slowingMomentumNegativeCrossoverCount || 0
        //const slowingDistanceMomentumCrossoverCount = prevState.slowingDistanceMomentumCrossoverCount || 0
        const momentumPeakNegativeCrossoverCount = prevState.momentumPeakNegativeCrossoverCount || 0
        const slowingAbsoluteGapMomentumCrossoverCount = prevState.slowingAbsoluteGapMomentumCrossoverCount || 0
        const gapMomentumLowCrossoverCount = prevState.gapMomentumLowCrossoverCount || 0
        const SMANegativeCrossoverCount = prevState.SMANegativeCrossoverCount || 0
        const SMAPositiveCrossoverCount = prevState.SMAPositiveCrossoverCount || 0
        const AcceleratingAbsoluteGapMomentumCrossoverCount = prevState.AcceleratingAbsoluteGapMomentumCrossoverCount || 0
        const BouncePositiveCrossoverCount = prevState.BouncePositiveCrossoverCount || 0
        const NegativeBounceNegativeCrossoverCount = prevState.NegativeBounceNegativeCrossoverCount || 0
        const DriftingVelocityNegativeCrossoverConfirmedCount = prevState.DriftingVelocityNegativeCrossoverConfirmedCount || 0
        const DriftingVelocityNegativeCrossoverCount = prevState.DriftingVelocityNegativeCrossoverCount || 0
        const DriftingVelocityPositiveCrossoverConfirmedCount = prevState.DriftingVelocityPositiveCrossoverConfirmedCount || 0
        const DriftingVelocityPositiveCrossoverCount = prevState.DriftingVelocityPositiveCrossoverCount || 0
        const flatMarketEntryConditionCount = prevState.flatMarketEntryConditionCount || 0
        const flatMarketExitConditionCount = prevState.flatMarketExitConditionCount || 0
        const SharpDroppingVelocityNegativeCrossoverCount = prevState.SharpDroppingVelocityNegativeCrossoverCount || 0
        const AAGMpcBreakCount = prevState.AAGMpcBreakCount || 0
        const SAGMncBreakCount = prevState.SAGMncBreakCount || 0
        const PositiveReversalBreakdownCount = prevState.PositiveReversalBreakdownCount || 0
        const LikelyNegativeCrossoverCount = prevState.LikelyNegativeCrossoverCount || 0

        const SMAPositiveCrossover = (prevState.shortSma <= prevState.longSma && distance > 0.00)
        const AcceleratingAbsoluteGapMomentumCrossover = (distanceOpen < -2.70 && updatedSlowingAbsoluteGapMomentum.slice(-5).filter(v => v).length >= 3 && updatedDistanceValley.slice(-3).filter(v => v).length >= 1)
        const updatedAAGMpcHistory = [...prevState.AcceleratingAbsoluteGapMomentumCrossoverHistory.slice(1), AcceleratingAbsoluteGapMomentumCrossover]
        const AAGMpcBreak = updatedAAGMpcHistory.length >= 2 && updatedAAGMpcHistory[updatedAAGMpcHistory.length - 2] === true && updatedAAGMpcHistory[updatedAAGMpcHistory.length - 1] === false
        const BouncePositiveCrossover = false //(prevState.distanceOpen > 0.50 && distanceOpen < 3.50 && (prevState.shortSmaValues.slice(-4).every((val, i, arr) => i === 0 || val > arr[i - 1]))) // - prevState.shortSma) > 1.25)
        const DriftingVelocityPositiveCrossover = (updatedDistanceOpenValues.slice(-3).every(v => v < 0.00 && v > -2.50)) && updatedShortSmaVelocities.slice(-5).filter(v => Math.abs(v) < 0.0012).length >= 3 && updatedLongSmaVelocities.slice(-5).filter(v => Math.abs(v) < 0.0012).length >= 3 && updatedDistanceVelocities.slice(-5).filter(v => Math.abs(v) < 0.25).length >= 3
        const updatedDVpcHistory = [...prevState.DriftingVelocityPositiveCrossoverHistory.slice(1), DriftingVelocityPositiveCrossover]
        const DVpcConfirmed = updatedDVpcHistory.slice(-4).every(v => v === true)
        const flatMarketEntryCondition = (distanceOpen < 0.00 && flatVelocity && !velocityBreakingOut && currentPrice <= twentySma - 1.3 * stdDevTwentySma)
        const positiveCrossover = SMAPositiveCrossover || AAGMpcBreak || BouncePositiveCrossover || flatMarketEntryCondition || DVpcConfirmed
        
        // ---------- Positive Reversal Breakdown monitor (for positive longs started in negative distance) ----------
                // ---- PRBnc ARM/DISARM IMPROVEMENTS ----
        const PRB_ARM = {
          allowSMApc: false,
          allowAAGMpcBreak: true,
          allowDVpcConfirmed: true,
          allowFlatMarketEntry: true
        };

        const armedBy = {
          SMApc:  SMAPositiveCrossover,
          AAGMpc: AAGMpcBreak,
          DVpcC:  DVpcConfirmed,
          FMEpc:  flatMarketEntryCondition,
        };

        const canArmSignal =
          (PRB_ARM.allowSMApc && armedBy.SMApc) ||
          (PRB_ARM.allowAAGMpcBreak && armedBy.AAGMpc) ||
          (PRB_ARM.allowDVpcConfirmed && armedBy.DVpcC) ||
          (PRB_ARM.allowFlatMarketEntry && armedBy.FMEpc);

        // Bearish context: any TWO of these means we’re still “underwater-ish”
        const bearFlags = {
          negDistance:        distance < 0,
          negDistanceOpen:    distanceOpen < 0,
          priceBelowLong:     currentPrice < longSma,
          belowBandHalfSigma: currentPrice <= (twentySma - 0.5 * stdDevTwentySma),
        };
        const bearScore = Object.values(bearFlags).filter(Boolean).length;
        const canArmContext = bearScore >= 2;

        // prior state...
        let reversalAttemptActive    = !!prevState.reversalAttemptActive;
        let barsSinceReversalAttempt = reversalAttemptActive ? (prevState.barsSinceReversalAttempt + 1) : 0;
        let reversalEntryDistance    = prevState.reversalEntryDistance;
        let minDistanceSinceReversal = prevState.minDistanceSinceReversal;
        let reversalArmedBy          = prevState.reversalArmedBy || null;

        let prbArmedAtLocal
        let prbTriggeredAtLocal
        let updatedPRBArmCount
        let updatedPositiveReversalBreakdownReason
        let updatedPrbReasonCounts

        // Arm once; ignore additional positive crossovers while active
        if (!reversalAttemptActive && canArmSignal && canArmContext) {
          reversalAttemptActive    = true;
          barsSinceReversalAttempt = 0;
          reversalEntryDistance    = distanceOpen;  // snapshot
          minDistanceSinceReversal = distanceOpen;
          reversalArmedBy          = armedBy.SMApc ? 'SMApc'
                                : armedBy.AAGMpc ? 'AAGMpc'
                                : armedBy.DVpcC  ? 'DVpcC'
                                : armedBy.FMEpc  ? 'FMEpc'
                                : 'unknown';
          prbArmedAtLocal = new Date().toISOString()
          updatedPRBArmCount = (prevState.PRBArmCount || 0) + 1
        }

        // (B) Track the worst (most negative) distance since arming
        if (reversalAttemptActive) {
          minDistanceSinceReversal = Math.min(minDistanceSinceReversal, distanceOpen);
        }

        // (C) Evaluate drop/failure conditions
        const PRB_CFG = {
          improvementThresholdPct: 0.30,
          maxBarsToImprove: 8,
          velEps: 0.00030,
          distVelEps: 0.12,
          newLowSlack: 0.15,
          bandSigma: 1.0
        };

        const improvedTowardZero = reversalAttemptActive
          ? Math.abs(distanceOpen) <= Math.abs(reversalEntryDistance) * (1 - PRB_CFG.improvementThresholdPct)
          : false;

        const madeLowerLow = reversalAttemptActive
          ? (distanceOpen < (minDistanceSinceReversal - PRB_CFG.newLowSlack))
          : false;

        const velocitiesBearish = reversalAttemptActive &&
          updatedShortSmaVelocities.slice(-3).every(v => v <= 0) &&
          updatedLongSmaVelocities.slice(-3).some(v => v < -PRB_CFG.velEps) &&
          updatedDistanceVelocities.slice(-3).every(v => v <= -PRB_CFG.distVelEps);

         // ——— Band helpers ———
        const lowerBand = twentySma - PRB_CFG.bandSigma * stdDevTwentySma;

        // require a decisive close below the band (not just a touch)
        const bandBreakMargin = 0.15; // tweakable: points/ticks
        const closeBelowBand = currentPrice <= (lowerBand - bandBreakMargin);

        // “touched” lower band recently?
        const touchedLowerBand = currentPrice <= lowerBand;
        const updatedTouchedLowerBandHistory = [
          ...(prevState.touchedLowerBandHistory || Array(5).fill(false)).slice(1),
          touchedLowerBand
        ];

        // “rail ride” (staying below band) streak
        const belowBandNow = currentPrice <= lowerBand;
        const updatedBelowBandStreak = [
          ...(prevState.belowBandStreak || Array(4).fill(false)).slice(1),
          belowBandNow
        ];

        // improvement toward zero since arming? (avoid firing PRB too early)
        const noImprovement =
          barsSinceReversalAttempt >= 2 &&
          Math.abs(distanceOpen) >= Math.abs(reversalEntryDistance) * (1 - 0.15); // 15% improvement required

        // rejection behavior = touched recently + decisive close + no improvement + not flat
        const bandRejection =
          reversalAttemptActive &&
          updatedTouchedLowerBandHistory.slice(-3).some(Boolean) &&
          closeBelowBand &&
          noImprovement &&
          !flatVelocity;

        // persistent “rail ride”: ≥3 of last 4 bars below band AND long SMA sloping down
        const bandSlopeDown = updatedLongSmaValues.slice(-3)
          .every((v, i, a) => (i === 0 ? true : v < a[i - 1]));

        const persistentBandRide =
          updatedBelowBandStreak.slice(-4).filter(Boolean).length >= 3 &&
          bandSlopeDown;

        const timeStopFailed = reversalAttemptActive &&
          (barsSinceReversalAttempt >= PRB_CFG.maxBarsToImprove) &&
          !improvedTowardZero;

        // (D) Breakdown fires ONLY if armed
        const PositiveReversalBreakdown = reversalAttemptActive && (
          madeLowerLow || velocitiesBearish || bandRejection || timeStopFailed || persistentBandRide
        );

        if (PositiveReversalBreakdown && !prevState.PositiveReversalBreakdown) {
          const reasons = [];
          if (madeLowerLow)       reasons.push('newLow');
          if (velocitiesBearish)  reasons.push('bearishVelocity');
          if (bandRejection)      reasons.push('bandRejection');
          if (persistentBandRide) reasons.push('bandRide')
          if (timeStopFailed)     reasons.push('timeStop');

        const prbReasonCounts = { ...(prevState.prbReasonCounts || {}) }
        for (const r of reasons) prbReasonCounts[r] = (prbReasonCounts[r] || 0) + 1

          prbTriggeredAtLocal = new Date().toISOString()
          updatedPositiveReversalBreakdownReason = reasons.join('|')
          updatedPrbReasonCounts = prbReasonCounts

          console.log(
            '[PRBnc TRADE]',
            `reasons=${updatedPositiveReversalBreakdownReason}`,
            `armedBy=${reversalArmedBy || 'n/a'}`,
            `armedAt=${prevState.prbArmedAt || prbArmedAtLocal || 'n/a'}`,
            `triggeredAt=${prbTriggeredAtLocal}`,
            `bars=${barsSinceReversalAttempt}`,
            `entryDist=${Number.isFinite(reversalEntryDistance) ? reversalEntryDistance.toFixed(2) : 'N/A'}`,
            `minDist=${Number.isFinite(minDistanceSinceReversal) ? minDistanceSinceReversal.toFixed(2) : 'N/A'}`,
            `distOpen=${Number.isFinite(distanceOpen) ? distanceOpen.toFixed(2) : 'N/A'}`
      
          );
        }

                // Success escape: require broader improvement (any TWO of THREE)
        const escapeScore = [
          distanceOpen >= 0,
          distance     >= 0,
          currentPrice >= longSma,
        ].filter(Boolean).length;

        let resetReversal = false;
        if (reversalAttemptActive && escapeScore >= 2) {   // success, no trade
          resetReversal = true;
        }
        if (PositiveReversalBreakdown) {                   // failure, trade fires
          resetReversal = true;
        }

        if (resetReversal) {
          reversalAttemptActive    = false;
          barsSinceReversalAttempt = 0;
          reversalEntryDistance    = 0;
          minDistanceSinceReversal = 0;
          reversalArmedBy          = null;
        }
        // ---------- end PRB monitor ----------
        
        const SMANegativeCrossover = (prevState.shortSmaOpen >= prevState.longSmaOpen && distanceOpen < 0.00)
        const NegativeBounceNegativeCrossover = (prevState.distanceOpen >= -0.32 && distanceOpen < -0.32)
        const LikelyNegativeCrossover = (prevState.distance > 0.28 && distance < 0.31)
        const SlowingAbsoluteGapMomentumCrossover = (distance > 2.65 && updatedSlowingAbsoluteGapMomentum.slice(-5).filter(v => v).length >= 3 && updatedDistancePeak.slice(-3).filter(v => v).length >= 1)
        const updatedSAGMncHistory = [...prevState.SlowingAbsoluteGapMomentumCrossoverHistory.slice(1), SlowingAbsoluteGapMomentumCrossover]
        const SAGMncBreak = updatedSAGMncHistory.length >= 2 && updatedSAGMncHistory[updatedSAGMncHistory.length - 2] === true && updatedSAGMncHistory[updatedSAGMncHistory.length - 1] === false
        const SlowingMomentumNegativeCrossover = false //(distance > 2.70 && updatedSlowingMomentum.slice(-5).filter(v => v).length >= 3 && updatedDistancePeak.slice(-3).filter(v => v).length >= 1)
        const BigDistancePullback = false //(prevState.distance > 4.00 && distance < 4.00) || (prevState.distance > 3.00 && distance < 3.00)
        const GapMomentumLowCrossover = false //(distance < 2.70 && momentumPeak === true && updatedAbsoluteGapMomentums.slice(-4).every(v => v > 0.00) && updatedAbsoluteGapMomentums.slice(-4).every(v => v < 0.90485211))
        const MomentumPeakNegativeCrossover = false //(distance > 0.00 && distance < 2.70 && momentumPeak === true && updatedSlowingAbsoluteGapMomentum.slice(-6).filter(v => v).length >= 4)
        const DistancePeakNegativeCrossover = false //(distance < 2.70 && distancePeak === true)
        const DriftingVelocityNegativeCrossover = (updatedDistanceOpenValues.slice(-3).every(v => v > 0.00 && v < 2.50)) && updatedShortSmaVelocities.slice(-5).filter(v => Math.abs(v) < 0.0012).length >= 3 && updatedLongSmaVelocities.slice(-5).filter(v => Math.abs(v) < 0.0012).length >= 3 && updatedDistanceVelocities.slice(-5).filter(v => Math.abs(v) < 0.25).length >= 3
        const updatedDVncHistory = [...prevState.DriftingVelocityNegativeCrossoverHistory.slice(1), DriftingVelocityNegativeCrossover]
        const DVncConfirmed = updatedDVncHistory.slice(-3).every(v => v === true)
        const updatedDVncConfirmedHistory = [...(prevState.DVncConfirmedHistory || Array(3).fill(false)).slice(1), DVncConfirmed]
        const DVncConfirmedBreak = updatedDVncConfirmedHistory.length >= 2 && updatedDVncConfirmedHistory[updatedDVncConfirmedHistory.length - 2] === true && updatedDVncConfirmedHistory[updatedDVncConfirmedHistory.length - 1] === false
        const flatMarketExitCondition = false //(distanceOpen > 0.00 && flatVelocity && !velocityBreakingOut && currentPrice >= twentySma + stdDevTwentySma)
        const SharpDroppingVelocityNegativeCrossover = false //(updatedLongSmaVelocities.slice(-1).every(v => v <= -0.00010000) && distance < -0.32)
        const updatedSharpDroppingVelocityNegativeCrossoverHistory = [...prevState.SharpDroppingVelocityNegativeCrossoverHistory.slice(1), SharpDroppingVelocityNegativeCrossover]
        const negativeCrossover = SMANegativeCrossover || LikelyNegativeCrossover ||SAGMncBreak || GapMomentumLowCrossover || NegativeBounceNegativeCrossover || SlowingMomentumNegativeCrossover || MomentumPeakNegativeCrossover || DVncConfirmedBreak || flatMarketExitCondition || DistancePeakNegativeCrossover || SharpDroppingVelocityNegativeCrossover || PositiveReversalBreakdown
        

        const updatedAcceleratingAbsoluteGapMomentumCrossoverCount = AcceleratingAbsoluteGapMomentumCrossover ? AcceleratingAbsoluteGapMomentumCrossoverCount + 1 : AcceleratingAbsoluteGapMomentumCrossoverCount
        const updatedSMANegativeCrossoverCount = SMANegativeCrossover ? SMANegativeCrossoverCount + 1 : SMANegativeCrossoverCount
        const updatedSMAPositiveCrossoverCount = SMAPositiveCrossover ? SMAPositiveCrossoverCount + 1 : SMAPositiveCrossoverCount
        const updatedSlowingMomentumNegativeCrossoverCount = SlowingMomentumNegativeCrossover ? slowingMomentumNegativeCrossoverCount + 1 : slowingMomentumNegativeCrossoverCount
        //const updatedSlowingDistanceMomentumCrossoverCount = SlowingDistanceMomentumCrossover ? slowingDistanceMomentumCrossoverCount + 1 : slowingDistanceMomentumCrossoverCount
        const updatedSlowingAbsoluteGapMomentumCrossoverCount = SlowingAbsoluteGapMomentumCrossover ? slowingAbsoluteGapMomentumCrossoverCount + 1 : slowingAbsoluteGapMomentumCrossoverCount
        const updatedGapMomentumLowCrossoverCount = GapMomentumLowCrossover ? gapMomentumLowCrossoverCount + 1 : gapMomentumLowCrossoverCount
        const updatedMomentumPeakNegativeCrossoverCount = MomentumPeakNegativeCrossover ? momentumPeakNegativeCrossoverCount + 1 : momentumPeakNegativeCrossoverCount
        const updatedBouncePositiveCrossoverCount = BouncePositiveCrossover ? BouncePositiveCrossoverCount + 1 : BouncePositiveCrossoverCount
        const updatedNegativeBounceNegativeCrossoverCount = NegativeBounceNegativeCrossover ? NegativeBounceNegativeCrossoverCount + 1 : NegativeBounceNegativeCrossoverCount
        const updatedDriftingVelocityNegativeCrossoverCount = DriftingVelocityNegativeCrossover ? DriftingVelocityNegativeCrossoverCount + 1 : DriftingVelocityNegativeCrossoverCount
        const updatedDVncConfirmedCount = DVncConfirmedBreak ? DriftingVelocityNegativeCrossoverConfirmedCount + 1 : DriftingVelocityNegativeCrossoverConfirmedCount
        const updatedDriftingVelocityPositiveCrossoverCount = DriftingVelocityPositiveCrossover ? DriftingVelocityPositiveCrossoverCount + 1 : DriftingVelocityPositiveCrossoverCount
        const updatedDVpcConfirmedCount = DVpcConfirmed ? DriftingVelocityPositiveCrossoverConfirmedCount + 1 : DriftingVelocityPositiveCrossoverConfirmedCount
        const updatedFlatMarketEntryConditionCount = flatMarketEntryCondition ? flatMarketEntryConditionCount + 1 : flatMarketEntryConditionCount
        const updatedFlatMarketExitConditionCount = flatMarketExitCondition ? flatMarketExitConditionCount + 1 : flatMarketExitConditionCount
        const updatedSharpDroppingVelocityNegativeCrossoverCount = SharpDroppingVelocityNegativeCrossover ? SharpDroppingVelocityNegativeCrossoverCount + 1 : SharpDroppingVelocityNegativeCrossoverCount
        const updatedSAGMncBreakCount = SAGMncBreak ? SAGMncBreakCount + 1 : SAGMncBreakCount
        const updatedAAGMpcBreakCount = AAGMpcBreak ? AAGMpcBreakCount + 1 : AAGMpcBreakCount
        const updatedPositiveReversalBreakdownCount = PositiveReversalBreakdown ? PositiveReversalBreakdownCount + 1 : PositiveReversalBreakdownCount
        const updatedLikelyNegativeCrossoverCount = LikelyNegativeCrossover ? LikelyNegativeCrossoverCount + 1 : LikelyNegativeCrossoverCount

        const buyTriggerSource = [...(prevState.TriggerSource || [])]
        const sellTriggerSource = [...(prevState.TriggerSource || [])]

        if (positiveCrossover) {
            if (SMAPositiveCrossover) buyTriggerSource.push(`${now} - SMApc`)
            if (AAGMpcBreak) buyTriggerSource.push(`${now} - AAGMpc`)
            if (BouncePositiveCrossover) buyTriggerSource.push(`${now} - Bpc`)
            if (flatMarketEntryCondition) buyTriggerSource.push(`${now} - FMEpc`)
            //if (DriftingVelocityPositiveCrossover) buyTriggerSource.push(`${now} - DVpc`)
            if (DVpcConfirmed) buyTriggerSource.push(`${now} - DVpcC`)
        }
        if (negativeCrossover) {
            if (SMANegativeCrossover) sellTriggerSource.push(`${now} - SMAnc`)
            if (SAGMncBreak) sellTriggerSource.push(`${now} - SAGMnc`)
            if (NegativeBounceNegativeCrossover) sellTriggerSource.push(`${now} - NBnc`)
            //if (SlowingMomentumNegativeCrossover) sellTriggerSource.push(`${now} - SLMnc`)
            //if (GapMomentumLowCrossover) sellTriggerSource.push(`${now} - GMLnc`)
            //if (BigDistancePullback) sellTriggerSource.push(`${now} - BigDistancePullback`)
            //if (MomentumPeakNegativeCrossover) sellTriggerSource.push(`${now} - MPnc`)
            //if (DistancePeakNegativeCrossover) sellTriggerSource.push(`${now} - DPnc`)
            //if (DriftingVelocityNegativeCrossover) sellTriggerSource.push(`${now} - DVnc`)
            if (DVncConfirmedBreak) sellTriggerSource.push(`${now} - DVncCB`)
            //if (flatMarketExitCondition) sellTriggerSource.push(`${now} - FMEnc`)
            if (SharpDroppingVelocityNegativeCrossover) sellTriggerSource.push(`${now} - SDVnc`)
            if (PositiveReversalBreakdown) {
                const tag = (typeof updatedPositiveReversalBreakdownReason !== 'undefined')
                  ? updatedPositiveReversalBreakdownReason
                  : (prevState.PositiveReversalBreakdownReason || '')
                sellTriggerSource.push(`${now} - PRBnc${tag ? '(' + tag + ')' : ''}`)
            }
            if (LikelyNegativeCrossover) sellTriggerSource.push(`${now} - Lnc`)
        }

        const next = {
            shortSma: shortSma,
            longSma: longSma,
            twentySma: twentySma,
            twentySmaValues: updatedTwentySmaValues,
            stdDevTwentySma: stdDevTwentySma,
            distance: distance,
            distanceOpen: distanceOpen,
            shortSmaOpen: shortSmaOpen,
            longSmaOpen: longSmaOpen,
            positiveCrossover: positiveCrossover,
            negativeCrossover: negativeCrossover,
            SMAPositiveCrossoverCount: updatedSMAPositiveCrossoverCount,
            SMANegativeCrossoverCount: updatedSMANegativeCrossoverCount,
            momentum: momentum,
            MomentumPeakNegativeCrossover: MomentumPeakNegativeCrossover,
            momentumPeakNegativeCrossoverCount: updatedMomentumPeakNegativeCrossoverCount,
            momentumDifferences: updatedMomentumDifferences,
            momentumDifference: momentumDifference,
            NegativeBounceNegativeCrossover: NegativeBounceNegativeCrossover,
            //LikelyNegativeCrossover: LikelyNegativeCrossover,
            SlowingMomentumNegativeCrossover: SlowingMomentumNegativeCrossover,
            slowingMomentumNegativeCrossoverCount: updatedSlowingMomentumNegativeCrossoverCount,
            //SlowingDistanceMomentumCrossover: SlowingDistanceMomentumCrossover,
            //slowingDistanceMomentumCrossoverCount: updatedSlowingDistanceMomentumCrossoverCount,
            slowingMomentum: updatedSlowingMomentum,
            distanceMomentum: distanceMomentum,
            absoluteGapMomentum: absoluteGapMomentum,
            absoluteGapMomentums: updatedAbsoluteGapMomentums,
            absoluteGapMomentumDifference: absoluteGapMomentumDifference,
            absoluteGapMomentumDifferences: updatedAbsoluteGapMomentumDifferences,
            slowingAbsoluteGapMomentum: updatedSlowingAbsoluteGapMomentum,
            SAGMncBreak: SAGMncBreak,
            SAGMncBreakCount: updatedSAGMncBreakCount,
            SlowingAbsoluteGapMomentumCrossoverHistory: updatedSAGMncHistory,
            SlowingAbsoluteGapMomentumCrossover: SlowingAbsoluteGapMomentumCrossover,
            slowingAbsoluteGapMomentumCrossoverCount: updatedSlowingAbsoluteGapMomentumCrossoverCount,
            AAGMpcBreak: AAGMpcBreak,
            AAGMpcBreakCount: updatedAAGMpcBreakCount,
            AcceleratingAbsoluteGapMomentumCrossoverHistory: updatedAAGMpcHistory,
            AcceleratingAbsoluteGapMomentumCrossover: AcceleratingAbsoluteGapMomentumCrossover,
            AcceleratingAbsoluteGapMomentumCrossoverCount: updatedAcceleratingAbsoluteGapMomentumCrossoverCount,
            BouncePositiveCrossover: BouncePositiveCrossover,
            NegativeBounceNegativeCrossover: NegativeBounceNegativeCrossover,
            BouncePositiveCrossoverCount: updatedBouncePositiveCrossoverCount,  
            NegativeBounceNegativeCrossoverCount: updatedNegativeBounceNegativeCrossoverCount,
            updatedDistanceValley: updatedDistanceValley,
            GapMomentumLowCrossover: GapMomentumLowCrossover,
            gapMomentumLowCrossoverCount: updatedGapMomentumLowCrossoverCount,
            prevAbsoluteGapMomentum: absoluteGapMomentum,
            distanceMomentumDifferences: updatedDistanceMomentumDifferences,
            distanceMomentumDifference: distanceMomentumDifference,
            slowingDistanceMomentum: updatedSlowingDistanceMomentum,
            shortSmaValues: updatedShortSmaValues,
            distanceValues: updatedDistanceValues,
            distanceOpenValues: updatedDistanceOpenValues,
            prevMomentum: prevState.momentum,
            prevDistanceMomentum: prevState.distanceMomentum,
            momentumPeak: momentumPeak,
            distancePeak: distancePeak,
            updatedMomentumPeak: updatedMomentumPeak,
            updatedDistancePeak: updatedDistancePeak,
            buyTriggerSource: buyTriggerSource,
            sellTriggerSource: sellTriggerSource,
            shortSmaVelocities: updatedShortSmaVelocities,
            longSmaVelocities: updatedLongSmaVelocities,
            distanceVelocities: updatedDistanceVelocities,
            prevShortSma: shortSma,
            prevLongSma: longSma,
            prevDistance: distance,
            DVncConfirmed: DVncConfirmed,
            DVncConfirmedHistory: updatedDVncConfirmedHistory,
            DVncConfirmedBreak: DVncConfirmedBreak,
            DriftingVelocityNegativeCrossover: DriftingVelocityNegativeCrossover,
            DriftingVelocityNegativeCrossoverCount: updatedDriftingVelocityNegativeCrossoverCount,
            DriftingVelocityNegativeCrossoverHistory: updatedDVncHistory,
            DriftingVelocityNegativeCrossoverConfirmedCount: updatedDVncConfirmedCount,
            DriftingVelocityPositiveCrossover: DriftingVelocityPositiveCrossover,
            DriftingVelocityPositiveCrossoverCount: updatedDriftingVelocityPositiveCrossoverCount,
            DriftingVelocityPositiveCrossoverHistory: updatedDVpcHistory,
            DriftingVelocityPositiveCrossoverConfirmedCount: updatedDVpcConfirmedCount,
            longSmaValues: updatedLongSmaValues,
            stdDevLongSma: stdDevLongSma,
            flatVelocity: flatVelocity,
            flatVelocityHistory: updatedFlatVelocityHistory,
            flatMarketExitCondition: flatMarketExitCondition,
            flatMarketEntryCondition: flatMarketEntryCondition,
            flatMarketEntryConditionCount: updatedFlatMarketEntryConditionCount,
            flatMarketExitConditionCount: updatedFlatMarketExitConditionCount,
            meanSlope: meanSlope,
            slopeFlat: slopeFlat,
            slopeFlatHistory: updatedSlopeFlatHistory,
            stdDevSlope: stdDevSlope,
            SharpDroppingVelocityNegativeCrossover: SharpDroppingVelocityNegativeCrossover,
            SharpDroppingVelocityNegativeCrossoverCount: updatedSharpDroppingVelocityNegativeCrossoverCount,
            SharpDroppingVelocityNegativeCrossoverHistory: updatedSharpDroppingVelocityNegativeCrossoverHistory,
            reversalAttemptActive: reversalAttemptActive,
            barsSinceReversalAttempt: barsSinceReversalAttempt,
            reversalEntryDistance: reversalEntryDistance,
            minDistanceSinceReversal: minDistanceSinceReversal,
            PositiveReversalBreakdown: PositiveReversalBreakdown,
            PositiveReversalBreakdownCount: updatedPositiveReversalBreakdownCount,
            reversalArmedBy: reversalArmedBy,
            PRBArmCount: (typeof updatedPRBArmCount === 'number') ? updatedPRBArmCount : (prevState.PRBArmCount || 0),
            prbArmedAt: (typeof prbArmedAtLocal !== 'undefined') ? prbArmedAtLocal : (resetReversal ? null : (prevState.prbArmedAt || null)),
            prbTriggeredAt: (typeof prbTriggeredAtLocal !== 'undefined') ? prbTriggeredAtLocal : (prevState.prbTriggeredAt || null),
            PositiveReversalBreakdownReason: (typeof updatedPositiveReversalBreakdownReason !== 'undefined')
                ? updatedPositiveReversalBreakdownReason
                : (prevState.PositiveReversalBreakdownReason || null),
            prbReasonCounts: (typeof updatedPrbReasonCounts !== 'undefined')
                ? updatedPrbReasonCounts
                : (prevState.prbReasonCounts || { newLow: 0, bearishVelocity: 0, bandRejection: 0, timeStop: 0, bandRide: 0 }),
            touchedLowerBandHistory: updatedTouchedLowerBandHistory,
            belowBandStreak: updatedBelowBandStreak,
            LikelyNegativeCrossover: LikelyNegativeCrossover,
            LikelyNegativeCrossoverCount: updatedLikelyNegativeCrossoverCount,
        }

        console.log('Updating state with new SMA values: Previous State - Short SMA: ', prevState.shortSma, ' Long SMA: ', prevState.longSma, ' Distance: ', prevState.distance, ' Current State - Short SMA: ', next.shortSma, ' Long SMA: ', next.longSma, ' Distance: ', next.distance, ' Positive Crossover: ', next.positiveCrossover, ' Negative Crossover: ', next.negativeCrossover, ' Momentum: ', next.momentum, ' Distance Momentum: ', next.distanceMomentum, 'MomentumPeak: ', next.momentumPeak, 'DistancePeak: ', next.distancePeak, 'Updated Momentum Peak: ', next.updatedMomentumPeak, 'Updated Distance Peak: ', next.updatedDistancePeak)

        nextTLC.state = next

        return next
    }

    nextTLC.init = () => {
        nextTLC.state = {
            shortSma: 0,
            longSma: 0,
            twentySma: 0,
            twentySmaValues: Array(20).fill(0), // Initialize with an array of 20 zeros
            stdDevTwentySma: 0,
            distance: 0,
            distanceOpen: 0,
            shortSmaOpen: 0,
            longSmaOpen: 0,
            positiveCrossover: false,
            negativeCrossover: false,
            SMAPositiveCrossoverCount: 0,
            SMANegativeCrossoverCount: 0,
            momentum: 0,
            distanceMomentum: 0,
            distanceMomentumDifferences: Array(5).fill(0), // Initialize with an array of 5 zeros
            distanceMomentumDifference: 0,
            slowingDistanceMomentum: Array(5).fill(false), // Initialize with an array of 6 falses
            shortSmaValues: Array(5).fill(0), // Initialize with an array of 5 zeros
            distanceValues: Array(5).fill(0), // Initialize with an array of 5 zeros
            distanceOpenValues: Array(5).fill(0), // Initialize with an array of 5 zeros
            prevMomentum: 0,
            prevDistanceMomentum: 0,
            momentumPeak: false,
            momentumPeakNegativeCrossoverCount: 0,
            distancePeak: false,
            updatedMomentumPeak: Array(3).fill(false), // Initialize with an array of 5 falses
            updatedDistancePeak: Array(3).fill(false), // Initialize with an array of 6 falses
            buyTriggerSource: [],
            sellTriggerSource: [],                                                                                                        
            momentumDifference: 0,
            momentumDifferences: Array(5).fill(0), // Initialize with an array of 5 zeros
            slowingMomentum: Array(5).fill(false), // Initialize with an array of 6 falses
            slowingMomentumNegativeCrossoverCount: 0,
            //slowingDistanceMomentumCrossoverCount: 0,
            absoluteGapMomentum: 0,
            absoluteGapMomentums: Array(5).fill(0), // Initialize with an array of 5 zeros
            absoluteGapMomentumDifference: 0,
            absoluteGapMomentumDifferences: Array(5).fill(0), // Initialize with an array of 5 zeros
            slowingAbsoluteGapMomentum: Array(5).fill(false), // Initialize with an array of 6 falses
            slowingAbsoluteGapMomentumCrossoverCount: 0,
            SAGMncHistory: Array(3).fill(false), // Initialize with an array of 5 falses
            SAGMncBreakCount: 0,
            SlowingAbsoluteGapMomentumCrossoverHistory: Array(3).fill(false), // Initialize with an array of 5 falses
            AAGMpcHistory: Array(3).fill(false), // Initialize with an array of 5 falses
            AAGMpcBreakCount: 0,
            AcceleratingAbsoluteGapMomentumCrossoverHistory: Array(3).fill(false), // Initialize with an array of 5 falses
            AcceleratingAbsoluteGapMomentumCrossoverCount: 0,
            BouncePositiveCrossoverCount: 0,
            NegativeBounceNegativeCrossoverCount: 0,
            distanceValley: false,
            updatedDistanceValley: Array(3).fill(false), // Initialize with an array of 5 falses
            prevAbsoluteGapMomentum: 0,
            gapMomentumLowCrossoverCount: 0,
            shortSmaVelocities: Array(10).fill(0),
            longSmaVelocities: Array(10).fill(0),
            distanceVelocities: Array(10).fill(0),
            prevShortSma: 0,
            prevLongSma: 0,
            prevDistance: 0,
            DVncConfirmedHistory: Array(3).fill(false),
            DVncConfirmed: false,
            DVncConfirmedBreak: false,
            DriftingVelocityNegativeCrossover: false,
            DriftingVelocityNegativeCrossoverCount: 0,
            DriftingVelocityNegativeCrossoverHistory: Array(3).fill(false),
            DriftingVelocityNegativeCrossoverConfirmedCount: 0,
            DriftingVelocityPositiveCrossover: false,
            DriftingVelocityPositiveCrossoverCount: 0,
            DriftingVelocityPositiveCrossoverHistory: Array(3).fill(false),
            DriftingVelocityPositiveCrossoverConfirmedCount: 0,
            longSmaValues: Array(10).fill(0),
            stdDevLongSma: 0,
            flatVelocity: false,
            flatVelocityHistory: Array(5).fill(false),
            flatMarketExitCondition: false,
            flatMarketEntryCondition: false,
            flatMarketEntryConditionCount: 0,
            flatMarketExitConditionCount: 0,
            meanSlope: 0,
            slopeFlat: false,
            slopeFlatHistory: Array(5).fill(false),
            stdDevSlope: 0,
            SharpDroppingVelocityNegativeCrossover: false,
            SharpDroppingVelocityNegativeCrossoverCount: 0,
            SharpDroppingVelocityNegativeCrossoverHistory: Array(5).fill(false),
            reversalAttemptActive: false,
            reversalEntryDistance: 0,
            barsSinceReversalAttempt: 0,
            minDistanceSinceReversal: 0,
            PositiveReversalBreakdown: false,
            PositiveReversalBreakdownCount: 0,
            reversalArmedBy: null,
            PRBArmCount: 0,
            prbArmedAt: null,
            prbTriggeredAt: null,
            PositiveReversalBreakdownReason: null,
            prbReasonCounts: { newLow: 0, bearishVelocity: 0, bandRejection: 0, timeStop: 0, bandRide: 0 },
            touchedLowerBandHistory: Array(5).fill(false),
            belowBandStreak: Array(4).fill(false),
            LikelyNegativeCrossover: false,
            LikelyNegativeCrossoverCount: 0,
        }
    }

    nextTLC.init()

    return nextTLC
}
