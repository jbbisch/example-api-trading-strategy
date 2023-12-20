const { getSocket, getReplaySocket } = require("../websocket/utils")
const { onChart } = require("../strategies/crossover/onChart")

const startOrderStrategy = (state, action) => {

    const [event, payload] = action
    //console.log('entry action', action)

    if(event === 'orderStrategy/startOrderStrategy') {
        const { data, props } = payload
        const { dev_mode } = props
        const { accountId, accountSpec, symbol, action, brackets, entryVersion } = data
        console.log('Payload', payload)
        //console.log('symbol', symbol)
        //console.log('action', action)
        //console.log('brackets', brackets)
        //console.log('entryVersion', entryVersion)

        const socket = dev_mode ? getReplaySocket() : getSocket()

        const orderData = {
            entryVersion: entryVersion,
            brackets: brackets,
        }
        console.log('orderData', orderData)
        console.log(JSON.stringify(orderData, null, 2))
        
        const body = {
            accountId: accountId,
            accountSpec: accountSpec,
            symbol: symbol,
            action: action,
            orderStrategyTypeId: 2,
            isAutomated: true,
            params: JSON.stringify(orderData),
        }

        //authorize socket using your access token
        socket.onopen = function() {
            socket.request(`authorize\n0\n\n${process.env.ACCESS_TOKEN}`)
        }

        socket.request(`orderstrategy/startorderstrategy\n4\n\n${JSON.stringify(body)}`)

        let dispose = socket.request({
            url: 'orderStrategy/startOrderStrategy',
            body: body,
            callback: (id, r) => {
                if(id === r.i) {
                    console.log(JSON.stringify('Order Placed for Buy', r, null, 2))
                    dispose()
                }
            }
        })
    }
    return action
}

module.exports = { startOrderStrategy }
