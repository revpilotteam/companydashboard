import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { fmt } from "../utils/finance";

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm min-w-[160px]">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      {payload.map(p => p.value > 0 && (
        <p key={p.name} style={{ color: p.fill }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
};

const SERVICE_COLORS = {
  Build:               "#6366f1",
  Consulting:          "#f59e0b",
  "Continued Support": "#10b981",
  Other:               "#94a3b8",
};

export default function ServiceTypeChart({ data }) {
  const keys = ["Build", "Consulting", "Continued Support", "Other"];
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Sales Revenue by Service Type</h2>
      <p className="text-[11px] text-gray-300 mb-4">One-time (Build) · Consulting · Recurring (Continued Support)</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip />} cursor={{ fill: "#f9fafb" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {keys.map(k => (
            <Bar key={k} dataKey={k} stackId="a" fill={SERVICE_COLORS[k]}
              radius={k === "Other" ? [4,4,0,0] : k === "Build" ? [0,0,0,0] : [0,0,0,0]}
              maxBarSize={52} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
