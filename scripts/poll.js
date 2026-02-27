#!/usr/bin/env node
/**
 * EU Login Node Rotation Tracker — Poll Script
 * 
 * Designed to run in GitHub Actions.
 * Fetches the CAS page, parses the footer, appends to data/rotation-history.json.
 * 
 * Footer format: "9.14.7-i068 | 3 ms"
 *   - 9.14.7  → CAS version
 *   - i068    → Active node (idt183068)
 *   - 3 ms    → Page generation time
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// ─── Config ──────────────────────────────────────────────────────
const EULOGIN_URL = process.env.EULOGIN_URL || "https://webgate.ec.europa.eu/cas/";
const HISTORY_FILE = path.join(__dirname, "..", "data", "rotation-history.json");

const NODE_MAP = {
  i067: { short: "i067", host: "idt183067", label: "IDT067" },
  i068: { short: "i068", host: "idt183068", label: "IDT068" },
  i069: { short: "i069", host: "idt183069", label: "IDT069" },
};

// ─── Fetch ───────────────────────────────────────────────────────
function fetchPage(url, redirects = 0) {
  if (redirects > 5) return Promise.reject(new Error("Too many redirects"));
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EULoginTracker/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith("http")
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return fetchPage(next, redirects + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

// ─── Parse footer ────────────────────────────────────────────────
// Matches: "9.14.7-i068 | 3 ms" (with possible HTML tags around/between elements)
function parseFooter(html) {
  // Strip HTML tags and decode common entities
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ");

  // Primary: full pattern with version, node, and response time
  const m = text.match(/(\d+\.\d+\.\d+(?:\.\d+)?)\s*[-–]\s*(i\d{3})\s*\|\s*(\d+)\s*ms/i);
  if (m) {
    return { version: m[1], nodeShortId: m[2].toLowerCase(), responseTimeMs: parseInt(m[3], 10) };
  }

  // Secondary: version and node without response time
  const m2 = text.match(/(\d+\.\d+\.\d+(?:\.\d+)?)\s*[-–]\s*(i\d{3})/i);
  if (m2) {
    return { version: m2[1], nodeShortId: m2[2].toLowerCase(), responseTimeMs: null };
  }

  // Fallback: just the node ID
  const fb = text.match(/\b(i0(?:67|68|69))\b/i);
  if (fb) return { version: null, nodeShortId: fb[1].toLowerCase(), responseTimeMs: null };
  return null;
}

// ─── History I/O ─────────────────────────────────────────────────
function readHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
  } catch (e) { /* fresh start */ }
  return { records: [], lastUpdated: null };
}

function writeHistory(history) {
  const dir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
}

// ─── Main ────────────────────────────────────────────────────────
(async () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Polling ${EULOGIN_URL}...`);

  const record = {
    timestamp,
    status: "OK",
    nodeShortId: null,
    nodeLabel: null,
    nodeHost: null,
    version: null,
    responseTimeMs: null,
    failover: false,
    error: null,
  };

  try {
    const html = await fetchPage(EULOGIN_URL);
    const parsed = parseFooter(html);

    if (!parsed) {
      record.status = "PARSE_ERROR";
      record.error = "Footer pattern not found in page";
      console.error("ERROR: Could not find version/node pattern in HTML");
    } else {
      const node = NODE_MAP[parsed.nodeShortId] || {
        short: parsed.nodeShortId,
        host: `unknown-${parsed.nodeShortId}`,
        label: parsed.nodeShortId.toUpperCase(),
      };
      record.nodeShortId = parsed.nodeShortId;
      record.nodeLabel = node.label;
      record.nodeHost = node.host;
      record.version = parsed.version;
      record.responseTimeMs = parsed.responseTimeMs;
      console.log(`OK — Node: ${node.label} (${node.host}) | v${parsed.version} | ${parsed.responseTimeMs}ms`);
    }
  } catch (err) {
    record.status = "FETCH_ERROR";
    record.error = err.message;
    console.error(`FETCH ERROR: ${err.message}`);
  }

  // Load history, detect failover, save
  const history = readHistory();
  const prev = history.records[history.records.length - 1];

  if (prev && prev.nodeShortId && record.nodeShortId && prev.nodeShortId !== record.nodeShortId) {
    record.failover = true;
    console.log(`*** FAILOVER DETECTED: ${prev.nodeLabel} → ${record.nodeLabel} ***`);
  }

  history.records.push(record);
  history.lastUpdated = timestamp;
  writeHistory(history);

  console.log(`Saved → ${HISTORY_FILE} (${history.records.length} records)`);
})();
