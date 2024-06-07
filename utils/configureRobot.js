const { getReplaySocket, getSocket, getMdSocket } = require("../websocket/utils")
const { askForContract } = require("./askForContract")
const { askForReplay } = require("./askForReplay")
const { askQuestion } = require("./askQuestion")
const { confirm } = require("./confirm")
const { pressEnterToContinue } = require("./enterToContinue")

const configureRobot = async (ALL_STRATEGIES, REPLAY_TIMES, existingConfig = null) => {

    console.clear()    

    const maybeReplayString = await askForReplay(REPLAY_TIMES)

    if(maybeReplayString) {
        const replaySocket = getReplaySocket()
        await replaySocket.connect(process.env.REPLAY_URL)
    } else {
        const socket = getSocket()
        const mdSocket = getMdSocket()

        await Promise.all([
            socket.connect(process.env.WS_URL),
            mdSocket.connect(process.env.MD_URL)
        ])
    }
    
    let contract = existingConfig ? existingConfig.contract : await askForContract()

    while(!contract) {
        contract = await askForContract(true)
    }

    console.log(contract)

    await pressEnterToContinue()

    const StrategyType = existingConfig ? existingConfig.StrategyType : await askQuestion({
        question: 'Choose a strategy:',
        items: ALL_STRATEGIES
    })

    const getParams = async () => {
        if (existingConfig) {
            return existingConfig.params
        }
        const captured_params = {}

        const keys = Object.keys(StrategyType.params)

        for(let i = 0; i < keys.length; i++) {
            let k = keys[i]

            let rawInput
            if(k === 'contract') {
                rawInput = contract
            }
            else if(typeof StrategyType.params[k] === 'object') {
                rawInput = await askQuestion({
                    question: `Please choose an option for '${k}'`,
                    items: StrategyType.params[k]
                })
            }
            else {
                rawInput = await askQuestion({
                    question: `Please supply a parameter for '${k}'`
                })
            }

            value = StrategyType.params[k]

            rawInput = 
                value === 'string'  ? rawInput
            :   value === 'int'     ? parseInt(rawInput, 10)
            :   value === 'float'   ? parseFloat(rawInput)
            :                         rawInput

            captured_params[k] = rawInput
        }

        return await confirm(captured_params, async () => captured_params, getParams)
    } 

    const params = await getParams()
    params.dev_mode = maybeReplayString
    params.replay_periods = REPLAY_TIMES
    console.log(params)
    const concreteStrategy = new StrategyType(params)

    return concreteStrategy
}

module.exports = { configureRobot }
