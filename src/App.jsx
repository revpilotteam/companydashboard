import { useMemo, useState } from "react";
import { useSheetData } from "./hooks/useSheetData";
import {
  fmt, getYear, getYearMonth, getISOWeek, normalizeDate,
  formatYearMonth, formatWeek, formatDay,
  byMonth, groupSum, teamName, serviceType, matchesPeriod,
} from "./utils/finance";
import LoadingScreen    from "./components/LoadingScreen";
import ErrorScreen      from "./components/ErrorScreen";
import KPICard          from "./components/KPICard";
import MonthlyChart     from "./components/MonthlyChart";
import DonutChart       from "./components/DonutChart";
import TeamChart        from "./components/TeamChart";
import BalanceChart     from "./components/BalanceChart";
import ServiceTypeChart from "./components/ServiceTypeChart";
import TopClients       from "./components/TopClients";
import TransactionTable from "./components/TransactionTable";
import ChatBot         from "./components/ChatBot";
import ExpenseControl  from "./components/ExpenseControl";

export default function App() {
  const { transactions, loading, error, refresh, lastFetched, sheetSources } = useSheetData();
  const [activeTab,   setActiveTab]   = useState("overview");
  const [filterType,  setFilterType]  = useState("All");
  const [filterValue, setFilterValue] = useState("");

  // ── Period options for dropdowns (always derived from all transactions) ─────
  const periodOptions = useMemo(() => {
    const years  = [...new Set(transactions.map(t => getYear(t.transactionDate)).filter(Boolean))].sort();
    const months = [...new Set(transactions.map(t => getYearMonth(t.transactionDate)).filter(Boolean))].sort();
    const weeks  = [...new Set(transactions.map(t => getISOWeek(t.transactionDate)).filter(Boolean))].sort();
    const days   = [...new Set(transactions.map(t => normalizeDate(t.transactionDate)).filter(Boolean))].sort();
    return { years, months, weeks, days };
  }, [transactions]);

  // Current value options for the second dropdown
  const currentOptions = useMemo(() => {
    switch (filterType) {
      case "year":  return periodOptions.years.map(v => ({ value: v, label: v }));
      case "month": return periodOptions.months.map(v => ({ value: v, label: formatYearMonth(v) }));
      case "week":  return periodOptions.weeks.map(v => ({ value: v, label: formatWeek(v) }));
      case "day":   return periodOptions.days.map(v => ({ value: v, label: formatDay(v) }));
      default: return [];
    }
  }, [filterType, periodOptions]);

  // Human-readable label for the active filter period
  const periodLabel = useMemo(() => {
    if (filterType === "All" || !filterValue) return "All time";
    if (filterType === "year")  return filterValue;
    if (filterType === "month") return formatYearMonth(filterValue);
    if (filterType === "week")  return formatWeek(filterValue);
    if (filterType === "day")   return formatDay(filterValue);
    return "All time";
  }, [filterType, filterValue]);

  // ── Filtered set ────────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    (filterType === "All" || !filterValue)
      ? transactions
      : transactions.filter(t => matchesPeriod(t.transactionDate, filterType, filterValue)),
    [transactions, filterType, filterValue]
  );

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const revenue  = filtered.filter(t => t.type === "Revenue").reduce((s, t) => s + Math.abs(t.amount), 0);
    const expenses = filtered.filter(t => t.type === "Expense").reduce((s, t) => s + Math.abs(t.amount), 0);
    const net      = revenue - expenses;
    const sorted   = [...filtered].filter(t => t.balance).sort((a, b) => normalizeDate(a.bankDate).localeCompare(normalizeDate(b.bankDate)));
    const balance  = sorted.at(-1)?.balance ?? 0;
    const margin   = revenue > 0 ? ((net / revenue) * 100).toFixed(1) : "0";
    return { revenue, expenses, net, balance, margin, count: filtered.length };
  }, [filtered]);

  // ── Monthly chart ────────────────────────────────────────────────────────────
  const monthlyData = useMemo(() => byMonth(filtered), [filtered]);

  // ── Revenue by category ──────────────────────────────────────────────────────
  const revByCat = useMemo(() =>
    groupSum(filtered, t => t.category, t => t.type === "Revenue"),
    [filtered]
  );

  // ── Expense by category ──────────────────────────────────────────────────────
  const expByCat = useMemo(() =>
    groupSum(filtered, t => t.category, t => t.type === "Expense"),
    [filtered]
  );

  // ── Team payments ───────────────────────────────────────────────────────────
  const teamData = useMemo(() =>
    groupSum(filtered, t => teamName(t.description), t => t.category === "Labor"),
    [filtered]
  );

  // ── Running balance ──────────────────────────────────────────────────────────
  const balanceData = useMemo(() =>
    [...filtered]
      .filter(t => t.balance && t.bankDate)
      .sort((a, b) => normalizeDate(a.bankDate).localeCompare(normalizeDate(b.bankDate)))
      .map(t => ({ label: t.bankDate, balance: t.balance })),
    [filtered]
  );

  // ── Service type stacked chart ───────────────────────────────────────────────
  const serviceData = useMemo(() => {
    const months = [...new Set(filtered.map(t => getYearMonth(t.transactionDate)).filter(Boolean))].sort();
    const monthMap = {};
    months.forEach(m => {
      monthMap[m] = { month: formatYearMonth(m), Build: 0, Consulting: 0, "Continued Support": 0, Other: 0 };
    });
    filtered.filter(t => t.category === "Sales" && t.type === "Revenue").forEach(t => {
      const m = getYearMonth(t.transactionDate);
      if (monthMap[m]) monthMap[m][serviceType(t.notes)] += Math.abs(t.amount);
    });
    return Object.values(monthMap);
  }, [filtered]);

  // ── Top clients ──────────────────────────────────────────────────────────────
  const topClients = useMemo(() =>
    groupSum(filtered, t => t.description, t => t.category === "Sales" && t.type === "Revenue").slice(0, 8),
    [filtered]
  );

  // ── Revenue stream cards ─────────────────────────────────────────────────────
  const streams = useMemo(() => {
    const recurring  = filtered.filter(t => t.notes === "Continued Support" && t.type === "Revenue").reduce((s, t) => s + t.amount, 0);
    const project    = filtered.filter(t => ["Build", "Consulting"].includes(t.notes) && t.type === "Revenue").reduce((s, t) => s + t.amount, 0);
    const affiliate  = filtered.filter(t => ["Affiliate", "Referral"].includes(t.category) && t.type === "Revenue").reduce((s, t) => s + t.amount, 0);
    const lto        = filtered.filter(t => t.category === "LTO" && t.type === "Revenue").reduce((s, t) => s + t.amount, 0);
    return { recurring, project, affiliate, lto };
  }, [filtered]);

  // ── Render states ────────────────────────────────────────────────────────────
  if (loading) return <LoadingScreen />;
  if (error)   return <ErrorScreen error={error} onRetry={refresh} />;

  const valueDropdownLabel =
    filterType === "year"  ? "All Years"  :
    filterType === "month" ? "All Months" :
    filterType === "week"  ? "All Weeks"  :
    filterType === "day"   ? "All Days"   : "";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Financial Dashboard</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Live from Google Sheets
              {sheetSources.length > 1 && ` · ${sheetSources.length} tabs`}
              {" · "}{transactions.length} transactions
              {lastFetched && ` · Updated ${lastFetched.toLocaleTimeString()}`}
            </p>
          </div>
          {/* ── Tab navigation ── */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { id: "overview", label: "Overview" },
              { id: "expenses", label: "Expense Control" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.id
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Period:</label>
            {/* Filter type selector */}
            <select
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
              value={filterType}
              onChange={e => { setFilterType(e.target.value); setFilterValue(""); }}
            >
              <option value="All">All Time</option>
              <option value="year">Year</option>
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
            </select>
            {/* Value selector — only shown when a filter type is active */}
            {filterType !== "All" && (
              <select
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={filterValue}
                onChange={e => setFilterValue(e.target.value)}
              >
                <option value="">{valueDropdownLabel}</option>
                {currentOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              title="Refresh data from Google Sheets"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Expense Control tab ──────────────────────────────────────────── */}
        {activeTab === "expenses" && (
          <ExpenseControl transactions={filtered} />
        )}

        {/* ── Overview tab ────────────────────────────────────────────────── */}
        {activeTab === "overview" && (<>

        {/* ── KPI cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KPICard title="Total Revenue"  value={fmt(kpis.revenue)}  subtitle={`${kpis.count} transactions`} color="green"  icon="📈" />
          <KPICard title="Total Expenses" value={fmt(kpis.expenses)} color="red"    icon="📉" />
          <KPICard title="Net Income"     value={fmt(kpis.net)}      subtitle={`${kpis.margin}% margin`}     color={kpis.net >= 0 ? "blue" : "red"} icon="💰" />
          <KPICard title="Bank Balance"   value={fmt(kpis.balance)}  subtitle="Latest balance"               color="purple" icon="🏦" />
          <KPICard title="Transactions"   value={kpis.count}         subtitle={periodLabel}                  color="amber"  icon="📋" />
        </div>

        {/* ── Monthly bar chart ────────────────────────────────────────────── */}
        <MonthlyChart data={monthlyData} />

        {/* ── Revenue / Expense donuts ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <DonutChart data={revByCat} title="Revenue by Category" />
          <DonutChart data={expByCat} title="Expenses by Category" />
        </div>

        {/* ── Service type + team payments ─────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ServiceTypeChart data={serviceData} />
          <TeamChart data={teamData} />
        </div>

        {/* ── Balance chart + top clients ──────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {balanceData.length > 0 && <BalanceChart data={balanceData} />}
          <TopClients data={topClients} />
        </div>

        {/* ── Revenue stream breakdown ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "LTO Revenue",        desc: "Low-ticket offers",            value: streams.lto,       color: "indigo" },
            { label: "Project Revenue",    desc: "Build + Consulting",           value: streams.project,   color: "purple" },
            { label: "Recurring Revenue",  desc: "Continued Support retainers",  value: streams.recurring, color: "green"  },
            { label: "Affiliate / Referral", desc: "Whop, Close, PartnerStack",  value: streams.affiliate, color: "amber"  },
          ].map(({ label, desc, value, color }) => {
            const pct = kpis.revenue > 0 ? ((value / kpis.revenue) * 100).toFixed(1) : "0";
            const colorMap = {
              indigo: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", sub: "text-indigo-400" },
              purple: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", sub: "text-purple-400" },
              green:  { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", sub: "text-emerald-400" },
              amber:  { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", sub: "text-amber-400" },
            }[color];
            return (
              <div key={label} className={`rounded-xl border ${colorMap.border} ${colorMap.bg} p-4`}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">{label}</p>
                <p className={`text-xl font-bold mt-1 ${colorMap.text}`}>{fmt(value)}</p>
                <p className={`text-xs mt-0.5 ${colorMap.sub}`}>{pct}% of revenue</p>
                <p className="text-[11px] text-gray-400 mt-1">{desc}</p>
              </div>
            );
          })}
        </div>

        {/* ── Transaction table ────────────────────────────────────────────── */}
        <TransactionTable transactions={filtered} />

        <ChatBot
          transactions={filtered}
          kpis={kpis}
          streams={streams}
          periodLabel={periodLabel}
        />

        </>)}

        <footer className="text-center text-xs text-gray-300 pb-4">
          Data pulled live from Google Sheets
          {sheetSources.length > 0 && ` · Tabs: ${sheetSources.map(s => s.name).join(", ")}`}
          {" · "}Spreadsheet ID: {import.meta.env.VITE_SPREADSHEET_ID || "1N3D-jywleiBhsxByuK-Mq17sJpFIZYvo3Is4RmxkLkg"}
        </footer>
      </main>
    </div>
  );
}
