module.exports = function drawToConsole(items, clear = true) {
    if(clear) console.clear()
    console.log(`\n[AutoTrade]`)
    Object.entries(items).forEach(([k, v]) => {
        console.log(`${k}:\n${JSON.stringify(v, null, 2)}`)
    })
}
