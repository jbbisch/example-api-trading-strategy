// utils/tradeExcelLogger.js
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const { getTradingDayDate } = require("./tradingDay");
const { loadOpenTrade, saveOpenTrade, clearOpenTrade } = require("./openTradeStore")

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function pickOrderId(resp) {
  // Tradovate responses vary by wrapper; try common keys
  return resp?.orderId ?? resp?.id ?? resp?.order?.id ?? resp?.order?.orderId ?? null;
}

function cloneRowStyle(fromRow, toRow, colCount) {
  for (let c = 1; c <= colCount; c++) {
    const fromCell = fromRow.getCell(c);
    const toCell = toRow.getCell(c);

    // style clone
    toCell.style = { ...fromCell.style };

    // number format clone
    if (fromCell.numFmt) toCell.numFmt = fromCell.numFmt;

    // alignment/border/fill/font are in style; above covers most cases
  }
  toRow.height = fromRow.height;
}

class TradeExcelLogger {
  /**
   * @param {object} opts
   * @param {string} opts.workbookPath - path to Trade_Pairs_Analysis.xlsx (template)
   * @param {string} opts.sheetName - default "Raw Trades"
   * @param {string} opts.sessionTz - default America/Chicago
   * @param {number} opts.boundaryHour - default 17
   * @param {number} opts.boundaryMinute - default 0
   * @param {number} opts.valuePerPoint - MES = 5.0
   */
  constructor(opts = {}) {
    this.workbookPath = opts.workbookPath || path.resolve(process.cwd(), "Trade_Pairs_Analysis.xlsx");
    this.sheetName = opts.sheetName || "Raw Trades";

    this.sessionTz = opts.sessionTz || "America/Chicago";
    this.boundaryHour = Number.isFinite(opts.boundaryHour) ? opts.boundaryHour : 17;
    this.boundaryMinute = Number.isFinite(opts.boundaryMinute) ? opts.boundaryMinute : 0;

    this.valuePerPoint = Number.isFinite(opts.valuePerPoint) ? opts.valuePerPoint : 5.0;

    // In-memory open trade state
    this.open = null;
  }

  startEntry({ entryOrderId, entryTrigger, entryAction, qty, symbol, entryTime }) {
    if (!entryOrderId) throw new Error("startEntry: entryOrderId required");
    this.open = {
      entryOrderId,
      entryTrigger: entryTrigger || "unknown",
      entryAction: entryAction || "Buy", // "Buy" for long entry, "Sell" for short entry
      qty: qty ?? 1,
      symbol: symbol || "",
      entryTime: entryTime ? new Date(entryTime) : new Date(),
    };
  }

  attachEntryFromPlaceOrderResponse({ response, entryTrigger, entryAction, qty, symbol }) {
    const entryOrderId = pickOrderId(response);
    if (!entryOrderId) throw new Error("attachEntryFromPlaceOrderResponse: could not find orderId in response");
    this.startEntry({ entryOrderId, entryTrigger, entryAction, qty, symbol, entryTime: new Date() });
    return entryOrderId;
  }

  async finalizeExitAndAppend({
    // order info
    exitOrderId,
    exitTrigger,
    exitAction, // e.g. "Sell" to close long, "Buy" to close short
    exitTime,

    // REST fill fetcher
    baseUrl,
    accessToken,
    getFillsByOrderId,
    computeAvgFillPrice,
    extractFillTimestamp,

    // optional notes
    notes,
  }) {
    if (!this.open) throw new Error("finalizeExitAndAppend: no open trade in memory");
    if (!exitOrderId) throw new Error("finalizeExitAndAppend: exitOrderId required");

    const qty = Number(this.open.qty ?? 1);

    // Pull fills
    const entryFills = await getFillsByOrderId({ baseUrl, accessToken, orderId: this.open.entryOrderId });
    const exitFills = await getFillsByOrderId({ baseUrl, accessToken, orderId: exitOrderId });

    const entryPx = computeAvgFillPrice(entryFills);
    const exitPx = computeAvgFillPrice(exitFills);

    if (!Number.isFinite(entryPx) || !Number.isFinite(exitPx)) {
      throw new Error(`Could not compute fill prices. entryPx=${entryPx} exitPx=${exitPx}`);
    }

    // Determine direction by entryAction
    // Long: Buy -> Sell. Short: Sell -> Buy.
    const isLong = String(this.open.entryAction).toLowerCase() === "buy";

    // Gross PnL (pre-commission)
    // MES: $5.00 per point
    const points = isLong ? (exitPx - entryPx) : (entryPx - exitPx);
    const grossPnl = points * this.valuePerPoint * qty;

    const result = grossPnl >= 0 ? "Win" : "Loss";

    // Exit time preference: actual exit fill timestamp if available
    const exitFillTs = extractFillTimestamp(exitFills) || (exitTime ? new Date(exitTime) : new Date());
    const tradeDayDate = getTradingDayDate(exitFillTs, {
      sessionTz: this.sessionTz,
      boundaryHour: this.boundaryHour,
      boundaryMinute: this.boundaryMinute,
    });

    const row = {
      dateTime: tradeDayDate,
      entryTrigger: this.open.entryTrigger,
      exitTrigger: exitTrigger || "unknown",
      result,
      pnl: Number(grossPnl.toFixed(2)),
      notes: notes || "",
    };

    await this.appendRowToWorkbook(row);

    // clear open trade
    this.open = null;

    return row;
  }

  async appendRowToWorkbook({ dateTime, entryTrigger, exitTrigger, result, pnl, notes }) {
    ensureDirForFile(this.workbookPath);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(this.workbookPath);

    const ws = wb.getWorksheet(this.sheetName);
    if (!ws) throw new Error(`Sheet not found: ${this.sheetName}`);

    // Find last row with data in column A (DateTime)
    let lastRowNumber = ws.lastRow?.number || 1;

    // ExcelJS lastRow can be weird if formatting exists; scan down column A
    for (let r = ws.rowCount; r >= 2; r--) {
      const v = ws.getRow(r).getCell(1).value;
      if (v !== null && v !== undefined && v !== "") { lastRowNumber = r; break; }
    }

    const newRowNumber = lastRowNumber + 1;
    const newRow = ws.getRow(newRowNumber);

    // Values in the same order as headers:
    newRow.getCell(1).value = dateTime instanceof Date ? dateTime : new Date(dateTime);
    newRow.getCell(2).value = entryTrigger;
    newRow.getCell(3).value = exitTrigger;
    newRow.getCell(4).value = result;
    newRow.getCell(5).value = pnl;
    newRow.getCell(6).value = notes ?? "";

    // Clone formatting from previous data row if possible (keeps your workbook looking identical)
    const templateRow = ws.getRow(Math.max(2, lastRowNumber));
    cloneRowStyle(templateRow, newRow, 6);

    newRow.commit();

    await wb.xlsx.writeFile(this.workbookPath);
  }
}

module.exports = { TradeExcelLogger };
