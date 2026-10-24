import { lazy, Suspense, useState } from "react";
import { AlertTriangle, PackagePlus, ShoppingCart } from "lucide-react";
import { useDashboard, useProducts } from "../lib/api";
import { count, errorText, money } from "../lib/format";
import { navigate } from "../lib/router";
import { Badge, Button, ErrorBox, Loading, PageHeader, Panel } from "../components/ui";
import { RestockModal } from "./Products";
import type { Product } from "../lib/types";

const SalesBars = lazy(() => import("../components/Charts").then((m) => ({ default: m.SalesBars })));
const RankBars = lazy(() => import("../components/Charts").then((m) => ({ default: m.RankBars })));

export function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboard();
  const products = useProducts();
  const [restock, setRestock] = useState<Product | null>(null);

  const today = new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={errorText(error)} onRetry={() => refetch()} />;

  const isNew = data.product_count === 0;
  const monthSalesSoFar = data.daily.reduce((a, d) => a + Number(d.sales), 0);

  return (
    <>
      <PageHeader
        title="סקירה"
        sub={today}
        actions={
          <Button icon={<ShoppingCart className="size-[18px]" />} onClick={() => navigate("pos")}>
            מכירה חדשה
          </Button>
        }
      />

      {isNew ? (
        <GettingStarted />
      ) : (
        <>
          {/* Today is the headline; the rest supports it */}
          <Panel className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.2fr_2fr] lg:items-center">
            <div>
              <div className="text-sm font-medium text-muted">נמכר היום</div>
              <div className="figure num mt-2 text-[72px] text-ink sm:text-[88px]">{money(data.today_sales)}</div>
              <div className="mt-2 text-sm text-muted">
                {data.today_orders === 0 ? "עוד לא נרשמו מכירות היום" : `${count(data.today_orders)} הזמנות`}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-5 sm:grid-cols-4 lg:grid-cols-2 lg:border-s lg:border-t-0 lg:ps-8 lg:pt-0 xl:grid-cols-4">
              <Figure label="מכירות החודש" value={money(data.month_sales)} sub={`${count(data.month_orders)} הזמנות`} />
              <Figure label="רווח החודש" value={money(data.month_profit)} sub="אחרי עלות והנחות" tone={data.month_profit < 0 ? "warn" : undefined} />
              <Figure label="שווי מלאי" value={money(data.inventory_cost)} sub={`במחיר מכירה ${money(data.inventory_retail)}`} />
              <Figure
                label="מלאי נמוך"
                value={count(data.low_stock_count)}
                sub={data.out_of_stock_count ? `${count(data.out_of_stock_count)} אזלו` : "מוצרים"}
                tone={data.low_stock_count ? "warn" : undefined}
              />
            </dl>
          </Panel>

          <Panel className="mt-4 p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-bold">מכירות ב־30 הימים האחרונים</h2>
              <span className="num text-sm text-muted">{money(monthSalesSoFar)} סה״כ</span>
            </div>
            {monthSalesSoFar === 0 ? (
              <p className="py-10 text-center text-sm text-muted">אין מכירות ב־30 הימים האחרונים. הדוחות מציגים גם תקופות ארוכות יותר.</p>
            ) : (
              <Suspense fallback={<div className="h-[220px]" />}>
                <SalesBars data={data.daily} />
              </Suspense>
            )}
          </Panel>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel className="p-5 sm:p-6">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-bold">עומד להיגמר</h2>
                {data.low_stock_count > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => navigate("products", { query: "filter=low" })}>
                    כל המוצרים ({count(data.low_stock_count)})
                  </Button>
                )}
              </div>
              {data.low_stock.length === 0 ? (
                <p className="py-6 text-sm text-muted">כל המוצרים מעל רף ההזמנה.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.low_stock.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{p.name}</div>
                        <div className="text-xs text-muted">רף הזמנה: {count(p.reorder_level)}</div>
                      </div>
                      <Badge tone={p.quantity === 0 ? "warn" : "tag"}>
                        {p.quantity === 0 ? (
                          <>
                            <AlertTriangle className="size-3.5" aria-hidden /> אזל
                          </>
                        ) : (
                          <span className="num">נשארו {count(p.quantity)}</span>
                        )}
                      </Badge>
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`קליטת סחורה: ${p.name}`}
                        onClick={() => setRestock(products.data?.find((x) => x.id === p.id) ?? null)}
                        disabled={!products.data}
                      >
                        <PackagePlus className="size-4" aria-hidden />
                        <span className="hidden sm:inline">קליטה</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel className="p-5 sm:p-6">
              <h2 className="mb-4 font-bold">הנמכרים ביותר (30 יום)</h2>
              {data.top_products.length === 0 ? (
                <p className="py-6 text-sm text-muted">יופיע כאן אחרי המכירות הראשונות.</p>
              ) : (
                <Suspense fallback={null}>
                  <RankBars rows={data.top_products.map((t) => ({ name: t.name, value: Number(t.revenue), sub: `${count(t.qty)} יח׳` }))} />
                </Suspense>
              )}
            </Panel>
          </div>
        </>
      )}

      <RestockModal product={restock} onClose={() => setRestock(null)} />
    </>
  );
}

function Figure({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`figure num mt-1.5 truncate text-[38px] ${tone === "warn" ? "text-warn" : "text-ink"}`}>{value}</dd>
      {sub && <dd className="mt-1 truncate text-xs text-muted">{sub}</dd>}
    </div>
  );
}

function GettingStarted() {
  const steps = [
    { t: "הוסיפו מוצרים", d: "שם, מחיר, עלות וכמות במלאי. אפשר לסרוק ברקוד.", go: () => navigate("products", { query: "new=1" }), cta: "הוספת מוצר" },
    { t: "בצעו מכירה", d: "בוחרים מוצרים בקופה, אמצעי תשלום, ושולחים קבלה בוואטסאפ.", go: () => navigate("pos"), cta: "לקופה" },
    { t: "השלימו את פרטי העסק", d: "שם, ח״פ, טלפון ולוגו יופיעו על הקבלות.", go: () => navigate("settings"), cta: "להגדרות" },
  ];
  return (
    <Panel className="p-6 sm:p-8">
      <h2 className="text-xl font-bold">ברוכים הבאים. שלושה צעדים ואתם מוכרים.</h2>
      <ol className="mt-6 grid gap-5 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.t} className="flex flex-col rounded-[12px] border border-line p-4">
            <span className="figure text-[40px] text-brand">{i + 1}</span>
            <span className="mt-2 font-semibold">{s.t}</span>
            <span className="mt-1 flex-1 text-sm text-muted">{s.d}</span>
            <Button variant="secondary" size="sm" className="mt-4 self-start" onClick={s.go}>
              {s.cta}
            </Button>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
