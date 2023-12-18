const { getSocket, getReplaySocket } = require("../websocket/utils")

const startOrderStrategy = (state, action) => {

    const [event, payload] = action

    if(event === 'crossover/draw') {
        const { data, props } = payload
        const { dev_mode, dispatcher } = props
        const { effects} = dispatcher
        const { contract, action, brackets, entryVersion } = effects

        const socket = dev_mode ? getReplaySocket() : getSocket()

        const orderData = {
            entryVersion,
            brackets,
        }

        console.log(JSON.stringify(orderData, null, 2))
        
        const body = {
            accountId: parseInt(process.env.ID, 10),
            accountSpec: process.env.SPEC,
            symbol: contract.name,
            action: action,
            orderStrategyTypeId: 2,
            params: JSON.stringify(orderData)
        }

        let dispose = socket.request({
            url: 'orderStrategy/startOrderStrategy',
            body,
            callback: (id, r) => {
                if(id === r.i) {
                    console.log(JSON.stringify(r, null, 2))
                    dispose()
                }
            }
        })
    }

    return action
}

module.exports = { startOrderStrategy }
