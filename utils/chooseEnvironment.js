// utils/chooseEnvironment.js
const { askQuestion } = require("./askQuestion")

const ENV_MAP = {
  Demo: {
    HTTP_URL:  'https://demo.tradovateapi.com/v1',
    WS_URL:    'wss://demo.tradovateapi.com/v1/websocket',
    MD_URL:    'wss://md.tradovateapi.com/v1/websocket',
    REPLAY_URL:'wss://replay.tradovateapi.com/v1/websocket',
    LABEL:     'DEMO'
  },
  Live: {
    HTTP_URL:  'https://live.tradovateapi.com/v1',
    WS_URL:    'wss://live.tradovateapi.com/v1/websocket',
    MD_URL:    'wss://md.tradovateapi.com/v1/websocket',
    REPLAY_URL:'wss://replay.tradovateapi.com/v1/websocket',
    LABEL:     'LIVE'
  }
}

async function chooseEnvironment() {
    const choices = ["DEMO", "LIVE"]

    const choiceIndex = await askQuestion({
        question: 'Choose environment:',
        items: choices
    })

    const envChoice = choices[choiceIndex]
    const env = ENV_MAP[envChoice]
    process.env.HTTP_URL   = env.HTTP_URL
    process.env.WS_URL     = env.WS_URL
    process.env.MD_URL     = env.MD_URL
    process.env.REPLAY_URL = env.REPLAY_URL
    process.env.ENV_LABEL  = env.LABEL

    // Avoid reusing a token from the other environment
    delete process.env.ACCESS_TOKEN
}

module.exports = { chooseEnvironment }
