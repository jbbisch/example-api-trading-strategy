// utils/tradovateFills.js
// Fetch fills for an orderId and compute avg fill price.
// Uses REST: GET /v1/fill/deps?masterid=<orderId>

async function getFillsByOrderId({ baseUrl, accessToken, orderId }) {
  if (!baseUrl) throw new Error("getFillsByOrderId: baseUrl required");
  if (!accessToken) throw new Error("getFillsByOrderId: accessToken required");
  if (!orderId && orderId !== 0) throw new Error("getFillsByOrderId: orderId required");

  const url = new URL("/fill/deps", baseUrl);
  url.searchParams.set("masterid", String(orderId));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`fill/deps failed (${res.status}): ${body}`);
  }

  const fills = await res.json();
  if (!Array.isArray(fills)) return [];
  return fills;
}

function computeAvgFillPrice(fills) {
  // Tradovate fill objects typically have qty and price.
  // We do weighted average in case of partial fills.
  let qtySum = 0;
  let pxQtySum = 0;

  for (const f of fills) {
    const qty = Number(f.qty ?? f.filledQty ?? 0);
    const price = Number(f.price ?? f.fillPrice ?? f.avgPrice ?? NaN);
    if (!Number.isFinite(qty) || !Number.isFinite(price) || qty === 0) continue;

    qtySum += qty;
    pxQtySum += price * qty;
  }

  if (qtySum === 0) return null;
  return pxQtySum / qtySum;
}

function extractFillTimestamp(fills) {
  // Prefer a timestamp from the latest fill if present.
  // Tradovate commonly provides "timestamp" (ISO string) or something similar.
  const candidates = fills
    .map(f => f.timestamp ?? f.time ?? f.datetime ?? null)
    .filter(Boolean);

  if (candidates.length === 0) return null;

  // If it's ISO strings, Date will parse; if it's epoch, also parse.
  const last = candidates[candidates.length - 1];
  const d = new Date(last);
  return isNaN(d.getTime()) ? null : d;
}

module.exports = {
  getFillsByOrderId,
  computeAvgFillPrice,
  extractFillTimestamp,
};
