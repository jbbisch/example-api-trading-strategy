const axios = require("axios")

async function renewAccessToken() {
    console.log('[renewAccessToken ENDPOINT] is being called')
    
    const URL = process.env.HTTP_URL + '/auth/renewAccessToken'
    //console.log('[renewAccessToken ENDPOINT] URL:', URL)

    const data = {
        name: process.env.USER,
        password: process.env.PASS,
        appId: 'AutoTrade',
        appVersion: '1.0',
        deviceId: process.env.DEVICE_ID,
        cid: parseInt(process.env.CID, 10),
        sec: process.env.SEC
    }
    console.log('[renewAccessToken ENDPOINT] data:', data)

    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`
        }
    }
    //console.log('[renewAccessToken ENDPOINT] config:', config)

    try {
        const response = await axios.post(URL, data, config)
        console.log('[renewAccessToken ENDPOINT] RESPONSE:', response.data)
        return response.data
    } catch (err) {
        console.error('[renewAccessToken ENDPOINT] Error in renewAccessToken ENDPOINT:', err.response)
    }
    process.env.ACCESS_TOKEN = response.data.accessToken
    process.env.MD_ACCESS_TOKEN = response.data.mdAccessToken
    process.env.EXPIRATION_TIME = response.data.expirationTime
}
module.exports = { renewAccessToken }
