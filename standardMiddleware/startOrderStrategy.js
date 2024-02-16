const { getSocket, getReplaySocket } = require("../websocket/utils")
const { logger } = require("../utils/globalErrorHandler")
const { TradovateSocket } = require("../websocket/TradovateSocket")

const startOrderStrategy = (state, action) => {
    //console.log('startOrderStrategy FUNCTION called')

    try {

        const [event, payload] = action
        //console.log('[startOrderStrategy] entry payload', payload)

        if(event === 'orderStrategy/startOrderStrategy') {
            console.log('HANDLING startOrderStrategy EVENT:')

            const { data, props } = payload
            const { dev_mode } = props
            const { symbol, action, brackets, entryVersion, deviceId } = data
            //console.log('[startOrderStrategy] Payload', payload)
            //console.log('[startOrderStrategy] symbol', symbol)
            //console.log('[startOrderStrategy] action', action)
            //console.log('[startOrderStrategy] brackets', brackets)
            //console.log('[startOrderStrategy] entryVersion', entryVersion)
            //console.log('[startOrderStrategy] deviceId', deviceId)
                    
            const params = {
                entryVersion: entryVersion,
                brackets: brackets,
            }
            //console.log('[startOrderStrategy] orderData', orderData)
            console.log('[startOrderStrategy] params:', JSON.stringify(params, null, 2))
        
            const body = {
                accountId: parseInt(process.env.ID, 10),
                accountSpec: process.env.SPEC,
                deviceId: deviceId,
                symbol: symbol,
                action: action,
                orderStrategyTypeId: 2,
                params: JSON.stringify(params, null, 2),
                isAutomated: true,
            }
            
            const URL = process.env.WS_URL + `/orderstrategy/startorderstrategy`
            console.log('[startOrderStrategy] URL:', URL)
            console.log('[startOrderStrategy] order request payload:', `/orderstrategy/startorderstrategy\n4\n\n${JSON.stringify(body)}`)
            console.log('[startOrderStrategy] authorization payload:', `/authorize\n2\n\n${process.env.ACCESS_TOKEN}`)
            //const mySocket = new TradovateSocket(URL)
            const mySocket = dev_mode ? getReplaySocket() : getSocket()

            mySocket.onOpen = function() {
                mySocket.request({
                    url: `/authorize\n2\n\n${process.env.ACCESS_TOKEN}`,
                    callback: (id, response) => {
                        console.log('[startOrderStrategy] Response from trying to authorize:', response)
                        console.log('[startOrderStrategy] Response from trying to authorize:', response.s)
                        console.log('[startOrderStrategy] Response from trying to authorize:', response.i)
                        console.log('[startOrderStrategy] Response from trying to authorize:', response.d)
                    }
                })
            }
        
            let dispose = mySocket.request({
                url: process.env.WS_URL + `/orderstrategy/startorderstrategy\n4\n\n${JSON.stringify(body)}`,
                callback: (id, r) => {
                    console.log('[startOrderStrategy] Response from trying to place the order RSSS:', r.s)
                    console.log('[startOrderStrategy] Response from trying to place the order RIII:', r.i)
                    console.log('[startOrderStrategy] Response from trying to place the order RDDD:', r.d)
                    console.log('[startOrderStrategy] Response from trying to place the order RRRR:', r)
                                        
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
        console.error('Error in startOrderStrategy', error.message, error.stack, error)
        logger.error('Error in startOrderStrategy', error.message, error.stack, error)
    }
    return action
}

module.exports = { startOrderStrategy }
