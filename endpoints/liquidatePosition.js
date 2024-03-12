const axios = require("axios")
const { isTokenValid } = require("../utils/isTokenValid")
const { renewAccessToken } = require("./renewAccessToken")
const { requestAccessToken } = require("./requestAccessToken")

async function liquidatePosition({
    accountId,
    contractId,
    admin = true,
    deviceId,
    action,
    symbol,
    orderQty,
    orderType,
    isAutomated = true,
    price
}) {
    console.log('[liquidatePosition ENDPOINT] is being called')

    if (!isTokenValid()) {
        console.log('[placeOrder ENDPOINT] Token is not valid. Renewing...')
        await renewAccessToken()
        console.log('[placeOrder ENDPOINT] Token renewed:', process.env.ACCESS_TOKEN)
    }
    
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
        //accountSpec: process.env.SPEC,
        accountId,
        contractId,
        admin,
        //action,
        //symbol,
        //orderQty,
        //orderType,
        //price,
        deviceId,
        //timeInForce: 'Day',
        isAutomated
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
