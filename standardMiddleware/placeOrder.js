const { getSocket, getReplaySocket } = require("../websocket/utils")
const axios = require('axios')

const placeOrder = (state, action) => {
    //console.log('PlaceOrder FUNCTION called')
    if (Array.isArray(action)) {
        const [event, payload] = action

        if(event === '/order/placeOrder') {
            console.log('handling placeOrder EVENT')
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
        
//            const URL = 'https://demo.tradovateapi.com/v1'

//            axios.post(URL + 'order/placeOrder', body, {
//                headers: {
//                    'Content-Type': 'application/json',
//                    'Accept': 'application/json',
//                    'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
//                }
//            })
//            .then((response) => {
//                console.log('[placeOrder] response', response)
            
//            })
//            .catch((error) => {
//                console.log('[placeOrder] error', error)
//            })
        
        const socket = dev_mode ? getReplaySocket() : getSocket()
        
        socket.onOpen = function() {
            socket.request(`/authorize\n0\n\n${process.env.ACCESS_TOKEN}`)
        }

        let dispose = socket.request({
            url: process.env.WS_URL + `order/placeOrder\n4\n\n${JSON.stringify(body)}`,
            callback: (id, r) => {
                if (id === r.i) {
                    console.log('[placeOrder] Response from trying to place the order RSSS:', r.s)
                    console.log('[placeOrder] Response from trying to place the order RIII:', r.i)
                    console.log('[placeOrder] Response from trying to place the order RDDD:', r.d)
                    console.log('[placeOrder] Response from trying to place the order RRRR:', r)
                    console.log('Placed order successfully')
                    dispose()
                }
            }
        })
    }
    }
    

    return action
}

module.exports = { placeOrder }
