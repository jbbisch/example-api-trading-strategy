const { getSocket, getReplaySocket } = require("../websocket/utils")
const { logger } = require("../utils/globalErrorHandler")


const placeOrder = (state, action) => {
        //console.log('placeOrder FUNCTION called')
    try {
        const [event, payload] = action

        if(event === 'order/liquidatePosition') {
            console.log('HANDLING liquidatePosition EVENT:')

            const { data, props } = payload
            const { dev_mode } = props
            const { contract, orderType, action, orderQty, price } = data

            const socket = dev_mode ? getReplaySocket() : getSocket()

            socket.onOpen = function() {
                socket.request(`/authorize\n0\n\n${process.env.ACCESS_TOKEN}`)
            }

            const body = {
                symbol: contract,
                orderQty: orderQty,
                accountSpec: process.env.SPEC,
                accountId: parseInt(process.env.ID, 10),
                action: action,
                //price,
                orderType: orderType,
                isAutomated: true

            }

            let dispose = socket.request({
                url: process.env.WS_URL + `/order/liquidatePosition\n4\n\n${JSON.stringify(body)}`,
                callback: (id, r) => {
                    console.log('[placeOrder] Response from trying to place the order RSSS:', r.s)
                    console.log('[placeOrder] Response from trying to place the order RIII:', r.i)
                    console.log('[placeOrder] Response from trying to place the order RDDD:', r.d)
                    console.log('[placeOrder] Response from trying to place the order RRRR:', r)
                                    
                    if (id === r.i) {
                        switch (r.s) {
                            case 200:
                                console.log(JSON.stringify('Order placed 22222222222222200000000000000000 for buy', r.s, null, 2))
                                break
                            case 400:
                                console.error(JSON.stringify('Failed to place44444444444444440000000000000000000000000000 buy order', r.d, null, 2))
                                break
                            case 401:
                                console.error(JSON.stringify('Unauthorized 4444444444444444000000000000001111111111111', r.d, null, 2))
                                break
                            case 403:
                                console.error(JSON.stringify('Forbidden 444444444440000000000000033333333333333', r.d, null, 2))
                                break
                            case 404:
                                console.error(JSON.stringify('Not found 44444444444400000000000000444444444444444444444444444000000000000004444444444444444444444444440000000000000044444444444444444444444444400000000000000444444444444444444444444444000000000000004444444444444444444444444440000000000000044444444444444444444444444400000000000000444444444444444444444444444000000000000004444444444444444444444444440000000000000044444444444444444444444444400000000000000444444444444444444444444444000000000000004444444444444444444444444440000000000000044444444444444444444444444400000000000000444444444444444', r.d, null, 2))
                                break
                            case 500:
                                console.error(JSON.stringify('Internal server error 5555555555555500000000000000000000000000', r.d, null, 2))
                                break
                            default:
                                console.error(JSON.stringify('Unknown error', r.d, null, 2))
                                break
                        }
                        if (r.s === 200) {
                            console.log(JSON.stringify('Order placed for buy PLACED PLACED PLACED SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS', r.s, null, 2))
                        } else {
                            console.error(JSON.stringify('Failed to place the order FAILED FAILED FAILED FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', r.d, null, 2))
                        }
                        dispose()
                    }    
                }
            })
        }
    } catch (error) {
        console.error('Error in placeOrder', error.message, error.stack, error)
        logger.error('Error in placeOrder', error.message, error.stack, error)
    }
    return action
}

module.exports = { placeOrder }
