const fs = require("fs");
const path = require("path");

const DEFAULT_PATH = path.resolve(process.cwd(), "data", "openTrade.json");

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadOpenTrade(filePath = DEFAULT_PATH) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw) return null;
    const obj = JSON.parse(raw);

    // basic sanity
    if (!obj || !obj.entryOrderId) return null;

    return obj;
  } catch (e) {
    console.warn("[openTradeStore] load failed:", e?.message || e);
    return null;
  }
}

function saveOpenTrade(openTrade, filePath = DEFAULT_PATH) {
  try {
    ensureDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(openTrade, null, 2), "utf8");
    return true;
  } catch (e) {
    console.warn("[openTradeStore] save failed:", e?.message || e);
    return false;
  }
}

function clearOpenTrade(filePath = DEFAULT_PATH) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return true;
  } catch (e) {
    console.warn("[openTradeStore] clear failed:", e?.message || e);
    return false;
  }
}

module.exports = { loadOpenTrade, saveOpenTrade, clearOpenTrade, DEFAULT_PATH };