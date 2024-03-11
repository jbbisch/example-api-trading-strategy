const axios = require("axios")

async function renewAccessToken() {
    //console.log('[renewAccessToken ENDPOINT] is being called')
    
    const URL = process.env.HTTP_URL + '/auth/renewAccessToken'
    //console.log('[renewAccessToken endpoint] URL:', URL)

    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`
        }
    }
    //console.log('[renewAccessToken endpoint] config:', config)

    try {
        const response = await axios.post(URL, config)
        console.log('[renewAccessToken endpoint] RESPONSE:', response.data)
        return response.data
    } catch (err) {
        console.error('[renewAccessToken endpoint] Error in renewAccessToken ENDPOINT:', err.response)
    }
    process.env.ACCESS_TOKEN = response.data.accessToken
    process.env.MD_ACCESS_TOKEN = response.data.mdAccessToken
    process.env.EXPIRATION_TIME = response.data.expirationTime
}
module.exports = { renewAccessToken }