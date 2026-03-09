import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { fmt, getYearMonth, getISOWeek, normalizeDate, getYear, formatYearMonth, formatWeek, formatDay, groupSum } from "../utils/finance";

const CAT_COLORS = {
  Software:      "#6366f1",
  Labor:         "#f43f5e",
  "CC Payment":  "#fb923c",
  Fees:          "#94a3b8",
  Education:     "#10b981",
  Other:         "#8b5cf6",
};
const PALETTE = ["#6366f1","#f43f5e","#fb923c","#10b981","#3b82f6","#a855f7","#f59e0b","#94a3b8","#14b8a6","#ec4899"];

function getPeriodKey(dateStr, groupBy) {
  if (groupBy === "year")  return getYear(dateStr);
  if (groupBy === "month") return getYearMonth(dateStr);
  if (groupBy === "week")  return getISOWeek(dateStr);
  if (groupBy === "day")   return normalizeDate(dateStr);
  return getYearMonth(dateStr);
}

function shortPeriodLabel(key, groupBy) {
  if (!key) return "";
  if (groupBy === "year") return key;
  if (groupBy === "month") {
    const [y, m] = key.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(m, 10) - 1]} '${y.slice(2)}`;
  }
  if (groupBy === "week") {
    const wMatch = key.match(/-W(\d+)/);
    const yMatch = key.match(/^(\d+)-W/);
    return wMatch && yMatch ? `Wk ${parseInt(wMatch[1], 10)}, '${yMatch[1].slice(2)}` : key;
  }
  if (groupBy === "day") {
    const parts = key.split("-");
    if (parts.length < 3) return key;
    const [, m, d] = parts;
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
  }
  return key;
}

function fullPeriodLabel(key, groupBy) {
  if (!key) return "";
  if (groupBy === "year")  return key;
  if (groupBy === "month") return formatYearMonth(key);
  if (groupBy === "week")  return formatWeek(key);
  if (groupBy === "day")   return formatDay(key);
  return key;
}

const CustomTooltip = ({ active, payload, label, groupBy, keyMap }) => {
  if (!active || !payload?.length) return null;
  const full = keyMap?.[label] || label;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm min-w-[190px]">
      <p className="font-semibold text-gray-700 mb-2">{full}</p>
      {[...payload].reverse().map(p => (
        <div key={p.name} className="flex justify-between gap-4 py-0.5">
          <span className="text-gray-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
            {p.name}
          </span>
          <span className="font-medium text-gray-700">{fmt(p.value)}</span>
        </div>
      ))}
      <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between">
        <span className="text-gray-500 font-medium">Total</span>
        <span className="font-bold text-gray-800">{fmt(total)}</span>
      </div>
    </div>
  );
};

