import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, ReceiptText, Undo2 } from "lucide-react";
import { ORDERS_PAGE, useCancelOrder, useCustomers, useOrder, useOrderItems, useOrders, useProfile, type OrderFilter } from "../lib/api";
import { count, dateTime, downloadCsv, errorText, money } from "../lib/format";
import { supabase } from "../lib/supabase";
import { PAYMENT_METHODS, type Order } from "../lib/types";
import {
  Badge,
  Button,
  Confirm,
  Empty,
  ErrorBox,
  IconButton,
  Input,
  Loading,
  Modal,
  PageHeader,
  Panel,
  SearchInput,
  Segmented,
  Select,
  cx,
} from "../components/ui";
import { Receipt, ReceiptActions } from "../components/Receipt";

type Range = "today" | "7" | "30" | "all" | "custom";

const iso = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

function rangeDates(r: Range): { from?: string; to?: string } {
  const now = new Date();
  if (r === "today") return { from: iso(now) };
  if (r === "7") return { from: iso(new Date(now.getTime() - 6 * 86400000)) };
  if (r === "30") return { from: iso(new Date(now.getTime() - 29 * 86400000)) };
  return {};
}

export function OrdersPage() {
  const [range, setRange] = useState<Range>("all");
  const [custom, setCustom] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [status, setStatus] = useState<OrderFilter["status"]>("all");
  const [payment, setPayment] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const dates = range === "custom" ? { from: custom.from || undefined, to: custom.to || undefined } : rangeDates(range);
  const filter: OrderFilter = { ...dates, status, payment: payment || undefined, q: q.trim() || undefined, page };
  const { data, isLoading, isFetching, error, refetch } = useOrders(filter);
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / ORDERS_PAGE));

  const reset = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(0);
  };

  async function exportCsv() {
    setExporting(true);
    try {
      let query = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(10000);
      if (filter.from) query = query.gte("created_at", new Date(filter.from + "T00:00:00").toISOString());
      if (filter.to) query = query.lt("created_at", new Date(new Date(filter.to + "T00:00:00").getTime() + 86400000).toISOString());
      if (filter.status && filter.status !== "all") query = query.eq("status", filter.status);
      if (filter.payment) query = query.eq("payment_method", filter.payment);
      const { data: rows, error: e } = await query;
      if (e) throw e;
      downloadCsv(`smartstock-orders-${iso(new Date())}.csv`, [
        ["מספר", "תאריך", "לקוח", "אמצעי תשלום", "הנחה", "סכום", "סטטוס"],
        ...(rows as Order[]).map((o) => [
          o.id,
          dateTime(o.created_at),
          o.customer_name ?? "",
          o.payment_method,
          o.discount,
          o.total_amount,
          o.status === "cancelled" ? "בוטלה" : "הושלמה",
        ]),
      ]);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="הזמנות"
        sub={data ? `${count(data.total)} הזמנות` : undefined}
        actions={
          <Button variant="ghost" icon={<Download className="size-4" />} loading={exporting} onClick={exportCsv}>
            ייצוא לאקסל
          </Button>
        }
      />

      <div className="mb-4 grid gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={reset(setQ)} placeholder="מספר הזמנה או שם לקוח" className="lg:max-w-xs lg:flex-1" />
          <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            <Segmented
              label="תקופה"
              value={range}
              onChange={reset(setRange)}
              options={[
                { value: "today", label: "היום" },
                { value: "7", label: "7 ימים" },
                { value: "30", label: "30 יום" },
                { value: "all", label: "הכל" },
                { value: "custom", label: "טווח" },
              ]}
            />
          </div>
          <div className="flex gap-2">
            <Select aria-label="סטטוס" value={status} onChange={(e) => reset(setStatus)(e.target.value as OrderFilter["status"])} className="h-10 w-auto">
              <option value="all">כל הסטטוסים</option>
              <option value="completed">הושלמו</option>
              <option value="cancelled">בוטלו</option>
            </Select>
            <Select aria-label="אמצעי תשלום" value={payment} onChange={(e) => reset(setPayment)(e.target.value)} className="h-10 w-auto">
              <option value="">כל אמצעי התשלום</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </div>
        </div>
        {range === "custom" && (
          <div className="flex gap-3">
            <Input label="מתאריך" type="date" value={custom.from} onChange={(e) => reset(setCustom)({ ...custom, from: e.target.value })} className="h-10" />
            <Input label="עד תאריך" type="date" value={custom.to} onChange={(e) => reset(setCustom)({ ...custom, to: e.target.value })} className="h-10" />
          </div>
        )}
      </div>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={errorText(error)} onRetry={() => refetch()} />
      ) : !data?.rows.length ? (
        <Panel>
          <Empty icon={<ReceiptText />} title="אין הזמנות להצגה" text="נסו תקופה אחרת או נקו את הסינון." />
        </Panel>
      ) : (
        <>
          <Panel className={cx("divide-y divide-line overflow-hidden transition-opacity", isFetching && "opacity-70")}>
            {data.rows.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOpen(o.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-surface-2/60"
              >
                <span className="num w-14 shrink-0 font-semibold">#{o.id}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.customer_name || <span className="text-muted">לקוח מזדמן</span>}</span>
                  <span className="block text-xs text-muted">
                    {dateTime(o.created_at)} · {o.payment_method}
                  </span>
                </span>
                {o.status === "cancelled" && <Badge tone="warn">בוטלה</Badge>}
                <span className={cx("num shrink-0 font-semibold", o.status === "cancelled" && "text-muted line-through")}>{money(o.total_amount)}</span>
              </button>
            ))}
          </Panel>
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <IconButton label="הדף הקודם" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">
                <ChevronRight className="size-5" />
              </IconButton>
              <span className="text-sm text-muted">
                עמוד <span className="num">{page + 1}</span> מתוך <span className="num">{pages}</span>
              </span>
              <IconButton label="הדף הבא" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40">
                <ChevronLeft className="size-5" />
              </IconButton>
            </div>
          )}
        </>
      )}

      {open != null && <OrderModal orderId={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export function OrderModal({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const order = useOrder(orderId);
  const items = useOrderItems(orderId);
  const { data: profile } = useProfile();
  const { data: customers = [] } = useCustomers();
  const cancel = useCancelOrder();
  const [confirm, setConfirm] = useState(false);
  const phone = customers.find((c) => c.id === order.data?.customer_id)?.phone;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={`הזמנה #${orderId}`}
        footer={
          order.data &&
          items.data && (
            <div className="grid gap-2">
              <ReceiptActions order={order.data} items={items.data} profile={profile} customerPhone={phone} />
              {order.data.status === "completed" && (
                <Button variant="ghost" className="text-warn" icon={<Undo2 className="size-4" />} onClick={() => setConfirm(true)}>
                  ביטול ההזמנה והחזרה למלאי
                </Button>
              )}
            </div>
          )
        }
      >
        {order.error || items.error ? (
          <ErrorBox error={errorText(order.error ?? items.error)} />
        ) : order.data && items.data ? (
          <Receipt order={order.data} items={items.data} profile={profile} />
        ) : (
          <Loading />
        )}
      </Modal>
      <Confirm
        open={confirm}
        title="לבטל את ההזמנה?"
        text="המוצרים יחזרו למלאי וההזמנה תסומן כמבוטלת. היא לא תיכלל בדוחות."
        confirmLabel="ביטול ההזמנה"
        danger
        loading={cancel.isPending}
        onConfirm={async () => {
          try {
            await cancel.mutateAsync(orderId);
            toast.success(`הזמנה #${orderId} בוטלה והמלאי עודכן`);
            setConfirm(false);
          } catch (e) {
            toast.error(errorText(e));
          }
        }}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}
