import { useMemo, useState } from "react";
import { transactions, getMonth, formatMonth, formatCurrency } from "./data/transactions";
import KPICard from "./components/KPICard";
import MonthlyChart from "./components/MonthlyChart";
import CategoryDonut from "./components/CategoryDonut";
import TeamPaymentsChart from "./components/TeamPaymentsChart";
import BalanceChart from "./components/BalanceChart";
import ServiceTypeChart from "./components/ServiceTypeChart";
import TransactionTable from "./components/TransactionTable";

const ALL_MONTHS = [...new Set(transactions.map((t) => getMonth(t.transactionDate)))].sort();

export default function App() {
  const [selectedMonth, setSelectedMonth] = useState("All");

  const filtered = useMemo(() => {
    if (selectedMonth === "All") return transactions;
    return transactions.filter((t) => getMonth(t.transactionDate) === selectedMonth);
  }, [selectedMonth]);

  // KPI calculations
  const { totalRevenue, totalExpenses, netIncome, currentBalance, txCount } = useMemo(() => {
    const revenue = filtered.filter((t) => t.type === "Revenue").reduce((s, t) => s + Math.abs(t.amount), 0);
    const expenses = filtered.filter((t) => t.type === "Expense").reduce((s, t) => s + Math.abs(t.amount), 0);
    const sorted = [...filtered].sort((a, b) => a.bankDate.localeCompare(b.bankDate));
    const bal = sorted.length ? sorted[sorted.length - 1].balance : 0;
    return { totalRevenue: revenue, totalExpenses: expenses, netIncome: revenue - expenses, currentBalance: bal, txCount: filtered.length };
  }, [filtered]);

  // Monthly bar chart data
  const monthlyData = useMemo(() => {
    return ALL_MONTHS.map((m) => {
      const tx = transactions.filter((t) => getMonth(t.transactionDate) === m);
      return {
        month: formatMonth(m),
        revenue: tx.filter((t) => t.type === "Revenue").reduce((s, t) => s + Math.abs(t.amount), 0),
        expenses: tx.filter((t) => t.type === "Expense").reduce((s, t) => s + Math.abs(t.amount), 0),
      };
    });
  }, []);

  // Revenue by category donut
  const revByCat = useMemo(() => {
    const map = {};
    filtered.filter((t) => t.type === "Revenue").forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  // Expense by category donut
  const expByCat = useMemo(() => {
    const map = {};
    filtered.filter((t) => t.type === "Expense").forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  // Team payments (always all-time for full picture)
  const teamPayments = useMemo(() => {
    const map = {};
    transactions.filter((t) => t.category === "Labor").forEach((t) => {
      let name = t.description;
      if (name.startsWith("Team Payment - ")) name = name.replace("Team Payment - ", "");
      else if (name.startsWith("Outside Service - ")) name = name.replace("Outside Service - ", "") + " (Contractor)";
      map[name] = (map[name] || 0) + t.amount;
    });
    return Object.entries(map)
      .map(([name, total]) => ({ name, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total);
  }, []);

  // Balance over time
  const balanceData = useMemo(() => {
    return [...transactions]
      .sort((a, b) => a.bankDate.localeCompare(b.bankDate))
      .map((t) => ({
        date: t.bankDate.slice(5),
        balance: t.balance,
      }));
  }, []);

  // Service type stacked bar
  const serviceTypeData = useMemo(() => {
    return ALL_MONTHS.map((m) => {
      const tx = transactions.filter((t) => getMonth(t.transactionDate) === m && t.category === "Sales");
      const result = { month: formatMonth(m), Build: 0, Consulting: 0, "Continued Support": 0, Other: 0 };
      tx.forEach((t) => {
        const key = ["Build", "Consulting", "Continued Support"].includes(t.notes) ? t.notes : "Other";
        result[key] += t.amount;
      });
      return result;
    });
  }, []);

  // Top clients
  const topClients = useMemo(() => {
    const map = {};
    filtered.filter((t) => t.type === "Revenue" && t.category === "Sales").forEach((t) => {
      map[t.description] = (map[t.description] || 0) + t.amount;
    });
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [filtered]);

  const margin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) : "0";

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Financial Dashboard</h1>
            <p className="text-xs text-gray-400 mt-0.5">Dec 2025 – Mar 2026 · {transactions.length} transactions</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Period:</span>
            <select
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="All">All Time</option>
              {ALL_MONTHS.map((m) => (
                <option key={m} value={m}>{formatMonth(m)}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard title="Total Revenue" value={formatCurrency(totalRevenue)} subtitle={`${txCount} transactions`} color="green" icon="↑" />
          <KPICard title="Total Expenses" value={formatCurrency(totalExpenses)} color="red" icon="↓" />
          <KPICard title="Net Income" value={formatCurrency(netIncome)} subtitle={`${margin}% margin`} color={netIncome >= 0 ? "blue" : "red"} icon="=" />
          <KPICard title="Bank Balance" value={formatCurrency(currentBalance)} subtitle="Latest balance" color="purple" icon="$" />
          <KPICard title="Transactions" value={txCount} subtitle={selectedMonth === "All" ? "All time" : formatMonth(selectedMonth)} color="amber" icon="#" />
        </div>

        {/* Monthly Revenue vs Expenses */}
        <MonthlyChart data={monthlyData} />

        {/* Donut charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CategoryDonut data={revByCat} title="Revenue by Category" />
          <CategoryDonut data={expByCat} title="Expenses by Category" />
        </div>

        {/* Service type + team */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ServiceTypeChart data={serviceTypeData} />
          <TeamPaymentsChart data={teamPayments} />
        </div>

        {/* Balance chart + top clients */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <BalanceChart data={balanceData} />

          {/* Top clients */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">Top Clients by Revenue</h2>
            <div className="space-y-2">
              {topClients.map(({ name, total }, i) => {
                const max = topClients[0].total;
                const pct = (total / max) * 100;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 truncate max-w-xs">{name}</span>
                      <span className="text-gray-800 font-semibold ml-2 whitespace-nowrap">{formatCurrency(total)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {topClients.length === 0 && <p className="text-gray-400 text-sm">No sales data for selected period.</p>}
            </div>
          </div>
        </div>

        {/* Revenue stream breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Recurring Revenue", desc: "Continued Support clients", value: filtered.filter(t => t.notes === "Continued Support").reduce((s, t) => s + t.amount, 0), color: "text-emerald-600" },
            { label: "Project Revenue", desc: "Build & Consulting", value: filtered.filter(t => ["Build", "Consulting"].includes(t.notes)).reduce((s, t) => s + t.amount, 0), color: "text-indigo-600" },
            { label: "Affiliate & Referral", desc: "Whop, Close, PartnerStack, etc.", value: filtered.filter(t => ["Affiliate", "Referral"].includes(t.category) && t.type === "Revenue").reduce((s, t) => s + t.amount, 0), color: "text-amber-600" },
          ].map(({ label, desc, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{formatCurrency(value)}</p>
              <p className="text-xs text-gray-400 mt-1">{desc}</p>
            </div>
          ))}
        </div>

        {/* Transaction table */}
        <TransactionTable transactions={filtered} />

        <footer className="text-center text-xs text-gray-300 pb-4">
          Financial data through {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </footer>
      </main>
    </div>
  );
}
