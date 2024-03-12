function isTokenValid() {
    console.log('[isTokenValid] Checking if token is valid')
    const expirationTime = new Date(process.env.EXPIRATION_TIME)
    const tenMinutesBeforeExpiration = new Date(expirationTime - 10 * 60000)
    const now = new Date()
    return now < tenMinutesBeforeExpiration
}
module.exports = { isTokenValid }
