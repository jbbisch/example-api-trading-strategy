// utils/askQuestion.js
const { KEYS } = require("../utils/helpers")
const { waitUntil } = require("./waitUntil")

// normalize items so we always have parallel arrays of labels & values
function normalizeItems(items) {
  if (Array.isArray(items)) {
    return { labels: items, values: items }
  }
  if (items && typeof items === "object") {
    const labels = Object.keys(items)
    const values = labels.map(k => items[k])
    return { labels, values }
  }
  return { labels: [], values: [] }
}

const drawQuestion = (question, labels, selected) => {
    console.clear()
    console.log(`[AutoTrade]: ${question}\n`)
    labels.forEach((label, i) => {
        console.log(`  ${selected === i ? `> [${i+1}.] ` : `  [${i+1}.] `}${label}`)
    })
}

const badChars = [
  '\u0008', '\u21e7', '\u1b5b41','\u1b5b42','\u1b5b43','\u1b5b44',
  ',', '.', '!', '#', '&', '%', '$', '^', '*', '(', ')', '-', '+'
]

function sanitize(input) {
  let output = ''
  for (let i = 0; i < input.length; i++) {
    if (input.charCodeAt(i) <= 127 && !badChars.includes(input[i])) {
      output += input[i]
    }
  }
  return output
}

const askQuestion = async (choices) => {
  let madeChoice = false
  let input = ''
  let selected = 0

  const { items, question } = choices
  const isSelectorInput = !!items

  // NEW: normalize items → labels (for display) and values (for return)
  const { labels, values } = normalizeItems(items || {})

  const selectorLoop = buffer => {
    const str = buffer.toString('hex')
    switch (str) {
      case KEYS.up:
        selected = selected === 0 ? labels.length - 1 : selected - 1
        break
      case KEYS.down:
        selected = selected === labels.length - 1 ? 0 : selected + 1
        break
      case KEYS.enter:
        madeChoice = true
        break
      default:
        break
    }
    if (!madeChoice) drawQuestion(question, labels, selected)
  }

  const inputLoop = buffer => {
    const str = buffer.toString('utf-8')
    if (buffer.toString('hex') === KEYS.enter) {
      madeChoice = true
    } else {
      input = input + str
    }
  }

  const listener = buffer => {
    isSelectorInput ? selectorLoop(buffer) : inputLoop(buffer)
  }

  process.stdin.addListener('data', listener)

  // draw initial screen
  if (isSelectorInput) drawQuestion(question, labels, selected)
  else drawQuestion(question, [], selected)

  await waitUntil(() => madeChoice)
  process.stdin.removeListener('data', listener)

  // Always return the selected VALUE (not the label/index)
  return isSelectorInput ? values[selected] : sanitize(input)
}

module.exports = { askQuestion }