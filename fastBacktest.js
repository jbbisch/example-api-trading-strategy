// fastBacktest.js
// Fetches historical 5-min bars via the live MD socket (no replay clock),
// then processes them all at once through twoLineCrossover to produce
// data/backtest.csv in seconds instead of hours.
//
// Usage:
//   node fastBacktest.js
//
// ── REQUIRED: fill in your credentials below before running ─────────────────
// Copy USER / PASS / SEC / CID from your local index.js.
// These are intentionally blank in the repo — never commit your real values.

require('dotenv').config()
const fs     = require('fs')
const path   = require('path')

const WebSocket               = require('ws')
const twoLineCrossover        = require('./utils/twoLineCrossover')
const { chooseEnvironment }   = require('./utils/chooseEnvironment')
const requestAccessToken      = require('./endpoints/requestAccessToken')

// ── Credentials ──────────────────────────────────────────────────────────────
// MD_URL is the same for both demo and live — chooseEnvironment() sets HTTP_URL.
process.env.MD_URL    = 'wss://md.tradovateapi.com/v1/websocket'
process.env.USER      = 'JudeRufus'   // ← YOUR Tradovate username / email
process.env.PASS      = 'Rufusdufus18'   // ← YOUR password
process.env.SEC       = '59cafc50-d93f-49ff-931f-12d70e8de41a'   // ← YOUR app secret
process.env.CID       = '2162'   // ← YOUR client ID (number)
// ────────────────────────────────────────────────────────────────────────────

const MISSING = ['USER','PASS','SEC','CID'].filter(k => !process.env[k])
if (MISSING.length) {
    console.error(`\n[fastBacktest] Missing credentials: ${MISSING.join(', ')}`)
    console.error('  Open fastBacktest.js and fill in your USER / PASS / SEC / CID')
    console.error('  (copy the values from the matching lines in your local index.js)\n')
    process.exit(1)
}

// ── Backtest parameters ──────────────────────────────────────────────────────
// Each segment covers one quarterly contract for the dates it was front-month.
// Roll dates are approximate (1 week before expiration). Adjust as needed.
// MES contract codes: H=March  M=June  U=September  Z=December
// Tradovate uses single-digit year: MESM6 = June 2026, MESZ3 = Dec 2023, etc.
const SEGMENTS = [
    { symbol: 'MESU3', start: '2023-01-03T14:30:00.000Z', end: '2023-09-08T20:00:00.000Z' },
    { symbol: 'MESZ3', start: '2023-09-09T13:30:00.000Z', end: '2023-12-08T21:00:00.000Z' },
    { symbol: 'MESH4', start: '2023-12-09T14:30:00.000Z', end: '2024-03-08T21:00:00.000Z' },
    { symbol: 'MESM4', start: '2024-03-09T13:30:00.000Z', end: '2024-06-14T20:00:00.000Z' },
    { symbol: 'MESU4', start: '2024-06-15T13:30:00.000Z', end: '2024-09-13T20:00:00.000Z' },
    { symbol: 'MESZ4', start: '2024-09-14T13:30:00.000Z', end: '2024-12-13T21:00:00.000Z' },
    { symbol: 'MESH5', start: '2024-12-14T14:30:00.000Z', end: '2025-03-14T20:00:00.000Z' },
    { symbol: 'MESM5', start: '2025-03-15T13:30:00.000Z', end: '2025-06-13T20:00:00.000Z' },
    { symbol: 'MESU5', start: '2025-06-14T13:30:00.000Z', end: '2025-09-12T20:00:00.000Z' },
    { symbol: 'MESZ5', start: '2025-09-13T13:30:00.000Z', end: '2025-12-12T21:00:00.000Z' },
    { symbol: 'MESH6', start: '2025-12-13T14:30:00.000Z', end: '2026-03-13T20:00:00.000Z' },
    { symbol: 'MESM6', start: '2026-03-14T13:30:00.000Z', end: '2026-06-19T20:00:00.000Z' },
]

