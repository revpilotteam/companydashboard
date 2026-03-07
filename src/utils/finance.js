/** Format a number as USD currency (no cents for large values) */
export function fmt(val, full = false) {
  if (isNaN(val)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: full ? 2 : 0,
    maximumFractionDigits: full ? 2 : 0,
  }).format(val);
}

/** Parse a date string into a sortable YYYY-MM-DD string */
export function normalizeDate(str) {
  if (!str) return "";
  // Handle M/D/YYYY or MM/DD/YYYY
  const parts = String(str).split("/");
  if (parts.length === 3) {
    const [m, d, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return String(str);
}

/** Return YYYY-MM from a date string */
export function getYearMonth(dateStr) {
  const n = normalizeDate(dateStr);
  return n.slice(0, 7);
}

/** Format YYYY-MM as "Jan 2026" */
export function formatYearMonth(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

/** Aggregate transactions by month */
export function byMonth(transactions) {
  const map = {};
  transactions.forEach((t) => {
    const ym = getYearMonth(t.transactionDate);
    if (!ym) return;
    if (!map[ym]) map[ym] = { month: formatYearMonth(ym), revenue: 0, expenses: 0, net: 0 };
    if (t.type === "Revenue")  map[ym].revenue  += Math.abs(t.amount);
    if (t.type === "Expense")  map[ym].expenses += Math.abs(t.amount);
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ ...v, net: v.revenue - v.expenses }));
}

/** Sum amounts by a grouping key */
export function groupSum(transactions, keyFn, filterFn = () => true) {
  const map = {};
  transactions.filter(filterFn).forEach((t) => {
    const k = keyFn(t);
    if (!k) return;
    map[k] = (map[k] || 0) + Math.abs(t.amount);
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Extract the team member name from a Labor description */
export function teamName(description) {
  if (!description) return "Unknown";
  if (description.startsWith("Team Payment - ")) return description.replace("Team Payment - ", "");
  if (description.startsWith("Outside Service - ")) return description.replace("Outside Service - ", "") + " (Contractor)";
  return description;
}

/** Determine service type label from notes */
export function serviceType(notes) {
  const n = String(notes || "").trim();
  if (["Build", "Consulting", "Continued Support"].includes(n)) return n;
  return "Other";
}
