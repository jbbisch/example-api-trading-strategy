const { logger } = require("./utils/globalErrorHandler")
require('dotenv').config()
const { acquireAccess } = require("./utils/acquireAccess")
const { configureRobot } = require("./utils/configureRobot")
const { CrossoverStrategy } = require("./strategies/crossover/crossoverStrategy")
const { YourCustomStrategy } = require("./strategies/yourCustomStrategy/yourCustomStrategy")
const { askForContract } = require("./utils/askForContract")
const { ReplaySocket } = require("./websocket/ReplaySocket")
const { getSocket, getMdSocket, getReplaySocket, connectSockets } = require("./websocket/utils")
const { askForReplay } = require("./utils/askForReplay")
const { PriceDisplayStrategy } = require("./strategies/priceDisplay/priceDisplayStrategy")
const { PriceDisplayStrategyFP } = require("./strategies/priceDisplayFP/priceDisplayStrategyFP")
const { RsiStrategy } = require("./strategies/rsiStrategyFP/rsiStrategy")
const { placeOrder } = require("./endpoints/placeOrder")
const { startOrderStrategy } = require("./standardMiddleware/startOrderStrategy")
const { strategy } = require("./strategies/strategy/strategy")
const { onChart } = require("./strategies/crossover/onChart")
const { isTokenValid } = require("./utils/isTokenValid")
const { renewAccessToken } = require("./endpoints/renewAccessToken")
const { chooseEnvironment } = require("./utils/chooseEnvironment")

// ---------- ONCE-ONLY BOOT GUARDS ----------
global.__BOOTED__ = global.__BOOTED__ || false
if (global.__BOOTED__) {
  console.warn('[index] Boot skipped: already booted in this process.')
  // Export whatever was set previously
} else {
  global.__BOOTED__ = true
}

// one-time token renew interval id
global.__TOKEN_RENEW_TIMER__ = global.__TOKEN_RENEW_TIMER__ || null
// one-time socket close listener guards
global.__WS_LISTENERS_WIRED__ = global.__WS_LISTENERS_WIRED__ || false
// strategy singleton
global.__STRATEGY_SINGLETON__ = global.__STRATEGY_SINGLETON__ || null
// ------------------------------------------


//ENVIRONMENT VARIABLES ---------------------------------------------------------------------------------------

//Set some process variables for ease-of-access. These values will be globally available
//through the process.env object. This is part of the configuration of the robot,
//so be sure to use the correct values here.

// - HTTP_URL can be changed to either the demo or live variant. Demo uses your 
//   demo account (if you have one)
// - USER should be your username or email used for your Trader account
// - PASS should be the password assoc with that account

process.env.HTTP_URL    = 'https://demo.tradovateapi.com/v1'
process.env.WS_URL      = 'wss://demo.tradovateapi.com/v1/websocket'
process.env.MD_URL      = 'wss://md.tradovateapi.com/v1/websocket'
process.env.REPLAY_URL  = 'wss://replay.tradovateapi.com/v1/websocket'
process.env.USER        = ''    
process.env.PASS        = '' 
process.env.SEC         = ''
process.env.CID         = 0

//END ENVIRONMENT VARIABLES -----------------------------------------------------------------------------------

const ALL_STRATEGIES = {
    'Crossover Strategy': CrossoverStrategy,
    'RSI Strategy': RsiStrategy,
    'Your Custom Strategy': YourCustomStrategy
}

//Replay times must be JSON strings!
// const REPLAY_TIMES = [
//     {
//         start: new Date(`2023-10-15T22:30`).toJSON(), //use your local time, .toJSON will transform it to universal
//         stop: new Date(`2023-10-19T22:31`).toJSON()
//     },
//     {
//         start: new Date(`2023-10-22T22:31`).toJSON(),
//         stop: new Date(`2023-10-26T22:32`).toJSON(),
//    }
// ]

let Strategy = null

/**
 * Program entry point.
 */
