import { useState, useEffect, useCallback } from "react";
import { SPREADSHEET_ID, API_KEY, TX_GID, META_GID } from "../config";

const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(url) {
  const res = await fetch(url);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      msg = json?.error?.message || msg;
    } catch (_) {}
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

/**
 * Flexible key lookup — matches header names case-insensitively.
 * Returns the first value whose key contains any of the given substrings.
 */
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

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSheetData() {
  const [transactions, setTransactions] = useState([]);
  const [meta,         setMeta]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [lastFetched,  setLastFetched]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1 — fetch spreadsheet metadata to resolve sheet names from GIDs
      const metaJson = await apiFetch(
        `${BASE}?key=${API_KEY}&fields=sheets.properties`
      ).catch(e => {
        throw new Error(
          `${e.message}. Make sure the spreadsheet is shared as "Anyone with the link can view" and Google Sheets API is enabled in your Google Cloud project.`
        );
      });

      const sheetsInfo = metaJson.sheets || [];
      const gidMap = Object.fromEntries(
        sheetsInfo.map(({ properties: p }) => [p.sheetId, p.title])
      );

      // Resolve sheet names; fall back to first / second tab if GID not found
      const txSheetName   = gidMap[TX_GID]   ?? sheetsInfo[0]?.properties?.title;
      const metaSheetName = gidMap[META_GID]  ?? sheetsInfo[1]?.properties?.title;

      if (!txSheetName) throw new Error("No sheets found in the spreadsheet.");

      // Step 2 — fetch transaction sheet
      const txData = await apiFetch(
        `${BASE}/values/${encodeURIComponent(txSheetName)}?key=${API_KEY}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`
      );
      const rows = txData.values || [];
      const parsed = rowsToObjects(rows)
        .map(parseTransaction)
        .filter(t => t.transactionDate && (t.amount !== 0 || t.type));

      setTransactions(parsed);

      // Step 3 — fetch second sheet (categories/summary) if it exists
      if (metaSheetName && metaSheetName !== txSheetName) {
        try {
          const metaData = await apiFetch(
            `${BASE}/values/${encodeURIComponent(metaSheetName)}?key=${API_KEY}&valueRenderOption=UNFORMATTED_VALUE`
          );
          setMeta(rowsToObjects(metaData.values || []));
        } catch (_) {
          // Non-critical — ignore if second sheet fails
        }
      }

      setLastFetched(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { transactions, meta, loading, error, refresh: load, lastFetched };
}