const OUT_FILE = path.join(process.cwd(), 'data', 'backtest.csv')
// ────────────────────────────────────────────────────────────────────────────

// Direct WebSocket implementation — avoids TradovateSocket's race condition where
// connect() resolves on the raw 'open' event before SockJS auth completes,
// causing getChart to be sent before the MD server has authenticated the session.
function fetchSegment({ symbol, start, end }) {
    return new Promise((resolve, reject) => {
        const ws   = new WebSocket(process.env.MD_URL)
        const bars = []
        let settled     = false
        let authenticated = false
        let reqId       = 1
        let heartbeat   = null

        const finish = (err) => {
            if (settled) return
            settled = true
            clearInterval(heartbeat)
            try { ws.terminate() } catch (_) {}
            err ? reject(err) : resolve(bars)
        }

        ws.on('open', () => {
            // Keep the connection alive with SockJS heartbeats
            heartbeat = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) ws.send('[]')
            }, 2500)
        })

        ws.on('message', (raw) => {
            const msg  = raw.toString()
            const kind = msg[0]

            if (kind === 'o') {
                // SockJS session open — authenticate with MD token only (not ACCESS_TOKEN)
                ws.send(`authorize\n0\n\n${process.env.MD_ACCESS_TOKEN}`)

            } else if (kind === 'a') {
                let items
                try { items = JSON.parse(msg.slice(1)) } catch (_) { return }

                // Log raw server messages so we can see auth/getChart responses
                console.log(`  [DBG ${symbol}] server msg: ${msg.slice(0, 400)}`)

                items.forEach(item => {
                    // Auth success response
                    if (item.i === 0) {
                        if (item.s !== 200) {
                            console.error(`  [${symbol}] AUTH FAILED — status ${item.s}: ${JSON.stringify(item.d ?? '')}`)
                            finish(null)
                            return
                        }
                    }

                    if (!authenticated && item.i === 0 && item.s === 200) {
                        authenticated = true
                        // Use only asFarAsTimestamp — closestTimestamp is not supported
                        // on the MD socket. We filter to [start, end] after receipt.
                        ws.send(`md/getChart\n${reqId}\n\n${JSON.stringify({
                            symbol,
                            chartDescription: {
                                underlyingType:  'MinuteBar',
                                elementSize:     5,
                                elementSizeUnit: 'UnderlyingUnits',
                                withHistograms:  false,
                            },
                            timeRange: {
                                asFarAsTimestamp: start,
                            },
                        })}`)
                        return
                    }

                    // Init response to our getChart request (i === reqId)
                    if (item.i === reqId) {
                        if (item.s !== 200) {
                            console.error(`\n  [${symbol}] getChart rejected — status ${item.s}: ${JSON.stringify(item.d ?? '')}`)
                            finish(null)  // skip segment, don't crash the whole run
                        }
                        // s === 200: subscription established, bars will follow as chart events
                        return
                    }

                    // Chart data events
                    if (item.e === 'chart' && item.d?.charts) {
                        item.d.charts.forEach(chart => {
                            if (chart.bars && chart.bars.length > 0) {
                                // Filter to bars within this segment's date window
                                const inRange = chart.bars.filter(b => {
                                    const ts = new Date(b.timestamp)
                                    return ts >= new Date(start) && ts <= new Date(end)
                                })
                                bars.push(...inRange)
                                process.stdout.write(`\r  ${symbol}: ${bars.length} bars   `)
                            }
                            if (chart.eoh) {
                                process.stdout.write('\n')
                                finish(null)
                            }
                        })
                    }
                })

            } else if (kind === 'c') {
                finish(null)
            }
            // 'h' heartbeat frames are ignored
        })

        ws.on('error', (err) => {
            console.error(`\n  [${symbol}] WebSocket error: ${err.message}`)
            finish(null)  // skip segment on error
        })
        ws.on('close', (code) => {
            if (!settled) {
                process.stdout.write('\n')
                if (bars.length > 0) {
                    console.log(`  [closed ${code}] ${symbol}: using ${bars.length} bars collected.`)
                } else {
                    console.warn(`  [${symbol}] closed with code ${code} and 0 bars — segment skipped.`)
                }
                finish(null)
            }
        })

        // Safety timeout
        setTimeout(() => {
            if (!settled) {
                process.stdout.write('\n')
                console.log(`  [timeout] ${symbol}: using ${bars.length} bars collected so far.`)
                finish(null)
            }
        }, 3 * 60 * 1000)
    })
}