async function main() {
    try {
        await chooseEnvironment()
    // // // // // // // // // // // // // // // //
    // Login Section                             //
    // // // // // // // // // // // // // // // //

        await acquireAccess()

    // // // // // // // // // // // // // // // //
    // Configuration Section                     //
    // // // // // // // // // // // // // // // //

    // ---------- ONE-TIME TOKEN RENEW TIMER ----------
    if (!global.__TOKEN_RENEW_TIMER__) {
      global.__TOKEN_RENEW_TIMER__ = setInterval(async () => {
        try {
          if (!isTokenValid()) {
            console.log('[index renewAccessToken] Token nearing expiration. Renewing...')
            await renewAccessToken()
            console.log('[index renewAccessToken] Token successfully renewed.')
          }
        } catch (e) {
          console.error('[index renewAccessToken] renew failed:', e?.message || e)
        }
      }, 1 * 60 * 1000)
    }
    // -------------------------------------------------

    // const maybeReplayString = await askForReplay(REPLAY_TIMES)

    // if(maybeReplayString) {
    //     const replaySocket = getReplaySocket()
    //     await replaySocket.connect(process.env.REPLAY_URL)
    // } else {
            const socket = getSocket()
            const mdSocket = getMdSocket()

            await Promise.all([
                socket.connect(process.env.WS_URL),
                mdSocket.connect(process.env.MD_URL)
            ])
    // }
    
        // ---------- STRATEGY SINGLETON ----------
        if (!global.__STRATEGY_SINGLETON__) {
          global.__STRATEGY_SINGLETON__ = await configureRobot(ALL_STRATEGIES)
          global.__STRATEGY_SINGLETON__.init()
        }
        Strategy = global.__STRATEGY_SINGLETON__
        // ---------------------------------------

        socket.strategy = Strategy
        socket.strategyProps = Strategy.props

        // ---------- ONE-TIME RECONNECT LISTENERS ----------
        if (!global.__WS_LISTENERS_WIRED__) {
          global.__WS_LISTENERS_WIRED__ = true

          socket.ws.addEventListener('close', async () => {
            console.warn('[index] Socket closed. Attempting to reconnect...')
            await socket.reconnect()
            console.log('[index] Socket reconnected.')
          })

          mdSocket.ws.addEventListener('close', async () => {
            console.warn('[index] Market Data Socket closed. Attempting to reconnect...')
            await mdSocket.connect(process.env.MD_URL)
            console.log('[index] Market Data Socket reconnected.')
          })
        }
        // --------------------------------------------------
        
    } catch (error) {
        logger.error({message: error.message, stack: error.stack, error})
    }
        
    //COMMENT ABOVE, UNCOMMENT BELOW you want to parameterize the strategy here instead of via console.
    
    // let contract1 = await askForContract()

    // while(!contract1) {
    //     contract1 = await askForContract(true)
    // }

    // const rsi = new RsiStrategy({
    //     contract: contract1,
    //     barType: 'MinuteBar',
    //     barInterval: 30,
    //     elementSizeUnit: 'UnderlyingUnits',
    //     histogram: false,
    //     timeRangeType: 'asMuchAsElements',
    //     timeRangeValue: 14,
    //     dev_mode: !!maybeReplayString,
    //     replay_periods: REPLAY_TIMES,
    //     period: 14,
    //     orderQuantity: 1,
    // })

    // const display = new PriceDisplayStrategyFP({
    //     contract: contract1,
    //     barType: 'MinuteBar',
    //     barInterval: 5,
    //     elementSizeUnit: 'UnderlyingUnits',
    //     histogram: false,
    //     timeRangeType: 'asMuchAsElements',
    //     timeRangeValue: 20,
    //     dev_mode: !!maybeReplayString,
    //     replay_periods: REPLAY_TIMES
    // })    
}

if (global.__BOOTED__) main()

module.exports = { Strategy: global.__STRATEGY_SINGLETON__ }
