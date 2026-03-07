import { useState } from "react";
import { formatCurrencyFull } from "../data/transactions";

const TYPE_COLORS = {
  Revenue: "bg-emerald-100 text-emerald-700",
  Expense: "bg-red-100 text-red-700",
  Transfer: "bg-blue-100 text-blue-700",
};

const CAT_COLORS = {
  LTO: "bg-indigo-100 text-indigo-700",
  Sales: "bg-purple-100 text-purple-700",
  Affiliate: "bg-amber-100 text-amber-700",
  Labor: "bg-rose-100 text-rose-700",
  "CC Payment": "bg-orange-100 text-orange-700",
  Fees: "bg-gray-100 text-gray-700",
  Referral: "bg-teal-100 text-teal-700",
  Other: "bg-slate-100 text-slate-700",
};

export default function TransactionTable({ transactions }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [catFilter, setCatFilter] = useState("All");
  const [sortField, setSortField] = useState("transactionDate");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;

  const categories = ["All", ...Array.from(new Set(transactions.map((t) => t.category)))];
  const types = ["All", "Revenue", "Expense", "Transfer"];

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
    setPage(1);
  }

  const filtered = transactions
    .filter((t) => {
      if (typeFilter !== "All" && t.type !== typeFilter) return false;
      if (catFilter !== "All" && t.category !== catFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      let av = a[sortField], bv = b[sortField];
      if (typeof av === "string") av = av.toLowerCase(), bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const SortIcon = ({ field }) => (
    <span className="ml-1 opacity-50 text-xs">
      {sortField === field ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 flex-1">Transactions</h2>
        <input
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          placeholder="Search…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
        >
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          value={catFilter}
          onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}
        >
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <span className="text-xs text-gray-400">{filtered.length} results</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {[["transactionDate", "Date"], ["category", "Category"], ["description", "Description"], ["amount", "Amount"], ["type", "Type"], ["notes", "Notes"]].map(([field, label]) => (
                <th
                  key={field}
                  className="text-left py-2 px-3 text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-800 whitespace-nowrap"
                  onClick={() => toggleSort(field)}
                >
                  {label}<SortIcon field={field} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((t, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{t.transactionDate.replace("2026-", "").replace("2025-", "25/")}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CAT_COLORS[t.category] || "bg-gray-100 text-gray-600"}`}>
                    {t.category}
                  </span>
                </td>
                <td className="py-2 px-3 text-gray-800 max-w-xs truncate">{t.description}</td>
                <td className={`py-2 px-3 font-semibold whitespace-nowrap ${t.type === "Revenue" ? "text-emerald-600" : t.type === "Expense" ? "text-red-500" : "text-blue-500"}`}>
                  {t.type === "Revenue" ? "+" : t.type === "Expense" ? "−" : ""}{formatCurrencyFull(Math.abs(t.amount))}
                </td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[t.type] || ""}`}>
                    {t.type}
                  </span>
                </td>
                <td className="py-2 px-3 text-gray-400 text-xs">{t.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm">
          <button
            className="px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >← Prev</button>
          <span className="text-gray-400 text-xs">Page {page} of {totalPages}</span>
          <button
            className="px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >Next →</button>
        </div>
      )}
    </div>
  );
}