export default function ExpenseControl({ transactions }) {
  const [groupBy, setGroupBy] = useState("month");

  const expenses = useMemo(() => transactions.filter(t => t.type === "Expense"), [transactions]);

  // All unique categories present in the expense data
  const categories = useMemo(() => {
    const cats = [...new Set(expenses.map(t => t.category).filter(Boolean))];
    return cats.sort();
  }, [expenses]);

  // Category totals (summary cards)
  const catTotals = useMemo(() => groupSum(expenses, t => t.category || "Other"), [expenses]);
  const totalExpenses = catTotals.reduce((s, c) => s + c.value, 0);

  // Labor breakdown: team members vs contractors
  const laborBreakdown = useMemo(() => {
    const labor = expenses.filter(t => t.category === "Labor");
    const teamMembers = labor
      .filter(t => String(t.description || "").startsWith("Team Payment - "))
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const contractors = labor
      .filter(t => String(t.description || "").startsWith("Outside Service - "))
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const other = labor.reduce((s, t) => s + Math.abs(t.amount), 0) - teamMembers - contractors;
    return { teamMembers, contractors, other };
  }, [expenses]);

  // Chart data: grouped by period, columns per category
  const { chartData, keyMap } = useMemo(() => {
    const periodMap = {};
    expenses.forEach(t => {
      const key = getPeriodKey(t.transactionDate, groupBy);
      if (!key) return;
      if (!periodMap[key]) periodMap[key] = { _key: key };
      const cat = t.category || "Other";
      periodMap[key][cat] = (periodMap[key][cat] || 0) + Math.abs(t.amount);
    });
    const map = {};
    const data = Object.entries(periodMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, row]) => {
        const short = shortPeriodLabel(key, groupBy);
        map[short] = fullPeriodLabel(key, groupBy);
        return { ...row, period: short };
      });
    return { chartData: data, keyMap: map };
  }, [expenses, groupBy]);

  const groupByOptions = [
    { value: "month", label: "Monthly" },
    { value: "week",  label: "Weekly"  },
    { value: "year",  label: "Yearly"  },
    { value: "day",   label: "Daily"   },
  ];

  const showLaborBreakdown = laborBreakdown.teamMembers + laborBreakdown.contractors + laborBreakdown.other > 0;

  return (
    <div className="space-y-6">

      {/* ── Section header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Expense Control</h2>
          <p className="text-sm text-gray-400">Spending breakdown by category — filtered by the period selector above</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Chart view:</span>
          {groupByOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setGroupBy(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                groupBy === opt.value
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Category summary cards ─────────────────────────────────────────── */}
      {catTotals.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {catTotals.map(({ name, value }, i) => {
            const pct = totalExpenses > 0 ? ((value / totalExpenses) * 100).toFixed(1) : "0";
            const color = CAT_COLORS[name] || PALETTE[i % PALETTE.length];
            return (
              <div key={name} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 truncate">{name}</p>
                </div>
                <p className="text-xl font-bold text-gray-900">{fmt(value)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{pct}% of expenses</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-300 text-sm">
          No expense data for the selected period
        </div>
      )}

      {/* ── Labor breakdown card ────────────────────────────────────────────── */}
      {showLaborBreakdown && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Labor Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            {[
              { label: "Team Members", value: laborBreakdown.teamMembers, color: "#f97316" },
              { label: "Contractors",  value: laborBreakdown.contractors,  color: "#ef4444" },
              ...(laborBreakdown.other > 0
                ? [{ label: "Other Labor", value: laborBreakdown.other, color: "#94a3b8" }]
                : []),
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  {label}
                </p>
                <p className="text-xl font-bold text-gray-800">{fmt(value)}</p>
                {totalExpenses > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {((value / totalExpenses) * 100).toFixed(1)}% of total expenses
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Spending by category over time chart ───────────────────────────── */}
      {chartData.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
            Spending by Category &mdash; {groupByOptions.find(o => o.value === groupBy)?.label}
          </h3>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: groupBy === "week" ? 30 : 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
                angle={groupBy === "week" || groupBy === "day" ? -35 : 0}
                textAnchor={groupBy === "week" || groupBy === "day" ? "end" : "middle"}
                interval={chartData.length > 16 ? "preserveStartEnd" : 0}
              />
              <YAxis
                tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip
                content={<CustomTooltip groupBy={groupBy} keyMap={keyMap} />}
                cursor={{ fill: "#f8fafc" }}
              />
              <Legend
                formatter={v => <span style={{ fontSize: 12, color: "#374151" }}>{v}</span>}
                iconSize={9}
                iconType="circle"
              />
              {categories.map((cat, i) => (
                <Bar
                  key={cat}
                  dataKey={cat}
                  stackId="stack"
                  fill={CAT_COLORS[cat] || PALETTE[i % PALETTE.length]}
                  radius={i === categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={72}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-300 text-sm">
          No expense data to chart for the selected period
        </div>
      )}

      {/* ── Per-category period table ───────────────────────────────────────── */}
      {chartData.length > 0 && categories.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Detailed Breakdown — {groupByOptions.find(o => o.value === groupBy)?.label}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-gray-100">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Period</th>
                  {categories.map(cat => (
                    <th key={cat} className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      {cat}
                    </th>
                  ))}
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row, idx) => {
                  const rowTotal = categories.reduce((s, cat) => s + (row[cat] || 0), 0);
                  const fullLabel = keyMap[row.period] || row.period;
                  return (
                    <tr key={idx} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-2.5 text-gray-700 font-medium whitespace-nowrap">{fullLabel}</td>
                      {categories.map(cat => (
                        <td key={cat} className="px-4 py-2.5 text-right text-gray-600 tabular-nums whitespace-nowrap">
                          {row[cat] ? fmt(row[cat]) : <span className="text-gray-200">—</span>}
                        </td>
                      ))}
                      <td className="px-5 py-2.5 text-right font-semibold text-gray-800 tabular-nums whitespace-nowrap">{fmt(rowTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-100 bg-gray-50">
                  <td className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Total</td>
                  {categories.map(cat => (
                    <td key={cat} className="px-4 py-3 text-right font-semibold text-gray-700 tabular-nums whitespace-nowrap">
                      {fmt(chartData.reduce((s, row) => s + (row[cat] || 0), 0))}
                    </td>
                  ))}
                  <td className="px-5 py-3 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap">
                    {fmt(totalExpenses)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
