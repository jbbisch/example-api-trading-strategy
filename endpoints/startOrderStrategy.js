function getQuotes(symbol){
    qouteId = increment()
    websocket.send(`md/subscribeQuote\n ${qouteId}\n""\n${JSON.stringify({ symbol })}`)
    return
}
    
async function openWebSocketConnection(symbol,mode) {
    try {
        let token = await getAccessToken(mode)
        let prevTimestamp,prevPrice;
        let marketDataAuthCred = {
            url: `authorize`,
            id: increment(),
            body: token.mdAccessToken,
        };
    
        await new Promise((resolve) => {
            websocket = new WebSocket(mdwsUrl);
    
            websocket.on('open', () => {
                resolve();
            });
        });
    
        websocket.addEventListener('message', async (msg) => {
            setCurTime(checkHeartbeats(websocket, getCurTime()));
            let [type, data] = parseMessage(msg.data);
                if (type === 'o') {
                    websocket.send(
                        `${marketDataAuthCred.url}\n${marketDataAuthCred.id}\n""\n${JSON.stringify( marketDataAuthCred.body )}`
                    );
                } else if (type === 'a') {
                if (data != null && data[0].i === marketDataAuthCred.id) {
                    getQuotes(symbol);
                    return;
                }
                if (data != null && data[0]?.e === 'md') {
                    let currentTimestamp = new Date(data[0]?.d?.quotes[0]?.timestamp)
                    if(prevTimestamp == null){
                        prevTimestamp = currentTimestamp.getTime();
                        prevPrice = data[0]?.d?.quotes[0]?.entries.Trade.price
                        tradePriceDatabase.unshift(prevPrice)
                        lastMessageTime = Date.now(); // Update the last received message time
                        writeFileSync(path.join(__dirname, '…/output','tradePrices.json'), JSON.stringify(tradePriceDatabase, null, 2), 'utf-8')
                        return;
                    }
                    if (prevTimestamp != currentTimestamp.getTime()) {
                        //console.log(data[0]?.d?.quotes[0]?.entries)
                        tradePriceDatabase = '';
                        prevTimestamp = currentTimestamp.getTime();
                        prevPrice = data[0]?.d?.quotes[0]?.entries.Trade.price
                        tradePriceDatabase.unshift(prevPrice)
                        lastMessageTime = Date.now(); // Update the last received message time
                        writeFileSync(path.join(__dirname, '…/output','tradePrices.json'),JSON.stringify(tradePriceDatabase, null, 2), 'utf-8')
                        return;
                    }
                }
            } else if (type === 'h') {
                return;
            }
        });
    
        websocket.on('error', (error) => {
        console.log(error)
    
        });
    } catch (err) {
    //console.log(err.message)
    }
    }
