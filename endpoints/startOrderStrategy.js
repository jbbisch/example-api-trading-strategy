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

const main = async () => {

    const { accessToken } = await requestAccessToken(
        process.env.HTTP_URL, 
        process.env.USER, 
        process.env.PASS,
        process.env.SEC,
        process.env.CID,
    )

    const accounts = await accountList(process.env.HTTP_URL + '/account/list')

    await syncSocket.connect(process.env.WS_URL, accessToken)

    const button = document.createElement('button')
    button.innerText = 'Start order.'
    button.addEventListener('click', async () => {
        const response = await syncSocket.send({
            url: 'orderStrategy/startOrderStrategy',
            body: {
                symbol: "MESH4",
                accountId: accounts[0].id,
                action: "Buy",
                orderStrategyTypeId: 2,
                params: JSON.stringify(onChart, null, 2),
            }
        })
    
        console.log(response)
    })
    
    document.body.append(button)    
}

main()
