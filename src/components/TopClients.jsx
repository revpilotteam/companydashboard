import { fmt } from "../utils/finance";

const PALETTE = ["#6366f1","#10b981","#f59e0b","#f43f5e","#3b82f6","#a855f7","#14b8a6","#fb923c"];

export default function TopClients({ data, title = "Top Clients by Revenue" }) {
  if (!data?.length) return null;
  const max = data[0].value;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">{title}</h2>
      <div className="space-y-3">
        {data.map(({ name, value }, i) => (
          <div key={name}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700 font-medium truncate max-w-[200px]">{name}</span>
              <span className="text-gray-900 font-semibold ml-2 whitespace-nowrap">{fmt(value)}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(value / max) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