async function fetchAllSegments() {
    const allBars = []
    for (const seg of SEGMENTS) {
        console.log(`[fetch] ${seg.symbol}  ${seg.start.slice(0, 10)} → ${seg.end.slice(0, 10)}`)
        const bars = await fetchSegment(seg)
        allBars.push(...bars)
        console.log(`  done: ${bars.length} bars (running total: ${allBars.length})`)
    }
    return allBars
}

// Session-break helpers that use bar timestamp instead of wall clock
function getETTimeParts(barTs) {
    const etStr = new Date(barTs).toLocaleString('en-US', { timeZone: 'America/New_York' })
    const et    = new Date(etStr)
    return { day: et.getDay(), totalMinutes: et.getHours() * 60 + et.getMinutes() }
}

function isEntryBlocked(barTs) {
    const { day, totalMinutes } = getETTimeParts(barTs)
    const breakStart = 16 * 60 + 40
    const reopen     = 18 * 60
    if (day >= 1 && day <= 4) return totalMinutes >= breakStart && totalMinutes < reopen
    if (day === 5)            return totalMinutes >= breakStart
    if (day === 6)            return true
    if (day === 0)            return totalMinutes < reopen
    return false
}

function shouldFlatten(barTs) {
    const { day, totalMinutes } = getETTimeParts(barTs)
    const flattenStart = 16 * 60 + 40
    const reopen       = 18 * 60
    if (day >= 1 && day <= 4) return totalMinutes >= flattenStart && totalMinutes < reopen
    if (day === 5)            return totalMinutes >= flattenStart
    return false
}

