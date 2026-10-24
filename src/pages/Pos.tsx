import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Check, Plus, ScanBarcode, ShoppingCart, Trash2, UserPlus, X } from "lucide-react";
import { useCategories, useCreateOrder, useCustomers, useOrder, useOrderItems, useProducts, useProfile, useSuppliers } from "../lib/api";
import { useCart } from "../lib/cart";
import { count, errorText, money, normalize } from "../lib/format";
import { navigate } from "../lib/router";
import { PAYMENT_METHODS, type Product } from "../lib/types";
import {
  Button,
  Empty,
  ErrorBox,
  IconButton,
  Input,
  Loading,
  Modal,
  Panel,
  SearchInput,
  Select,
  Stepper,
  cx,
} from "../components/ui";
import { ScannerModal } from "../components/Scanner";
import { Receipt, ReceiptActions } from "../components/Receipt";
import { CustomerForm } from "./Customers";
import { ProductForm } from "./Products";

export function PosPage() {
  const products = useProducts();
  const { data: cats = [] } = useCategories();
  const { data: sups = [] } = useSuppliers();
  const { cart, add, count: itemCount } = useCart();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<number | "all">("all");
  const [scan, setScan] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [unknownSku, setUnknownSku] = useState<string | null>(null);
  const [bumped, setBumped] = useState<number | null>(null);

  const byId = useMemo(() => new Map((products.data ?? []).map((p) => [p.id, p])), [products.data]);

  const list = useMemo(() => {
    const t = normalize(q);
    return (products.data ?? []).filter(
      (p) =>
        (cat === "all" || p.category_id === cat) &&
        (!t || normalize(p.name).includes(t) || (p.sku ?? "").toLowerCase().includes(t)),
    );
  }, [products.data, q, cat]);

  const usedCats = useMemo(() => cats.filter((c) => (products.data ?? []).some((p) => p.category_id === c.id)), [cats, products.data]);

  const addProduct = useCallback(
    (p: Product, silent = false) => {
      const inCart = cart[p.id] ?? 0;
      if (inCart + 1 > p.quantity) {
        toast.error(p.quantity === 0 ? `${p.name} אזל מהמלאי` : `יש רק ${p.quantity} יחידות של ${p.name}`);
        return;
      }
      add(p.id);
      setBumped(p.id);
      setTimeout(() => setBumped((b) => (b === p.id ? null : b)), 320);
      if (!silent) navigator.vibrate?.(15);
    },
    [cart, add],
  );

  const handleCode = useCallback(
    (code: string) => {
      const c = code.trim().toLowerCase();
      const p = (products.data ?? []).find((x) => (x.sku ?? "").toLowerCase() === c);
      if (p) {
        addProduct(p, true);
        toast.success(`נוסף: ${p.name}`, { duration: 1500 });
      } else {
        setUnknownSku(code.trim());
      }
    },
    [products.data, addProduct],
  );

  // USB/Bluetooth barcode scanners type the code and press Enter
  function onSearchKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter" || !q.trim()) return;
    e.preventDefault();
    const exact = (products.data ?? []).find((x) => x.sku && x.sku.toLowerCase() === q.trim().toLowerCase());
    if (exact) {
      addProduct(exact, true);
      setQ("");
    } else if (list.length === 1) {
      addProduct(list[0]);
      setQ("");
    }
  }

  const total = Object.entries(cart).reduce((a, [id, n]) => a + Number(byId.get(Number(id))?.sell_price ?? 0) * n, 0);

  if (products.isLoading) return <Loading />;
  if (products.error) return <ErrorBox error={errorText(products.error)} onRetry={() => products.refetch()} />;

  return (
    <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6">
      {/* Product picker */}
      <section aria-label="מוצרים" className={cx("min-w-0", itemCount > 0 && "pb-20 lg:pb-0")}>
        <h1 className="figure mb-4 text-[44px] lg:text-[52px]">קופה</h1>
        <div onKeyDown={onSearchKey}>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="חיפוש מוצר או הקלדת ברקוד"
            trailing={
              <IconButton label="סריקת ברקוד במצלמה" onClick={() => setScan(true)} className="text-brand">
                <ScanBarcode className="size-5" />
              </IconButton>
            }
          />
        </div>

        {usedCats.length > 0 && (
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0" role="tablist" aria-label="קטגוריות">
            {[{ id: "all" as const, name: "הכל" }, ...usedCats].map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={cat === c.id}
                onClick={() => setCat(c.id)}
                className={cx(
                  "h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
                  cat === c.id ? "border-ink bg-ink text-surface" : "border-line bg-surface text-muted hover:text-ink",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {!products.data?.length ? (
          <Panel className="mt-4">
            <Empty
              icon={<ShoppingCart />}
              title="אין עדיין מוצרים למכירה"
              text="הוסיפו מוצרים למלאי והם יופיעו כאן."
              action={<Button onClick={() => navigate("products", { query: "new=1" })}>הוספת מוצר</Button>}
            />
          </Panel>
        ) : !list.length ? (
          <Panel className="mt-4">
            <Empty title="לא נמצא מוצר" text={q ? `אין מוצר שמתאים ל״${q}״.` : "אין מוצרים בקטגוריה הזו."} />
          </Panel>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {list.map((p) => {
              const inCart = cart[p.id] ?? 0;
              const out = p.quantity === 0;
              const low = !out && p.quantity <= p.reorder_level;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={out}
                    onClick={() => addProduct(p)}
                    aria-label={`${p.name}, ${money(p.sell_price)}${inCart ? `, ${inCart} בעגלה` : ""}`}
                    className={cx(
                      "relative flex h-full min-h-[118px] w-full flex-col rounded-[12px] border bg-surface p-3 text-start transition-colors",
                      inCart ? "border-brand ring-1 ring-brand" : "border-line/80 hover:border-muted/50",
                      out && "opacity-55",
                    )}
                  >
                    <span className="line-clamp-2 text-[15px] font-medium leading-snug">{p.name}</span>
                    <span className="mt-auto flex items-end justify-between gap-2 pt-3">
                      <span className="price-tag figure num py-1 text-[22px]">{money(p.sell_price)}</span>
                      <span className={cx("text-xs", out || low ? "font-semibold text-warn" : "text-muted")}>
                        {out ? "אזל" : `${count(p.quantity)} במלאי`}
                      </span>
                    </span>
                    {inCart > 0 && (
                      <span
                        className={cx(
                          "num absolute -top-2 end-2 min-w-6 rounded-md bg-brand px-1.5 text-center text-sm font-bold leading-6 text-brand-ink",
                          bumped === p.id && "anim-bump",
                        )}
                      >
                        {inCart}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Desktop: receipt panel pinned beside the products */}
      <aside className="hidden lg:block" aria-label="עגלה">
        <div className="sticky top-8">
          <Checkout onDone={setDone} />
        </div>
      </aside>

      {/* Mobile: cart bar above the bottom navigation */}
      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 px-3 pb-2 lg:hidden">
          <button
            type="button"
            onClick={() => setSheet(true)}
            className="anim-pop flex h-14 w-full items-center gap-3 rounded-[14px] bg-ink px-4 text-surface shadow-panel"
          >
            <span className="num flex h-8 min-w-8 items-center justify-center rounded-lg bg-tag px-1.5 font-bold text-tag-ink">{itemCount}</span>
            <span className="flex-1 text-start font-semibold">לתשלום</span>
            <span className="figure num text-[28px]">{money(total)}</span>
          </button>
        </div>
      )}
      <Modal open={sheet} onClose={() => setSheet(false)} title="עגלה">
        <Checkout
          embedded
          onDone={(id) => {
            setSheet(false);
            setDone(id);
          }}
        />
      </Modal>

      <ScannerModal
        open={scan}
        onClose={() => setScan(false)}
        onResult={(code) => {
          setScan(false);
          handleCode(code);
        }}
      />

      {done != null && <SaleComplete orderId={done} onClose={() => setDone(null)} />}

      <Modal
        open={unknownSku != null}
        onClose={() => setUnknownSku(null)}
        title="ברקוד לא מוכר"
        footer={
          <div className="flex gap-2">
            <Button className="flex-1" icon={<Plus className="size-4" />} onClick={() => setUnknownSku((s) => (s ? `new:${s}` : s))}>
              הוספה כמוצר חדש
            </Button>
            <Button variant="secondary" onClick={() => setUnknownSku(null)}>
              סגירה
            </Button>
          </div>
        }
      >
        <p className="text-muted">
          אין מוצר עם הברקוד <span className="num font-semibold text-ink">{unknownSku?.replace(/^new:/, "")}</span>.
        </p>
      </Modal>
      <ProductForm
        open={!!unknownSku?.startsWith("new:")}
        product={null}
        presetSku={unknownSku?.replace(/^new:/, "")}
        categories={cats}
        suppliers={sups}
        onClose={() => setUnknownSku(null)}
        onSaved={(p) => {
          if (p.quantity > 0) add(p.id);
          setUnknownSku(null);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------- The receipt-in-progress

function Checkout({ onDone, embedded }: { onDone: (orderId: number) => void; embedded?: boolean }) {
  const { data: products = [] } = useProducts();
  const { data: customers = [] } = useCustomers();
  const { data: profile } = useProfile();
  const { cart, set, clear } = useCart();
  const create = useCreateOrder();

  const [customerId, setCustomerId] = useState<string>("");
  const [payment, setPayment] = useState<string>(PAYMENT_METHODS[0]);
  const [discount, setDiscount] = useState("");
  const [discountMode, setDiscountMode] = useState<"₪" | "%">("₪");
  const [received, setReceived] = useState("");
  const [newCustomer, setNewCustomer] = useState(false);

  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ p: products.find((x) => x.id === Number(id)), qty }))
    .filter((l): l is { p: Product; qty: number } => !!l.p);

  const subtotal = lines.reduce((a, l) => a + Number(l.p.sell_price ?? 0) * l.qty, 0);
  const d = Number(discount) || 0;
  const discountAmount = Math.min(subtotal, Math.max(0, discountMode === "%" ? Math.round(subtotal * Math.min(d, 100)) / 100 : d));
  const total = Math.round((subtotal - discountAmount) * 100) / 100;
  const change = payment === "מזומן" && received ? Number(received) - total : null;

  async function submit() {
    if (!lines.length) return;
    try {
      const id = await create.mutateAsync({
        items: lines.map((l) => ({ product_id: l.p.id, quantity: l.qty })),
        customerId: customerId ? Number(customerId) : null,
        payment,
        discount: discountAmount,
      });
      clear();
      setDiscount("");
      setReceived("");
      setCustomerId("");
      onDone(id);
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  return (
    <>
      <div className={cx(embedded ? "" : "receipt rounded-t-[14px] border border-b-0 border-line px-5 pt-5 shadow-panel")}>
        {!embedded && (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">{profile?.business_name || "מכירה חדשה"}</div>
              <div className="text-xs text-muted">{new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "numeric" })}</div>
            </div>
            {lines.length > 0 && (
              <IconButton label="ניקוי העגלה" onClick={clear}>
                <Trash2 className="size-[18px]" />
              </IconButton>
            )}
          </div>
        )}
        {!embedded && <hr className="receipt-rule my-3" />}

        {!lines.length ? (
          <div className="py-10 text-center text-sm text-muted">
            <ShoppingCart className="mx-auto mb-2 size-8 opacity-60" aria-hidden />
            בחרו מוצרים או סרקו ברקוד
          </div>
        ) : (
          <ul className="grid gap-3">
            {lines.map(({ p, qty }) => (
              <li key={p.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="num text-xs text-muted">{money(p.sell_price)} ליח׳</div>
                </div>
                <Stepper label={`כמות: ${p.name}`} value={qty} onChange={(v) => set(p.id, v)} min={0} max={p.quantity} />
                <span className="num w-16 text-end text-sm font-semibold">{money(Number(p.sell_price ?? 0) * qty)}</span>
              </li>
            ))}
          </ul>
        )}

        {lines.length > 0 && (
          <>
            <hr className="receipt-rule my-4" />
            <div className="grid gap-3">
              <div className="flex items-end gap-2">
                <Select label="לקוח" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="h-10">
                  <option value="">לקוח מזדמן</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </option>
                  ))}
                </Select>
                <IconButton label="לקוח חדש" className="h-10 border border-line" onClick={() => setNewCustomer(true)}>
                  <UserPlus className="size-[18px]" />
                </IconButton>
              </div>

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">אמצעי תשלום</legend>
                <div className="flex flex-wrap gap-1.5">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={payment === m}
                      onClick={() => setPayment(m)}
                      className={cx(
                        "h-9 rounded-[9px] border px-3 text-sm font-medium transition-colors",
                        payment === m ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:text-ink",
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="pos-discount" className="text-sm font-medium">
                    הנחה
                  </label>
                  <div className="flex">
                    <input
                      id="pos-discount"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      dir="ltr"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      className="h-10 w-full min-w-0 rounded-s-[10px] border border-line bg-surface px-3 outline-none focus:border-brand"
                    />
                    <button
                      type="button"
                      onClick={() => setDiscountMode((m) => (m === "₪" ? "%" : "₪"))}
                      aria-label={`יחידת הנחה: ${discountMode === "₪" ? "שקלים" : "אחוזים"}. לחצו להחלפה`}
                      className="h-10 w-11 shrink-0 rounded-e-[10px] border border-s-0 border-line bg-surface-2 font-semibold"
                    >
                      {discountMode}
                    </button>
                  </div>
                </div>
                {payment === "מזומן" && (
                  <Input
                    label="התקבל (₪)"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    dir="ltr"
                    value={received}
                    onChange={(e) => setReceived(e.target.value)}
                    className="h-10"
                  />
                )}
              </div>
            </div>

            <hr className="receipt-rule my-4" />
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-muted">
                <span>לפני הנחה</span>
                <span className="num">{money(subtotal)}</span>
              </div>
            )}
            <div className="flex items-end justify-between">
              <span className="font-bold">סה״כ לתשלום</span>
              <span className="figure num text-[44px]">{money(total)}</span>
            </div>
            {change != null && (
              <div className={cx("mt-1 flex justify-between text-sm", change < 0 ? "text-warn" : "text-ok")}>
                <span>{change < 0 ? "חסר" : "עודף"}</span>
                <span className="num font-semibold">{money(Math.abs(change))}</span>
              </div>
            )}
          </>
        )}
      </div>

      {lines.length > 0 && (
        <Button size="lg" className={cx("w-full", embedded ? "mt-5" : "mt-3")} icon={<Check className="size-5" />} loading={create.isPending} onClick={submit}>
          סיום מכירה · {money(total)}
        </Button>
      )}
      {embedded && lines.length > 0 && (
        <Button variant="ghost" className="mt-2 w-full text-muted" icon={<X className="size-4" />} onClick={clear}>
          ניקוי העגלה
        </Button>
      )}

      <CustomerForm open={newCustomer} customer={null} onClose={() => setNewCustomer(false)} onSaved={(c) => setCustomerId(String(c.id))} />
    </>
  );
}

// ---------------------------------------------------------------- After the sale

function SaleComplete({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const order = useOrder(orderId);
  const items = useOrderItems(orderId);
  const { data: profile } = useProfile();
  const { data: customers = [] } = useCustomers();
  const phone = customers.find((c) => c.id === order.data?.customer_id)?.phone;

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-ok-soft text-ok">
            <Check className="size-4" />
          </span>
          המכירה נשמרה
        </span>
      }
      footer={
        <div className="grid gap-2">
          {order.data && items.data && <ReceiptActions order={order.data} items={items.data} profile={profile} customerPhone={phone} />}
          <Button variant="ghost" onClick={onClose} data-autofocus>
            מכירה חדשה
          </Button>
        </div>
      }
    >
      {order.data && items.data ? <Receipt order={order.data} items={items.data} profile={profile} /> : <Loading />}
    </Modal>
  );
}
