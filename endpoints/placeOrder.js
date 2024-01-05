const { default: axios } = require("axios")

module.exports = async function({
    action,
    symbol,
    orderQty,
    orderType,
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
        timeInForce: 'Day',
        isAutomated: true
    }

    let result
    try {
        result = await axios.post(URL, order, config)
        console.log('placeOrder RESPONSE:', result.data)
    } catch (err) {
        console.error('Error in placeOrder:', err)
    }

    return result.data
}