const { axios } = require("axios")

async function placeOrder({
    action,
    symbol,
    orderQty,
    orderType,
    deviceId,
    price
}) {
    console.log('placeOrder ENDPOINT is being called')
    
    const URL = process.env.HTTP_URL + '/order/placeOrder'

    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`
        }
    }

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

    axios.post(URL, order, config)
    .then(response => {
        console.log('placeOrder RESPONSE:', response.data)
    }).catch (err => {
        console.error('Error in placeOrder ENDPOINT:', err)
    })

    return response.data
}
module.exports = { placeOrder }
