import { useState, useEffect, useCallback } from "react";
import { API_KEY, SPREADSHEETS } from "../config";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch(url) {
  const res = await fetch(url);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j?.error?.message || msg; } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

function rowsToObjects(rows) {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map((h, i) => String(h ?? "").trim() || `col${i}`);
  return rows.slice(1)
    .filter(row => row.some(cell => cell !== "" && cell !== undefined && cell !== null))
    .map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])));
}

/** Flexible key lookup — matches header names case-insensitively. */
function pick(obj, ...patterns) {
  const entries = Object.entries(obj);
  for (const pat of patterns) {
    const found = entries.find(([k]) => k.toLowerCase().includes(pat.toLowerCase()));
    if (found) return found[1];
  }
  return "";
}

function parseAmount(raw) {
  if (typeof raw === "number") return raw;
  return parseFloat(String(raw).replace(/[$,\s]/g, "")) || 0;
}

function parseTransaction(raw) {
  return {
    transactionDate: pick(raw, "transaction date", "trans date", "date"),
    bankDate:        pick(raw, "bank date"),
    category:        pick(raw, "category"),
    amount:          parseAmount(pick(raw, "amount")),
    type:            pick(raw, "type"),
    description:     pick(raw, "description"),
    balance:         parseAmount(pick(raw, "balance", "column 7", "col6", "running")),
    notes:           pick(raw, "notes"),
  };
}

function parseExtraTransaction(raw, tabType) {
  const tx = {
    transactionDate: pick(raw, "transaction date", "trans date", "date", "payment date", "billing date", "renewal date"),
    bankDate:        pick(raw, "bank date"),
    category:        pick(raw, "category"),
    amount:          parseAmount(pick(raw, "amount", "cost", "charge", "price", "total")),
    type:            pick(raw, "type"),
    description:     pick(raw, "description", "name", "vendor", "software", "tool", "service", "item", "payee", "merchant"),
    balance:         parseAmount(pick(raw, "balance", "running balance")),
    notes:           pick(raw, "notes", "billing cycle", "frequency", "memo", "comment"),
  };
  if (tabType === "software") {
    if (!tx.type)     tx.type     = "Expense";
    if (!tx.category) tx.category = "Software";
  }
  return tx;
}

function classifyTab(name) {
  const lower = name.toLowerCase();
  if (lower.includes("software") || lower.includes("saas"))          return "software";
  if (lower.includes("master")   || lower.includes("all transaction")) return "master";
  return null;
}

// ── Single-spreadsheet loader ─────────────────────────────────────────────────

async function loadSpreadsheet({ id, txGid, label }) {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${id}`;

  // 1 — Resolve sheet names from GIDs
  const metaJson = await apiFetch(
    `${base}?key=${API_KEY}&fields=sheets.properties`
  ).catch(e => {
    throw new Error(
      `[${label}] ${e.message}. Make sure the spreadsheet is shared as "Anyone with the link can view".`
    );
  });

  const sheetsInfo = metaJson.sheets || [];
  const gidMap = Object.fromEntries(
    sheetsInfo.map(({ properties: p }) => [p.sheetId, p.title])
  );

  // Resolve primary tab — use GID if provided, otherwise first tab
  const txSheetName = (txGid != null ? gidMap[txGid] : null)
    ?? sheetsInfo[0]?.properties?.title;

  if (!txSheetName) throw new Error(`[${label}] No sheets found.`);

  // 2 — Fetch primary transaction sheet
  const txData = await apiFetch(
    `${base}/values/${encodeURIComponent(txSheetName)}?key=${API_KEY}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`
  );
  const primaryTxs = rowsToObjects(txData.values || [])
    .map(parseTransaction)
    .filter(t => t.transactionDate && (t.amount !== 0 || t.type))
    .map(t => ({ ...t, source: txSheetName, spreadsheet: label }));

  // 3 — Load all remaining tabs as extra sources
  const loadedNames = new Set([txSheetName]);
  const extraSheets = sheetsInfo
    .map(s => ({ name: s.properties?.title || "" }))
    .filter(({ name }) => name && !loadedNames.has(name));

  const extraResults = await Promise.allSettled(
    extraSheets.map(async ({ name }) => {
      const tabType = classifyTab(name);
      const data = await apiFetch(
        `${base}/values/${encodeURIComponent(name)}?key=${API_KEY}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`
      );
      const sheetRows = data.values || [];
      const txs = rowsToObjects(sheetRows)
        .map(raw => ({ ...parseExtraTransaction(raw, tabType), source: name, spreadsheet: label }))
        .filter(t => t.transactionDate && (t.amount !== 0 || t.type));
      return { name, tabType, headers: sheetRows[0] || [], count: txs.length, transactions: txs };
    })
  );

  const extraTxs = extraResults
    .filter(r => r.status === "fulfilled")
    .flatMap(r => r.value.transactions);

  // 4 — Build source list for this spreadsheet
  const sources = [
    { name: txSheetName, spreadsheet: label, tabType: "primary", count: primaryTxs.length },
    ...extraResults
      .filter(r => r.status === "fulfilled")
      .map(r => ({
        name:        r.value.name,
        spreadsheet: label,
        tabType:     r.value.tabType,
        count:       r.value.count,
        headers:     r.value.headers,
      })),
  ];

  return { transactions: [...primaryTxs, ...extraTxs], sources };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSheetData() {
  const [transactions, setTransactions] = useState([]);
  const [meta,         setMeta]         = useState([]);
  const [sheetSources, setSheetSources] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [lastFetched,  setLastFetched]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load all spreadsheets in parallel — failed ones are skipped, not fatal
      const results = await Promise.allSettled(
        SPREADSHEETS.map(cfg => loadSpreadsheet(cfg))
      );

      const allTransactions = results
        .filter(r => r.status === "fulfilled")
        .flatMap(r => r.value.transactions);

      const allSources = results
        .filter(r => r.status === "fulfilled")
        .flatMap(r => r.value.sources);

      // Surface partial errors as a warning (non-fatal)
      const failures = results
        .filter(r => r.status === "rejected")
        .map(r => r.reason?.message || "Unknown error");
      if (failures.length && !allTransactions.length) {
        throw new Error(failures.join(" | "));
      }

      setTransactions(allTransactions);
      setSheetSources(allSources);
      setLastFetched(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { transactions, meta, sheetSources, loading, error, refresh: load, lastFetched };
}
