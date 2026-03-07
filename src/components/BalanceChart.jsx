import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fmt } from "../utils/finance";

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      <p className="text-indigo-600 font-semibold">{fmt(payload[0].value)}</p>
    </div>
  );
};

export default function BalanceChart({ data }) {
  const min = Math.min(...data.map(d => d.balance)) * 0.95;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Running Bank Balance</h2>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <defs>
            <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} interval={Math.max(0, Math.floor(data.length / 8) - 1)} axisLine={false} tickLine={false} />
          <YAxis domain={[min, "auto"]} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip />} />
          <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={2} fill="url(#balGrad)" dot={false} activeDot={{ r: 4, fill: "#6366f1" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
