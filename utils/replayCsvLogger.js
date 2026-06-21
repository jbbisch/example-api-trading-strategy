// utils/replayCsvLogger.js
const fs = require("fs")
const path = require("path")

const filePath = path.join(process.cwd(), "data", "replay-bars.csv")

function ensureHeader() {
  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(
      filePath,
      "timestamp,open,high,low,close,volume,positiveCrossover,negativeCrossover,entrySignal,exitSignal,distance,longSmaVelocity,distanceVelocity\n"
    )
  }
}

function appendReplayRow(row) {
  console.log('[replayCsvLogger] writing row:', row.timestamp)
  ensureHeader()

  fs.appendFileSync(
    filePath,
    [
      row.timestamp,
      row.open,
      row.high,
      row.low,
      row.close,
      row.volume ?? "",
      row.positiveCrossover ?? "",
      row.negativeCrossover ?? "",
      row.entrySignal ?? "",
      row.exitSignal ?? "",
      row.distance ?? "",
      row.longSmaVelocity ?? "",
      row.distanceVelocity ?? "",
    ].join(",") + "\n"
  )
}

module.exports = { appendReplayRow }