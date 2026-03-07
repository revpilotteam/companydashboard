import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { fmt } from "../utils/finance";

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const rev = payload.find(p => p.dataKey === "revenue")?.value || 0;
  const exp = payload.find(p => p.dataKey === "expenses")?.value || 0;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm min-w-[160px]">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      <p className="text-emerald-600">Revenue:  {fmt(rev)}</p>
      <p className="text-rose-500">Expenses: {fmt(exp)}</p>
      <p className={`border-t border-gray-100 mt-2 pt-2 font-semibold ${rev - exp >= 0 ? "text-blue-600" : "text-red-600"}`}>
        Net: {fmt(rev - exp)}
      </p>
    </div>
  );
};

export default function MonthlyChart({ data }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Revenue vs Expenses — by Month</h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip />} cursor={{ fill: "#f9fafb" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="revenue"  name="Revenue"  fill="#10b981" radius={[4,4,0,0]} maxBarSize={48} />
          <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4,4,0,0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
