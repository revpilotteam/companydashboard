import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { fmt } from "../utils/finance";

const PALETTE = ["#6366f1","#10b981","#f59e0b","#f43f5e","#3b82f6","#a855f7","#14b8a6","#fb923c","#84cc16","#ec4899"];

const Tip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value, percent } = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800">{name}</p>
      <p className="text-gray-600">{fmt(value)}</p>
      <p className="text-gray-400">{(percent * 100).toFixed(1)}%</p>
    </div>
  );
};

const Label = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.06) return null;
  const R = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.52;
  return (
    <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)}
      fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {(percent * 100).toFixed(0)}%
    </text>
  );
};

export default function DonutChart({ data, title, empty = "No data" }) {
  if (!data?.length) return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">{title}</h2>
      <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">{empty}</div>
    </div>
  );
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">{title}</h2>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={58} outerRadius={95}
            paddingAngle={3} dataKey="value" labelLine={false} label={<Label />}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip content={<Tip />} />
          <Legend formatter={(v) => <span style={{ fontSize: 12, color: "#374151" }}>{v}</span>} iconSize={9} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