function writeCsv(rows) {
    const dir = path.dirname(OUT_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const header = 'timestamp,open,high,low,close,volume,positiveCrossover,negativeCrossover,entrySignal,exitSignal,distance,longSmaVelocity,distanceVelocity\n'
    const lines  = rows.map(r =>
        [
            r.timestamp,
            r.open,
            r.high,
            r.low,
            r.close,
            r.volume          != null ? r.volume          : '',
            r.positiveCrossover !== '' ? r.positiveCrossover : '',
            r.negativeCrossover !== '' ? r.negativeCrossover : '',
            r.entrySignal,
            r.exitSignal,
            r.distance        != null ? r.distance        : '',
            r.longSmaVelocity != null ? r.longSmaVelocity : '',
            r.distanceVelocity!= null ? r.distanceVelocity: '',
        ].join(',')
    )
    fs.writeFileSync(OUT_FILE, header + lines.join('\n') + '\n')
    console.log(`[csv] Wrote ${rows.length} rows → ${OUT_FILE}`)
}

async function runBacktest() {
    await chooseEnvironment()
    await requestAccessToken()
    // fall back to ACCESS_TOKEN for MD socket if mdAccessToken wasn't returned
    if (!process.env.MD_ACCESS_TOKEN) {
        process.env.MD_ACCESS_TOKEN = process.env.ACCESS_TOKEN
    }

    const rawBars = await fetchAllSegments()

    if (rawBars.length === 0) {
        console.error('[backtest] No bars received. Check symbol names, date ranges, and credentials.')
        process.exit(1)
    }

    // Deduplicate by timestamp and sort chronologically
    const seen = new Set()
    const bars = rawBars
        .map(b => ({ ...b, timestamp: new Date(b.timestamp) }))
        .filter(b => {
            const key = b.timestamp.toISOString()
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
        .sort((a, b) => a.timestamp - b.timestamp)

    console.log(`[backtest] Processing ${bars.length} bars (deduped)...`)

    const tlc = twoLineCrossover(5, 10)

    const MAX_BUFFER = 200  // keeps memory bounded; TLC only needs ~20 bars of lookback
    const slidingBuffer = []

    let mode = 'Watch'  // 'Watch' or 'Long'
    const rows = []

    for (const bar of bars) {
        slidingBuffer.push(bar)
        if (slidingBuffer.length > MAX_BUFFER) slidingBuffer.shift()

        const prevTlcState  = tlc.state
        const nextTlcState  = tlc(prevTlcState, slidingBuffer)

        const posEdge = nextTlcState.positiveCrossover && !prevTlcState.positiveCrossover
        const negEdge = nextTlcState.negativeCrossover && !prevTlcState.negativeCrossover
        const smaEdge = !!nextTlcState.SMAPositiveCrossover && !prevTlcState.SMAPositiveCrossover

        const entryBlocked = isEntryBlocked(bar.timestamp)
        const flatten      = shouldFlatten(bar.timestamp)

        let willEnter    = false
        let willExit     = false
        let entrySignal  = ''
        let exitSignal   = ''

        if (mode === 'Watch' && posEdge && !entryBlocked) {
            willEnter   = true
            mode        = 'Long'
            entrySignal =
                nextTlcState.DVpcConfirmed           ? 'DV'  :
                nextTlcState.flatMarketEntryCondition ? 'FM'  :
                nextTlcState.AAGMpcBreak              ? 'AGM' :
                smaEdge                               ? 'SMA' : 'SMA'
        } else if (mode === 'Long' && (negEdge || flatten)) {
            willExit    = true
            mode        = 'Watch'
            exitSignal  =
                nextTlcState.PTbandPeakExit            ? 'PTbandPeak' :
                nextTlcState.SAGMncBreak               ? 'SGM'        :
                nextTlcState.DVncConfirmedBreak        ? 'DVC'        :
                nextTlcState.LikelyNegativeCrossover   ? 'LNC'        :
                nextTlcState.SMANegativeCrossover      ? 'SMA'        :
                nextTlcState.NegativeBounceNegativeCrossover ? 'NB'   :
                nextTlcState.PositiveReversalBreakdown
                    ? `PRB${nextTlcState.PositiveReversalBreakdownReason ? `(${nextTlcState.PositiveReversalBreakdownReason})` : ''}`
                    : 'SMA'
        }

        // Pull last velocity values from the arrays (scalar for CSV)
        const lvArr = nextTlcState.longSmaVelocities
        const dvArr = nextTlcState.distanceVelocities
        const longSmaVelocity  = lvArr && lvArr.length ? lvArr[lvArr.length - 1] : null
        const distanceVelocity = dvArr && dvArr.length ? dvArr[dvArr.length - 1] : null

        rows.push({
            timestamp:          bar.timestamp.toISOString(),
            open:               bar.open,
            high:               bar.high,
            low:                bar.low,
            close:              bar.close,
            volume:             bar.volume,
            positiveCrossover:  willEnter ? true : '',
            negativeCrossover:  willExit  ? true : '',
            entrySignal,
            exitSignal,
            distance:           nextTlcState.distance,
            longSmaVelocity,
            distanceVelocity,
        })
    }

    const entries = rows.filter(r => r.positiveCrossover === true).length
    const exits   = rows.filter(r => r.negativeCrossover === true).length
    console.log(`[backtest] Complete. ${entries} entries, ${exits} exits across ${bars.length} bars.`)

    writeCsv(rows)
    process.exit(0)
}

runBacktest().catch(err => {
    console.error('[backtest] Fatal error:', err?.message || err)
    process.exit(1)
})