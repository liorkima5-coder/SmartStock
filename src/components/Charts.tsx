import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money, moneyShort, dateShort, count } from "../lib/format";

type Day = { day: string; sales: number; profit: number; orders: number };

function DayTooltip({ active, payload }: { active?: boolean; payload?: { payload: Day }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div dir="rtl" className="rounded-[10px] border border-line bg-surface px-3 py-2 text-sm shadow-panel">
      <div className="font-semibold">{new Date(d.day + "T12:00:00").toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "numeric" })}</div>
      <div className="mt-1 flex justify-between gap-6 text-muted">
        מכירות <span className="num font-semibold text-ink">{money(d.sales)}</span>
      </div>
      <div className="flex justify-between gap-6 text-muted">
        רווח <span className="num font-semibold text-ink">{money(d.profit)}</span>
      </div>
      <div className="flex justify-between gap-6 text-muted">
        הזמנות <span className="num font-semibold text-ink">{count(d.orders)}</span>
      </div>
    </div>
  );
}

/** Daily sales, one bar per day. Time runs left-to-right like a ledger. */
export function SalesBars({ data, height = 220 }: { data: Day[]; height?: number }) {
  return (
    <div dir="ltr" style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="0" strokeOpacity={0.6} />
          <XAxis
            dataKey="day"
            tickFormatter={(d: string) => dateShort(d + "T12:00:00")}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            width={52}
            tickFormatter={(v: number) => moneyShort(v)}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            orientation="right"
          />
          <Tooltip content={<DayTooltip />} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="sales" fill="var(--chart)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Ranked list with an inline proportional bar; reads better than a chart for named items. */
export function RankBars({
  rows,
  valueLabel = money,
}: {
  rows: { name: string; value: number; sub?: string }[];
  valueLabel?: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{r.name}</span>
            <span className="num shrink-0 font-semibold">{valueLabel(r.value)}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-surface-2">
              <div className="h-1.5 rounded-full bg-chart" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
            </div>
            {r.sub && <span className="shrink-0 text-xs text-muted">{r.sub}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
