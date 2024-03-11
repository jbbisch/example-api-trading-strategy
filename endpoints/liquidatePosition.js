const axios = require("axios")

async function liquidatePosition({
    action,
    symbol,
    orderQty,
    orderType,
    deviceId,
    price
}) {
    console.log('[liquidatePosition ENDPOINT] is being called')
    
    const URL = process.env.HTTP_URL + '/order/liquidatePosition'
    console.log('[liquidatePosition endpoint] URL:', URL)

    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`
        }
    }
    console.log('[liquidatePosition endpoint] config:', config)

    const order = {
        accountSpec: process.env.SPEC,
        accountId: parseInt(process.env.ID, 10),
        action,
        symbol,
        orderQty,
        orderType,
        price,
        deviceId,
        timeInForce: 'Day',
        isAutomated: true
    }
    console.log('[liquidatePosition endpoint] order:', order)

    try {
        const response = await axios.post(URL, order, config)
        console.log('[liquidatePosition endpoint] RESPONSE:', response.data)
        return response.data
    } catch (err) {
        console.error('[liquidatePosition endpoint] Error in liquidatePosition ENDPOINT:', err.response)
    }
}
module.exports = { liquidatePosition }
