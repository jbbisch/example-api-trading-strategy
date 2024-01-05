//import { getAccessToken } from "./getAccessToken"

//import { URL, credentials, params, WS_DEMO_URL } from './data'
//import { TradovateSocket } from "./socket/tvSocket"
//import { tvGet } from "./socket/services"
const { getSocket } = require('./websocket/utils')
const { requestAccessToken } = require('./endpoints/requestAccessToken')
const { TradovateSocket } = require('./websocket/TradovateSocket')
const { accountList } = require('./endpoints/accountList')
const { onChart } = require('./strategies/crossover/onChart') 

const syncSocket = new TradovateSocket({debugLabel: 'sync data'})

const startingOrderStrategy = async () => {
    console.log('[startOrderStrategy] ENDPOINT startingOrderStrategy function called')
    const { effects } = onChart
    const { url, data } = effects
    const { symbol, action, brackets, entryVersion, deviceId } = data

    const { accessToken } = await requestAccessToken(
        process.env.HTTP_URL, 
        process.env.USER, 
        process.env.PASS,
        process.env.SEC,
        process.env.CID,
    )

    const accounts = await accountList(process.env.HTTP_URL + '/account/list')

    await syncSocket.connect(process.env.WS_URL, accessToken)

    const response = await syncSocket.send({
        url: 'orderStrategy/startOrderStrategy',
        body: {
            symbol: "MESH4",
            accountId: accounts[0].id,
            action: action,
            orderStrategyTypeId: 2,
            params: JSON.stringify(data, null, 2),
        }
    })

    console.log(response)

    
    document.body.append(button)    
}

startingOrderStrategy()