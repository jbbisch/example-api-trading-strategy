// utils/tradingDay.js
const { DateTime } = require("luxon");

// Exit-time trading day based on session open boundary (CME-style).
// Default boundary: 17:00 America/Chicago
function getTradingDayDate(jsDate, {
  sessionTz = "America/Chicago",
  boundaryHour = 17,
  boundaryMinute = 0,
} = {}) {
  const t = DateTime.fromJSDate(jsDate, { zone: sessionTz });
  const boundary = t.set({ hour: boundaryHour, minute: boundaryMinute, second: 0, millisecond: 0 });

  // before boundary => previous trading day
  const tradingDay = t < boundary ? t.minus({ days: 1 }) : t;

  // Return a JS Date at local midnight of the trading day (in sessionTz),
  // so Excel displays a date cleanly.
  const dayStart = tradingDay.startOf("day");
  return dayStart.toJSDate();
}

module.exports = { getTradingDayDate };