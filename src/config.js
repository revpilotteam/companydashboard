// Values are read from environment variables (set in Netlify dashboard or .env.local).
// Fallbacks are provided so local dev works without any setup.
export const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID || "1tI22r-QsXc61owRae_yOO4VMqvl45r8lBg73N58JTb0";
export const API_KEY        = import.meta.env.VITE_API_KEY        || "AIzaSyD2SAjNpnnAYIIyltC5JnSRuSjhyLb4oVc";

// Sheet GIDs — used to identify tabs by ID even if names change.
// If GIDs don't match (e.g. a copied sheet), the app falls back to the first two tabs.
export const TX_GID   = 1605407619; // primary transactions sheet (Transactions_2025)
export const META_GID = 1682070851; // Expense Control summary sheet
