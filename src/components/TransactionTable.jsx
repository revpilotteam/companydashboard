import { useState, useMemo } from "react";
import { fmt, normalizeDate } from "../utils/finance";

const TYPE_PILL = {
  Revenue:  "bg-emerald-100 text-emerald-700",
  Expense:  "bg-red-100    text-red-700",
  Transfer: "bg-blue-100   text-blue-700",
};
const CAT_PILL = {
  LTO:          "bg-indigo-100  text-indigo-700",
  Sales:        "bg-purple-100  text-purple-700",
  Affiliate:    "bg-amber-100   text-amber-700",
  Labor:        "bg-rose-100    text-rose-700",
  "CC Payment": "bg-orange-100  text-orange-700",
  Fees:         "bg-gray-100    text-gray-700",
  Referral:     "bg-teal-100    text-teal-700",
  Other:        "bg-slate-100   text-slate-700",
};

const PER_PAGE = 15;

export default function TransactionTable({ transactions }) {
  const [search, setSearch]     = useState("");
  const [typeF,  setTypeF]      = useState("All");
  const [catF,   setCatF]       = useState("All");
  const [sort,   setSort]       = useState({ field: "transactionDate", dir: "desc" });
  const [page,   setPage]       = useState(1);

  const categories = useMemo(() => ["All", ...Array.from(new Set(transactions.map(t => t.category))).sort()], [transactions]);
  const types      = ["All", "Revenue", "Expense", "Transfer"];

  function toggleSort(field) {
    setSort(s => ({ field, dir: s.field === field && s.dir === "asc" ? "desc" : "asc" }));
    setPage(1);
  }

  const filtered = useMemo(() => {
    return transactions
      .filter(t => {
        if (typeF !== "All" && t.type !== typeF) return false;
        if (catF  !== "All" && t.category !== catF) return false;
        if (search) {
          const q = search.toLowerCase();
          return [t.description, t.category, t.notes, t.type].some(v => String(v).toLowerCase().includes(q));
        }
        return true;
      })
      .sort((a, b) => {
        let av = sort.field === "transactionDate" ? normalizeDate(a.transactionDate) : a[sort.field];
        let bv = sort.field === "transactionDate" ? normalizeDate(b.transactionDate) : b[sort.field];
        if (typeof av === "string") av = av.toLowerCase(), bv = bv.toLowerCase();
        if (av < bv) return sort.dir === "asc" ? -1 : 1;
        if (av > bv) return sort.dir === "asc" ? 1 : -1;
        return 0;
      });
  }, [transactions, search, typeF, catF, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const rows  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const Th = ({ field, label }) => (
    <th className="text-left py-2 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 whitespace-nowrap select-none"
      onClick={() => toggleSort(field)}>
      {label} <span className="opacity-60">{sort.field === field ? (sort.dir === "asc" ? "▲" : "▼") : "⇅"}</span>
    </th>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 flex-1 min-w-max">Transactions</h2>
        <input className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          value={typeF} onChange={e => { setTypeF(e.target.value); setPage(1); }}>
          {types.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          value={catF} onChange={e => { setCatF(e.target.value); setPage(1); }}>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <span className="text-xs text-gray-300">{filtered.length} rows</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <Th field="transactionDate" label="Date" />
              <Th field="category"        label="Category" />
              <Th field="description"     label="Description" />
              <Th field="amount"          label="Amount" />
              <Th field="type"            label="Type" />
              <Th field="notes"           label="Notes" />
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-2 px-3 text-gray-500 whitespace-nowrap text-xs">{t.transactionDate}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CAT_PILL[t.category] || "bg-gray-100 text-gray-600"}`}>
                    {t.category}
                  </span>
                </td>
                <td className="py-2 px-3 text-gray-800 max-w-xs truncate">{t.description}</td>
                <td className={`py-2 px-3 font-semibold whitespace-nowrap ${t.type === "Revenue" ? "text-emerald-600" : t.type === "Expense" ? "text-rose-500" : "text-blue-500"}`}>
                  {t.type === "Revenue" ? "+" : t.type === "Expense" ? "−" : ""}{fmt(Math.abs(t.amount), true)}
                </td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_PILL[t.type] || ""}`}>{t.type}</span>
                </td>
                <td className="py-2 px-3 text-gray-400 text-xs">{t.notes}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-gray-300 text-sm">No matching transactions</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <button className="px-3 py-1 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span className="text-xs text-gray-400">Page {page} of {pages}</span>
          <button className="px-3 py-1 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
