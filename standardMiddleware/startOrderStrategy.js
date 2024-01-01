const { getSocket, getReplaySocket } = require("../websocket/utils")
const { onChart } = require("../strategies/crossover/onChart")
const { logger } = require("../utils/globalErrorHandler")

const startOrderStrategy = (state, action) => {
    try {

        const [event, payload] = action
        //console.log('[startOrderStrategy] entry payload', payload)

        if(event === 'orderStrategy/startOrderStrategy') {
            const { data, props } = payload
            const { dev_mode } = props
            const { accountId, accountSpec, symbol, action, brackets, entryVersion, orderQuantity } = data
            //console.log('[startOrderStrategy] Payload', payload)
            //console.log('[startOrderStrategy] accountID', accountId)
            //console.log('[startOrderStrategy] accountSpec', accountSpec)
            //console.log('[startOrderStrategy] symbol', symbol)
            //console.log('[startOrderStrategy] action', action)
            //console.log('[startOrderStrategy] brackets', brackets)
            //console.log('[startOrderStrategy] entryVersion', entryVersion)
            //console.log('[startOrderStrategy] orderQuantity', orderQuantity)
        
            const orderData = {
                entryVersion: entryVersion,
                brackets: brackets,
            }
            //console.log('[startOrderStrategy] orderData', orderData)
            console.log(JSON.stringify(orderData, null, 2))
        
            const body = {
                accountId: accountId,
                accountSpec: accountSpec,
                symbol: symbol,
                orderStrategyTypeId: 2,
                action: action,
                params: orderData,
                orderQuantity: orderQuantity,
                isAutomated: true,
            }
            
            const URL = process.env.WS_URL
            //const mySocket = new TradovateSocket(URL)
            const mySocket = dev_mode ? getReplaySocket() : getSocket()

            mySocket.onOpen = function() {
                mySocket.request(`authorize\n0\n\n${process.env.ACCESS_TOKEN}`)
            }
//            socket.request(`/orderstrategy/startorderstrategy\n4\n\n${JSON.stringify(body)}`)
        
            let dispose = mySocket.request({
                URL: `orderstrategy/startorderstrategy\n4\n\n${JSON.stringify(body)}`,
                callback: (id, r) => {
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
                                console.error(JSON.stringify('Not found 444444444444000000000000004444444444444444444444400000000000000444444444444444444444440000000000000044444444444444444444444000000000000004444444444444444444444400000000000000444444444444444444444440000000000000044444444444444444444444000000000000004444444444444444444444400000000000000444444444444444444444440000000000000044444444444444444444444000000000000004444444444444444444444400000000000000444444444444444444444440000000000000044444444444444444444444000000000000004444444444444444444444400000000000000444444444444444444444440000000000000044444444444', r.d, null, 2))
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
        console.error('Error in startOrderStrategy', error.message)
        logger.error('Error in startOrderStrategy', error.message)
    }
    return action
}

module.exports = { startOrderStrategy }
