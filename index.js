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

        setInterval(async () => {
            if (!isTokenValid()) {
                console.log('[index renewAccessToken] Token is nearing expiration. Renewing...')
                await renewAccessToken()
                console.log('[index renewAccessToken] Token successfully renewed.')
            }
        }, 1 * 60 * 1000)

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
    
        Strategy = await configureRobot(ALL_STRATEGIES)
        Strategy.init()

        socket.strategy = Strategy
        socket.strategyProps = Strategy.props

        //Set up reconnect handlers
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

main()

module.exports = { Strategy }
