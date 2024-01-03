const { getSocket, getReplaySocket } = require("../websocket/utils")

const placeOrder = async (state, action) => {
    const [event, payload] = action

    if(event === '/order/placeOrder') {
        const { data, props } = payload
        console.log('[placeOrder] props', props)
        const { dev_mode } = props
        const { contract, action, entryVersion, price } = data
        const { orderType, orderQty } = entryVersion

        const body = {
            accountSpec: process.env.SPEC,
            accountId: parseInt(process.env.ID, 10),
            action: action,
            symbol: contract.name,
            orderQty: orderQty,
            orderType: orderType,
            isAutomated: true,
            price
        }
        
        const URL = 'demo.tradovateapi.com/v1'

        const response = await fetch(URL + '/order/placeorder', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${myAccessToken}`,
            },
            body: JSON.stringify(body)
        })
        
        const json = await response.json()
        
//        const socket = dev_mode ? getReplaySocket() : getSocket()
        
//        socket.onOpen = function() {
//            socket.request(`/authorize\n0\n\n${process.env.ACCESS_TOKEN}`)
//        }

//        let dispose = socket.request({
//            url: process.env.WS_URL + `order/placeOrder\n4\n\n${JSON.stringify(body)}`,
//            callback: (id, r) => {
//                if (id === r.i) {
//                    console.log('[placeOrder] Response from trying to place the order RSSS:', r.s)
//                    console.log('[placeOrder] Response from trying to place the order RIII:', r.i)
//                    console.log('[placeOrder] Response from trying to place the order RDDD:', r.d)
//                    console.log('[placeOrder] Response from trying to place the order RRRR:', r)
//                    console.log('Placed order successfully')
//                    dispose()
//                }
//            }
//        })
    }
    

    return action
}

module.exports = { placeOrder }
