import { lazy, Suspense, useState } from "react";
import { BarChart3, Info } from "lucide-react";
import { useReports } from "../lib/api";
import { count, errorText, money } from "../lib/format";
import { Badge, Empty, ErrorBox, Loading, PageHeader, Panel, Segmented, cx } from "../components/ui";

const RankBars = lazy(() => import("../components/Charts").then((m) => ({ default: m.RankBars })));

const PERIODS = [
  { value: 30, label: "30 יום" },
  { value: 90, label: "3 חודשים" },
  { value: 365, label: "שנה" },
  { value: 3650, label: "הכל" },
];

export function ReportsPage() {
  const [days, setDays] = useState(90);
  const { data, isLoading, isFetching, error, refetch } = useReports(days);

  return (
    <>
      <PageHeader
        title="דוחות"
        sub="מבוסס על הזמנות שהושלמו בתקופה"
        actions={<Segmented label="תקופה" value={days} onChange={setDays} options={PERIODS} className="w-full sm:w-auto" />}
      />

      {isLoading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorBox error={errorText(error)} onRetry={() => refetch()} />
      ) : data.abc.length === 0 ? (
        <Panel>
          <Empty icon={<BarChart3 />} title="אין מכירות בתקופה הזו" text="בחרו תקופה ארוכה יותר, או חזרו אחרי כמה מכירות." />
        </Panel>
      ) : (
        <div className={cx("grid gap-4 transition-opacity", isFetching && "opacity-70")}>
          <Panel className="grid grid-cols-2 gap-6 p-5 sm:grid-cols-4 sm:p-6">
            <Stat label="הכנסות" value={money(data.total_revenue)} />
            <Stat label="רווח גולמי" value={money(data.total_profit)} />
            <Stat label="שיעור רווח" value={data.total_revenue ? `${Math.round((data.total_profit / data.total_revenue) * 100)}%` : "—"} />
            <Stat label="מוצרים שנמכרו" value={count(data.abc.length)} />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Forecast data={data.forecast} days={data.days} />
            <Panel className="p-5 sm:p-6">
              <h2 className="mb-4 font-bold">הכנסות לפי קטגוריה</h2>
              <Suspense fallback={null}>
                <RankBars rows={data.categories.map((c) => ({ name: c.name, value: Number(c.revenue) }))} />
              </Suspense>
            </Panel>
          </div>

          <Abc rows={data.abc} />

          {data.dead_stock.length > 0 && (
            <Panel className="p-5 sm:p-6">
              <h2 className="font-bold">מלאי שלא זז</h2>
              <p className="mt-1 text-sm text-muted">
                מוצרים שיש במלאי ולא נמכרו בכלל בתקופה. כסף שתקוע על המדף:{" "}
                <span className="num font-semibold text-ink">{money(data.dead_stock.reduce((a, d) => a + Number(d.value), 0))}</span> בעלות.
              </p>
              <ul className="mt-3 grid gap-x-8 sm:grid-cols-2">
                {data.dead_stock.slice(0, 12).map((d) => (
                  <li key={d.product_id} className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm">
                    <span className="truncate">{d.name}</span>
                    <span className="shrink-0 text-muted">
                      <span className="num">{count(d.stock)}</span> יח׳ · <span className="num">{money(d.value)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {data.dead_stock.length > 12 && <p className="mt-2 text-xs text-muted">ועוד {count(data.dead_stock.length - 12)} מוצרים</p>}
            </Panel>
          )}
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-sm text-muted">{label}</div>
      <div className="figure num mt-1.5 truncate text-[40px]">{value}</div>
    </div>
  );
}

function Forecast({ data, days }: { data: { product_id: number; name: string; stock: number; daily_rate: number; days_left: number }[]; days: number }) {
  const soon = data.filter((f) => f.days_left <= 30);
  return (
    <Panel className="p-5 sm:p-6">
      <h2 className="font-bold">צפי גמר מלאי</h2>
      <p className="mt-1 text-sm text-muted">
        {days <= 1 ? "לפי קצב המכירה ביום האחרון." : <>לפי קצב המכירה הממוצע ב־{count(Math.round(days))} הימים האחרונים.</>}
      </p>
      {soon.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">אף מוצר לא צפוי להיגמר בחודש הקרוב.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {soon.slice(0, 10).map((f) => {
            const urgent = f.days_left <= 7;
            return (
              <li key={f.product_id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{f.name}</div>
                  <div className="text-xs text-muted">
                    <span className="num">{count(f.stock)}</span> במלאי · נמכרות כ־<span className="num">{f.daily_rate}</span> ביום
                  </div>
                </div>
                <Badge tone={f.stock === 0 ? "warn" : urgent ? "warn" : "tag"}>
                  {f.stock === 0 ? "אזל" : f.days_left < 1 ? "היום" : <span>עוד <span className="num">{count(f.days_left)}</span> ימים</span>}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function Abc({ rows }: { rows: { product_id: number | null; name: string; qty: number; revenue: number; profit: number; share: number; grade: "A" | "B" | "C" }[] }) {
  const [showAll, setShowAll] = useState(false);
  const counts = { A: 0, B: 0, C: 0 };
  rows.forEach((r) => counts[r.grade]++);
  const shown = showAll ? rows : rows.slice(0, 15);
  const tone = { A: "ok", B: "tag", C: "neutral" } as const;

  return (
    <Panel className="overflow-hidden">
      <div className="p-5 sm:p-6">
        <h2 className="font-bold">ניתוח ABC</h2>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <b className="text-ink">A</b> הם המוצרים שמביאים 80% מההכנסות ({count(counts.A)} מוצרים) — אסור שייגמרו. <b className="text-ink">B</b> מביאים עוד 15% (
            {count(counts.B)}). <b className="text-ink">C</b> הם השאר ({count(counts.C)}) — מועמדים לצמצום.
          </span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="border-y border-line bg-surface-2 text-muted">
            <tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:font-medium">
              <th className="text-start">מוצר</th>
              <th className="text-end">יחידות</th>
              <th className="text-end">הכנסות</th>
              <th className="text-end">רווח</th>
              <th className="text-end">מצטבר</th>
              <th className="w-14 text-center">דירוג</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r) => (
              <tr key={r.product_id ?? r.name}>
                <td className="max-w-[220px] truncate px-4 py-2">{r.name}</td>
                <td className="num px-4 py-2 text-end">{count(r.qty)}</td>
                <td className="num px-4 py-2 text-end font-semibold">{money(r.revenue)}</td>
                <td className="num px-4 py-2 text-end text-muted">{money(r.profit)}</td>
                <td className="num px-4 py-2 text-end text-muted">{r.share}%</td>
                <td className="px-4 py-2 text-center">
                  <Badge tone={tone[r.grade]}>{r.grade}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 15 && (
        <button type="button" onClick={() => setShowAll((s) => !s)} className="w-full border-t border-line py-3 text-sm font-medium text-brand hover:bg-surface-2">
          {showAll ? "הצגת פחות" : `הצגת כל ${count(rows.length)} המוצרים`}
        </button>
      )}
    </Panel>
  );
}
