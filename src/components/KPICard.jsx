const COLORS = {
  green:  { bg: "bg-emerald-50",  border: "border-emerald-200", val: "text-emerald-700", sub: "text-emerald-500" },
  red:    { bg: "bg-red-50",      border: "border-red-200",     val: "text-red-700",     sub: "text-red-400" },
  blue:   { bg: "bg-blue-50",     border: "border-blue-200",    val: "text-blue-700",    sub: "text-blue-500" },
  purple: { bg: "bg-purple-50",   border: "border-purple-200",  val: "text-purple-700",  sub: "text-purple-500" },
  amber:  { bg: "bg-amber-50",    border: "border-amber-200",   val: "text-amber-700",   sub: "text-amber-500" },
  slate:  { bg: "bg-slate-50",    border: "border-slate-200",   val: "text-slate-700",   sub: "text-slate-500" },
};

export default function KPICard({ title, value, subtitle, color = "blue", icon, trend }) {
  const c = COLORS[color] || COLORS.blue;
  const isPos = trend > 0, isNeg = trend < 0;
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 flex flex-col gap-1.5`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 leading-none">{title}</span>
        <span className="text-lg leading-none">{icon}</span>
      </div>
      <div className={`text-2xl font-bold leading-tight ${c.val}`}>{value}</div>
      <div className="flex items-center justify-between">
        {subtitle && <span className={`text-xs ${c.sub}`}>{subtitle}</span>}
        {trend !== undefined && (
          <span className={`text-xs font-semibold ${isPos ? "text-emerald-600" : isNeg ? "text-red-500" : "text-gray-400"}`}>
            {isPos ? "▲" : isNeg ? "▼" : "—"} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
