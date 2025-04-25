const axios = require("axios")

let tokenRetries = 0
const MAX_TOKEN_RETRIES = 5

async function renewAccessToken() {
    console.log('[renewAccessToken] Attempting to renew access token...');

    if (tokenRetries >= MAX_TOKEN_RETRIES) {
        console.error(`[renewAccessToken] Failed ${tokenRetries} times. Aborting further attempts.`);
        return false
    }

    const URL = process.env.HTTP_URL + '/auth/renewAccessToken'
    const data = {
        name: process.env.USER,
        password: process.env.PASS,
        appId: 'AutoTrade',
        appVersion: '1.0',
        deviceId: process.env.DEVICE_ID,
        cid: parseInt(process.env.CID, 10),
        sec: process.env.SEC
    }

    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`
        }
    }

    try {
        const response = await axios.post(URL, data, config)
        console.log('[renewAccessToken] Token successfully renewed.')

        // Update env variables
        process.env.ACCESS_TOKEN = response.data.accessToken
        process.env.MD_ACCESS_TOKEN = response.data.mdAccessToken
        process.env.EXPIRATION_TIME = response.data.expirationTime

        tokenRetries = 0 // reset on success
        return response.data
    } catch (err) {
        tokenRetries += 1
        const code = err?.response?.status || 'Unknown'
        console.error(`[renewAccessToken] Error (attempt ${tokenRetries}):`, code)
        return false
    }
}

module.exports = { renewAccessToken }