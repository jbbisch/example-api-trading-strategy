const axios = require("axios")
const { isTokenValid } = require("../utils/isTokenValid")
const { renewAccessToken } = require("./renewAccessToken")

async function placeOrder({
    action,
    symbol,
    orderQty,
    orderType,
    deviceId,
    price
}) {
    console.log('[placeOrder ENDPOINT] is being called')

    if (!isTokenValid()) {
        console.log('[placeOrder ENDPOINT] Token is not valid. Renewing...')
        await renewAccessToken()
        console.log('[placeOrder ENDPOINT] Token renewed:', process.env.ACCESS_TOKEN)
    }
    
    const URL = process.env.HTTP_URL + '/order/placeOrder'
    console.log('[placeOrder endpoint] URL:', URL)

    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`
        }
    }
    console.log('[placeOrder endpoint] config:', config)

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
    console.log('[placeOrder endpoint] order:', order)

    try {
        const response = await axios.post(URL, order, config)
        console.log('[placeOrder endpoint] RESPONSE:', response.data)
        return response.data
    } catch (err) {
        console.error(err)
    }
}
module.exports = { placeOrder }
