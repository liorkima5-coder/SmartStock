import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { MessageCircle, Pencil, Phone, Plus, Trash2, Users } from "lucide-react";
import { useCustomerOrders, useCustomers, useDeleteRow, useSaveRow } from "../lib/api";
import { count, dateTime, downloadCsv, errorText, money, normalize, waPhone } from "../lib/format";
import type { Customer, Order } from "../lib/types";
import {
  Badge,
  Button,
  Confirm,
  Empty,
  ErrorBox,
  Input,
  Loading,
  Modal,
  PageHeader,
  Panel,
  SearchInput,
  Textarea,
} from "../components/ui";
import { OrderModal } from "./Orders";

export function CustomersPage() {
  const { data, isLoading, error, refetch } = useCustomers();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [open, setOpen] = useState<Customer | null>(null);

  const rows = useMemo(() => {
    const t = normalize(q);
    const digits = q.replace(/\D/g, "");
    return (data ?? []).filter(
      (c) =>
        !t ||
        normalize(c.name).includes(t) ||
        (c.business_name && normalize(c.business_name).includes(t)) ||
        (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits)),
    );
  }, [data, q]);

  return (
    <>
      <PageHeader
        title="לקוחות"
        sub={data ? `${count(data.length)} לקוחות` : undefined}
        actions={
          <>
            <Button
              variant="ghost"
              disabled={!rows.length}
              onClick={() =>
                downloadCsv("smartstock-customers.csv", [
                  ["שם", "טלפון", "אימייל", "עסק", "כתובת", "הערות"],
                  ...rows.map((c) => [c.name, c.phone, c.email, c.business_name, c.address, c.notes]),
                ])
              }
            >
              ייצוא
            </Button>
            <Button icon={<Plus className="size-[18px]" />} onClick={() => setEditing("new")}>
              לקוח חדש
            </Button>
          </>
        }
      />
      <SearchInput value={q} onChange={setQ} placeholder="חיפוש לפי שם, עסק או טלפון" className="mb-4 lg:max-w-sm" />

      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={errorText(error)} onRetry={() => refetch()} />
      ) : !data?.length ? (
        <Panel>
          <Empty
            icon={<Users />}
            title="עוד אין לקוחות"
            text="שמירת לקוחות מאפשרת לשלוח להם קבלה בוואטסאפ ולראות מה קנו."
            action={<Button onClick={() => setEditing("new")}>הוספת לקוח</Button>}
          />
        </Panel>
      ) : !rows.length ? (
        <Panel>
          <Empty title="לא נמצאו לקוחות" text="נסו חיפוש אחר." />
        </Panel>
      ) : (
        <Panel className="divide-y divide-line">
          {rows.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <button type="button" className="min-w-0 flex-1 text-start" onClick={() => setOpen(c)}>
                <div className="truncate font-medium">{c.name}</div>
                <div className="truncate text-xs text-muted">
                  {[c.business_name, c.phone].filter(Boolean).join(" · ") || "—"}
                </div>
              </button>
              {c.phone && (
                <>
                  <a href={`tel:${c.phone}`} aria-label={`התקשרות ל${c.name}`} className="inline-flex size-10 items-center justify-center rounded-[10px] text-muted hover:bg-surface-2 hover:text-ink">
                    <Phone className="size-[18px]" />
                  </a>
                  {waPhone(c.phone) && (
                    <a
                      href={`https://wa.me/${waPhone(c.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`וואטסאפ ל${c.name}`}
                      className="inline-flex size-10 items-center justify-center rounded-[10px] text-muted hover:bg-surface-2 hover:text-ink"
                    >
                      <MessageCircle className="size-[18px]" />
                    </a>
                  )}
                </>
              )}
            </div>
          ))}
        </Panel>
      )}

      <CustomerForm open={editing !== null} customer={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      <CustomerDetails
        customer={open ? (data?.find((c) => c.id === open.id) ?? open) : null}
        onClose={() => setOpen(null)}
        onEdit={(c) => {
          setOpen(null);
          setEditing(c);
        }}
      />
    </>
  );
}

export function CustomerForm({
  open,
  customer,
  onClose,
  onSaved,
}: {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSaved?: (c: Customer) => void;
}) {
  const save = useSaveRow<Customer>("customers");
  const del = useDeleteRow("customers");
  const empty = { name: "", phone: "", email: "", business_name: "", address: "", notes: "" };
  const [f, setF] = useState(empty);
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (open) {
      setF(
        customer
          ? {
              name: customer.name,
              phone: customer.phone ?? "",
              email: customer.email ?? "",
              business_name: customer.business_name ?? "",
              address: customer.address ?? "",
              notes: customer.notes ?? "",
            }
          : empty,
      );
      setErr("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return setErr("צריך שם ללקוח");
    try {
      const c = await save.mutateAsync({
        id: customer?.id,
        data: {
          name: f.name.trim(),
          phone: f.phone.trim() || null,
          email: f.email.trim() || null,
          business_name: f.business_name.trim() || null,
          address: f.address.trim() || null,
          notes: f.notes.trim() || null,
        },
      });
      toast.success(customer ? "הלקוח עודכן" : "הלקוח נוסף");
      onSaved?.(c);
      onClose();
    } catch (e2) {
      toast.error(errorText(e2));
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={customer ? "עריכת לקוח" : "לקוח חדש"}
        footer={
          <div className="flex gap-2">
            <Button type="submit" form="customer-form" className="flex-1" loading={save.isPending}>
              {customer ? "שמירת שינויים" : "הוספת הלקוח"}
            </Button>
            {customer && (
              <Button variant="ghost" className="text-warn" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDel(true)}>
                מחיקה
              </Button>
            )}
          </div>
        }
      >
        <form id="customer-form" onSubmit={submit} className="grid gap-3" noValidate>
          <Input label="שם מלא" value={f.name} onChange={set("name")} error={err} autoComplete="off" />
          <Input label="טלפון" type="tel" dir="ltr" value={f.phone} onChange={set("phone")} hint="לשליחת קבלות בוואטסאפ" />
          <Input label="אימייל" type="email" dir="ltr" value={f.email} onChange={set("email")} />
          <Input label="שם העסק" value={f.business_name} onChange={set("business_name")} />
          <Input label="כתובת" value={f.address} onChange={set("address")} />
          <Textarea label="הערות" rows={2} value={f.notes} onChange={set("notes")} />
        </form>
      </Modal>
      <Confirm
        open={confirmDel}
        title={`למחוק את ${customer?.name}?`}
        text="ההזמנות של הלקוח יישארו בהיסטוריה."
        confirmLabel="מחיקת הלקוח"
        danger
        loading={del.isPending}
        onConfirm={async () => {
          try {
            await del.mutateAsync(customer!.id);
            toast.success("הלקוח נמחק");
            setConfirmDel(false);
            onClose();
          } catch (e) {
            toast.error(errorText(e));
          }
        }}
        onClose={() => setConfirmDel(false)}
      />
    </>
  );
}

function CustomerDetails({ customer, onClose, onEdit }: { customer: Customer | null; onClose: () => void; onEdit: (c: Customer) => void }) {
  const orders = useCustomerOrders(customer?.id ?? null);
  const [order, setOrder] = useState<Order | null>(null);
  if (!customer) return null;
  const done = (orders.data ?? []).filter((o) => o.status === "completed");
  const total = done.reduce((a, o) => a + Number(o.total_amount), 0);

  return (
    <>
      <Modal
        open={!order}
        onClose={onClose}
        title={customer.name}
        footer={
          <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => onEdit(customer)}>
            עריכת פרטים
          </Button>
        }
      >
        <dl className="grid grid-cols-2 gap-3 rounded-[12px] bg-surface-2 p-4 text-sm">
          <div>
            <dt className="text-muted">סה״כ קניות</dt>
            <dd className="figure num mt-1 text-[30px]">{money(total)}</dd>
          </div>
          <div>
            <dt className="text-muted">הזמנות</dt>
            <dd className="figure num mt-1 text-[30px]">{count(done.length)}</dd>
          </div>
          {customer.phone && (
            <div>
              <dt className="text-muted">טלפון</dt>
              <dd className="num mt-1">
                <a href={`tel:${customer.phone}`} className="underline-offset-4 hover:underline">
                  {customer.phone}
                </a>
              </dd>
            </div>
          )}
          {customer.email && (
            <div className="min-w-0">
              <dt className="text-muted">אימייל</dt>
              <dd className="mt-1 truncate" dir="ltr">
                {customer.email}
              </dd>
            </div>
          )}
          {customer.business_name && (
            <div>
              <dt className="text-muted">עסק</dt>
              <dd className="mt-1">{customer.business_name}</dd>
            </div>
          )}
          {customer.address && (
            <div>
              <dt className="text-muted">כתובת</dt>
              <dd className="mt-1">{customer.address}</dd>
            </div>
          )}
        </dl>
        {customer.notes && <p className="mt-3 text-sm text-muted">{customer.notes}</p>}

        <h3 className="mb-2 mt-5 font-bold">היסטוריית קניות</h3>
        {orders.isLoading ? (
          <Loading />
        ) : !orders.data?.length ? (
          <p className="text-sm text-muted">עדיין אין הזמנות ללקוח הזה.</p>
        ) : (
          <ul className="divide-y divide-line">
            {orders.data.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => setOrder(o)} className="flex w-full items-center gap-3 py-2.5 text-start text-sm hover:bg-surface-2/60">
                  <span className="num font-semibold">#{o.id}</span>
                  <span className="flex-1 text-muted">{dateTime(o.created_at)}</span>
                  {o.status === "cancelled" && <Badge tone="warn">בוטלה</Badge>}
                  <span className="num font-semibold">{money(o.total_amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
      {order && <OrderModal orderId={order.id} onClose={() => setOrder(null)} />}
    </>
  );
}

