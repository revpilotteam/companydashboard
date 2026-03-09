// API key — override via VITE_API_KEY environment variable (Netlify / .env.local)
export const API_KEY = import.meta.env.VITE_API_KEY || "AIzaSyD2SAjNpnnAYIIyltC5JnSRuSjhyLb4oVc";

/**
 * Add as many spreadsheets as you like.
 * Each entry is loaded in parallel and all transactions are merged together.
 *
 * Fields:
 *   id     — Google Spreadsheet ID (from the URL)
 *   txGid  — Sheet GID of the primary transactions tab (0 = first tab)
 *            Set to null to skip the GID lookup and just use the first tab.
 *   label  — Friendly name shown in the data-source footer
 */
export const SPREADSHEETS = [
  {
    id:    import.meta.env.VITE_SPREADSHEET_ID || "1tI22r-QsXc61owRae_yOO4VMqvl45r8lBg73N58JTb0",
    txGid: 1682070851,
    label: "Main",
  },

  // ── Add more spreadsheets below ───────────────────────────────────────────
  // { id: "YOUR_SPREADSHEET_ID_HERE", txGid: 0, label: "Sales 2025" },
  // { id: "ANOTHER_SPREADSHEET_ID",   txGid: 0, label: "Contractors" },
];
