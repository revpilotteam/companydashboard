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

/** Return YYYY from a date string */
export function getYear(dateStr) {
  const n = normalizeDate(dateStr);
  return n.length >= 4 ? n.slice(0, 4) : "";
}

/** Return YYYY-MM from a date string */
export function getYearMonth(dateStr) {
  const n = normalizeDate(dateStr);
  return n.slice(0, 7);
}

/** Return ISO week string YYYY-Www from a date string */
export function getISOWeek(dateStr) {
  const n = normalizeDate(dateStr);
  if (!n || n.length < 10) return "";
  const d = new Date(n + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  // Thursday of the current week determines the ISO year
  const thu = new Date(d);
  thu.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(thu.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((thu - yearStart) / 86400000) + 1) / 7);
  return `${thu.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Format YYYY-MM as "Jan 2026" */
export function formatYearMonth(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

/** Format YYYY-Www as "Jan 5–11, 2026" */
export function formatWeek(yw) {
  if (!yw) return "";
  const [yearStr, wStr] = yw.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(wStr, 10);
  if (isNaN(year) || isNaN(week)) return yw;
  // ISO week 1's Monday is the Monday on or before Jan 4
  const jan4 = new Date(year, 0, 4);
  const mon1 = new Date(jan4);
  mon1.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1));
  const weekStart = new Date(mon1);
  weekStart.setDate(mon1.getDate() + (week - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}–${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
  }
  return `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${year}`;
}

/** Format YYYY-MM-DD as "Jan 5, 2026" */
export function formatDay(d) {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length < 3) return d;
  const [y, m, day] = parts;
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(day, 10)}, ${y}`;
}

/** Return true if the transaction date matches the given filter type and value */
export function matchesPeriod(dateStr, type, value) {
  if (type === "All" || !value) return true;
  if (type === "year")  return getYear(dateStr) === value;
  if (type === "month") return getYearMonth(dateStr) === value;
  if (type === "week")  return getISOWeek(dateStr) === value;
  if (type === "day")   return normalizeDate(dateStr) === value;
  return true;
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
