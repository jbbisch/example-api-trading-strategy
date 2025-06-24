module.exports = function drawToConsole(items, clear = true) {
    if(clear) console.clear()
    console.log(`\n[AutoTrade]`)
    Object.entries(items).forEach(([k, v]) => {
        if (k === 'buyTriggerSource' || k === 'sellTriggerSource' || k === 'buyDistance' || k === 'sellDistance') {
            console.log(`${k}: ${v}`)
        } else {
        console.log(`${k}: ${JSON.stringify(v, null, 2)}`)
        }
    })
}
