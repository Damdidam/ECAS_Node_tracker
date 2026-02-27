#!/usr/bin/env node
/**
 * Generate sample data for testing. Run once: node scripts/seed.js
 */
const fs = require("fs");
const path = require("path");

const HISTORY_FILE = path.join(__dirname, "..", "data", "rotation-history.json");
const NODE_MAP = {
  i067: { short: "i067", host: "idt183067", label: "IDT067" },
  i068: { short: "i068", host: "idt183068", label: "IDT068" },
  i069: { short: "i069", host: "idt183069", label: "IDT069" },
};
const shortIds = Object.keys(NODE_MAP);
const records = [];
const now = Date.now();
let cur = "i068", ver = "9.14.5";
const bumps = { 45: "9.14.6", 15: "9.14.7" };

for (let d = 60; d >= 0; d--) {
  if (bumps[d]) ver = bumps[d];
  const checks = d === 0 ? 2 : 3;
  for (let c = 0; c < checks; c++) {
    const date = new Date(now - d * 864e5);
    date.setHours(c === 0 ? 8 : c === 1 ? 14 : 20, Math.floor(Math.random() * 30), 0);
    if (Math.random() < 0.05 && d > 0) {
      cur = shortIds.filter(n => n !== cur)[Math.floor(Math.random() * 2)];
    }
    const prev = records[records.length - 1];
    const n = NODE_MAP[cur];
    records.push({
      timestamp: date.toISOString(),
      status: "OK",
      nodeShortId: cur,
      nodeLabel: n.label,
      nodeHost: n.host,
      version: ver,
      responseTimeMs: Math.floor(Math.random() * 15) + 1,
      failover: prev ? prev.nodeShortId !== cur : false,
      error: null,
    });
  }
}

const dir = path.dirname(HISTORY_FILE);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(HISTORY_FILE, JSON.stringify({ records, lastUpdated: new Date().toISOString() }, null, 2));
console.log(`Seeded ${records.length} records → ${HISTORY_FILE}`);
