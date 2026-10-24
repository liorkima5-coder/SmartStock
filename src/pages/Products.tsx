import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Boxes,
  Download,
  History,
  PackagePlus,
  Pencil,
  Plus,
  ScanBarcode,
  Tags,
  Trash2,
  Truck,
} from "lucide-react";
import {
  useAdjustStock,
  useCategories,
  useDeleteProduct,
  useDeleteRow,
  useInventoryLogs,
  useProducts,
  useSaveProduct,
  useSaveRow,
  useSuppliers,
} from "../lib/api";
import { count, dateTime, downloadCsv, errorText, money, normalize } from "../lib/format";
import { queryParam } from "../lib/router";
import type { Category, Product, Supplier } from "../lib/types";
import {
  Badge,
  Field,
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
  Textarea,
  cx,
} from "../components/ui";
import { ScannerModal } from "../components/Scanner";

type StockFilter = "all" | "low" | "out";

export function ProductsPage() {
  const products = useProducts();
  const { data: cats = [] } = useCategories();
  const { data: sups = [] } = useSuppliers();

  const [q, setQ] = useState("");
  const [stock, setStock] = useState<StockFilter>(() => (queryParam("filter") === "low" ? "low" : "all"));
  const [cat, setCat] = useState<string>("");
  const [editing, setEditing] = useState<Product | "new" | null>(() => (queryParam("new") ? "new" : null));
  const [restock, setRestock] = useState<Product | null>(null);
  const [details, setDetails] = useState<Product | null>(null);
  const [lists, setLists] = useState(false);

  const catName = useMemo(() => new Map(cats.map((c) => [c.id, c.name])), [cats]);

  const rows = useMemo(() => {
    const term = normalize(q);
    return (products.data ?? []).filter((p) => {
      if (stock === "low" && p.quantity > p.reorder_level) return false;
      if (stock === "out" && p.quantity !== 0) return false;
      if (cat === "none" && p.category_id) return false;
      if (cat && cat !== "none" && String(p.category_id) !== cat) return false;
      if (!term) return true;
      return normalize(p.name).includes(term) || (p.sku ?? "").toLowerCase().includes(term);
    });
  }, [products.data, q, stock, cat]);

  const lowCount = (products.data ?? []).filter((p) => p.quantity <= p.reorder_level).length;

  function exportCsv() {
    downloadCsv(`smartstock-products-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["שם", "מק״ט", "קטגוריה", "ספק", "כמות", "רף הזמנה", "עלות", "מחיר מכירה"],
      ...rows.map((p) => [
        p.name,
        p.sku,
        catName.get(p.category_id ?? -1) ?? "",
        sups.find((s) => s.id === p.supplier_id)?.name ?? "",
        p.quantity,
        p.reorder_level,
        p.cost_price,
        p.sell_price,
      ]),
    ]);
  }

  return (
    <>
      <PageHeader
        title="מלאי"
        sub={products.data ? `${count(products.data.length)} מוצרים` : undefined}
        actions={
          <>
            <Button variant="secondary" icon={<Tags className="size-[18px]" />} onClick={() => setLists(true)}>
              <span className="hidden sm:inline">קטגוריות וספקים</span>
              <span className="sm:hidden">רשימות</span>
            </Button>
            <Button icon={<Plus className="size-[18px]" />} onClick={() => setEditing("new")}>
              מוצר חדש
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="חיפוש לפי שם או מק״ט" className="lg:max-w-sm lg:flex-1" />
        <div className="flex gap-2 overflow-x-auto">
          <Segmented
            label="סינון מלאי"
            value={stock}
            onChange={setStock}
            options={[
              { value: "all", label: "הכל" },
              { value: "low", label: `מלאי נמוך${lowCount ? ` (${lowCount})` : ""}` },
              { value: "out", label: "אזל" },
            ]}
          />
          <Select aria-label="קטגוריה" value={cat} onChange={(e) => setCat(e.target.value)} className="h-10 w-auto min-w-36">
            <option value="">כל הקטגוריות</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="none">ללא קטגוריה</option>
          </Select>
        </div>
        <Button variant="ghost" className="lg:ms-auto" icon={<Download className="size-4" />} onClick={exportCsv} disabled={!rows.length}>
          ייצוא לאקסל
        </Button>
      </div>

      {products.isLoading ? (
        <Loading />
      ) : products.error ? (
        <ErrorBox error={errorText(products.error)} onRetry={() => products.refetch()} />
      ) : (products.data ?? []).length === 0 ? (
        <Panel>
          <Empty
            icon={<Boxes />}
            title="עוד אין מוצרים"
            text="הוסיפו את המוצר הראשון כדי להתחיל למכור ולעקוב אחרי המלאי."
            action={<Button onClick={() => setEditing("new")}>הוספת מוצר</Button>}
          />
        </Panel>
      ) : rows.length === 0 ? (
        <Panel>
          <Empty title="לא נמצאו מוצרים" text="נסו חיפוש אחר או נקו את הסינון." />
        </Panel>
      ) : (
        <>
          {/* Desktop table */}
          <Panel className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-surface-2 text-muted">
                <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-start [&>th]:font-medium">
                  <th>מוצר</th>
                  <th>קטגוריה</th>
                  <th className="!text-end">עלות</th>
                  <th className="!text-end">מחיר</th>
                  <th className="!text-end">במלאי</th>
                  <th className="w-36"><span className="sr-only">פעולות</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2/60">
                    <td className="px-4 py-2.5">
                      <button type="button" className="text-start font-medium hover:underline" onClick={() => setDetails(p)}>
                        {p.name}
                      </button>
                      {p.sku && <div className="num text-xs text-muted">{p.sku}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{catName.get(p.category_id ?? -1) ?? "—"}</td>
                    <td className="num px-4 py-2.5 text-end text-muted">{money(p.cost_price)}</td>
                    <td className="num px-4 py-2.5 text-end font-semibold">{money(p.sell_price)}</td>
                    <td className="px-4 py-2.5 text-end">
                      <StockBadge p={p} />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex justify-end">
                        <IconButton label={`קליטת סחורה: ${p.name}`} onClick={() => setRestock(p)}>
                          <PackagePlus className="size-[18px]" />
                        </IconButton>
                        <IconButton label={`היסטוריה: ${p.name}`} onClick={() => setDetails(p)}>
                          <History className="size-[18px]" />
                        </IconButton>
                        <IconButton label={`עריכה: ${p.name}`} onClick={() => setEditing(p)}>
                          <Pencil className="size-[18px]" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {/* Mobile list */}
          <Panel className="divide-y divide-line md:hidden">
            {rows.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <button type="button" className="min-w-0 flex-1 text-start" onClick={() => setDetails(p)}>
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                    <span className="num font-semibold text-ink">{money(p.sell_price)}</span>
                    {catName.get(p.category_id ?? -1) && <span className="truncate">{catName.get(p.category_id ?? -1)}</span>}
                  </div>
                </button>
                <StockBadge p={p} />
                <IconButton label={`קליטת סחורה: ${p.name}`} onClick={() => setRestock(p)} className="-me-2">
                  <PackagePlus className="size-5" />
                </IconButton>
              </div>
            ))}
          </Panel>
        </>
      )}

      <ProductForm
        open={editing !== null}
        product={editing === "new" ? null : editing}
        categories={cats}
        suppliers={sups}
        onClose={() => setEditing(null)}
      />
      <RestockModal product={restock} onClose={() => setRestock(null)} />
      <ProductDetails
        product={details ? (products.data?.find((p) => p.id === details.id) ?? details) : null}
        categoryName={details ? catName.get(details.category_id ?? -1) : undefined}
        supplierName={details ? sups.find((s) => s.id === details.supplier_id)?.name : undefined}
        onClose={() => setDetails(null)}
        onEdit={(p) => {
          setDetails(null);
          setEditing(p);
        }}
        onRestock={(p) => {
          setDetails(null);
          setRestock(p);
        }}
      />
      <ListsModal open={lists} onClose={() => setLists(false)} />
    </>
  );
}

export function StockBadge({ p }: { p: Pick<Product, "quantity" | "reorder_level"> }) {
  if (p.quantity === 0) return <Badge tone="warn">אזל</Badge>;
  if (p.quantity <= p.reorder_level)
    return (
      <Badge tone="tag">
        <span className="num">{count(p.quantity)}</span>
      </Badge>
    );
  return <span className="num text-sm font-semibold">{count(p.quantity)}</span>;
}

// ---------------------------------------------------------------- Product form

type FormState = {
  name: string;
  sku: string;
  sell_price: string;
  cost_price: string;
  quantity: string;
  reorder_level: string;
  category_id: string;
  supplier_id: string;
  description: string;
};

const toForm = (p: Product | null): FormState => ({
  name: p?.name ?? "",
  sku: p?.sku ?? "",
  sell_price: p?.sell_price != null ? String(p.sell_price) : "",
  cost_price: p?.cost_price != null ? String(p.cost_price) : "",
  quantity: p ? String(p.quantity) : "",
  reorder_level: p ? String(p.reorder_level) : "5",
  category_id: p?.category_id ? String(p.category_id) : "",
  supplier_id: p?.supplier_id ? String(p.supplier_id) : "",
  description: p?.description ?? "",
});

export function ProductForm({
  open,
  product,
  categories,
  suppliers,
  onClose,
  presetSku,
  onSaved,
}: {
  open: boolean;
  product: Product | null;
  categories: Category[];
  suppliers: Supplier[];
  onClose: () => void;
  presetSku?: string;
  onSaved?: (p: Product) => void;
}) {
  const save = useSaveProduct();
  const del = useDeleteProduct();
  const saveCat = useSaveRow<Category>("categories");
  const [f, setF] = useState<FormState>(toForm(product));
  const [scan, setScan] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [newCat, setNewCat] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (open) {
      setF({ ...toForm(product), ...(presetSku && !product ? { sku: presetSku } : {}) });
      setErrors({});
      setNewCat(null);
    }
  }, [open, product, presetSku]);

  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const sell = Number(f.sell_price);
  const cost = Number(f.cost_price);
  const margin = sell > 0 && f.cost_price !== "" ? Math.round(((sell - cost) / sell) * 100) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!f.name.trim()) errs.name = "צריך שם למוצר";
    if (f.sell_price === "" || sell < 0) errs.sell_price = "מחיר מכירה לא תקין";
    if (f.cost_price !== "" && cost < 0) errs.cost_price = "עלות לא תקינה";
    if (!product && f.quantity !== "" && (!Number.isInteger(Number(f.quantity)) || Number(f.quantity) < 0)) errs.quantity = "כמות לא תקינה";
    if (f.reorder_level !== "" && (!Number.isInteger(Number(f.reorder_level)) || Number(f.reorder_level) < 0)) errs.reorder_level = "מספר שלם בלבד";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    try {
      const saved = await save.mutateAsync({
        id: product?.id,
        data: {
          name: f.name.trim(),
          sku: f.sku.trim() || null,
          sell_price: sell,
          cost_price: f.cost_price === "" ? 0 : cost,
          reorder_level: f.reorder_level === "" ? 0 : Number(f.reorder_level),
          category_id: f.category_id ? Number(f.category_id) : null,
          supplier_id: f.supplier_id ? Number(f.supplier_id) : null,
          description: f.description.trim() || null,
          ...(product ? {} : { quantity: f.quantity === "" ? 0 : Number(f.quantity) }),
        },
      });
      toast.success(product ? "המוצר עודכן" : "המוצר נוסף");
      onSaved?.(saved);
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function addCategory() {
    if (!newCat?.trim()) return;
    try {
      const c = await saveCat.mutateAsync({ data: { name: newCat.trim() } });
      setF((s) => ({ ...s, category_id: String(c.id) }));
      setNewCat(null);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function remove() {
    if (!product) return;
    try {
      await del.mutateAsync(product.id);
      toast.success("המוצר נמחק");
      setConfirmDel(false);
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={product ? "עריכת מוצר" : "מוצר חדש"}
        wide
        footer={
          <div className="flex gap-2">
            <Button type="submit" form="product-form" className="flex-1 sm:flex-none sm:px-8" loading={save.isPending}>
              {product ? "שמירת שינויים" : "הוספת המוצר"}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              ביטול
            </Button>
            {product && (
              <Button variant="ghost" className="ms-auto text-warn" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDel(true)}>
                <span className="hidden sm:inline">מחיקה</span>
              </Button>
            )}
          </div>
        }
      >
        <form id="product-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Input label="שם המוצר" value={f.name} onChange={set("name")} error={errors.name} className="" autoComplete="off" />
          <Field label="מק״ט / ברקוד" hint="אופציונלי. מאפשר מכירה בסריקה" htmlFor="product-sku">
            <div className="relative">
              <input
                id="product-sku"
                value={f.sku}
                onChange={set("sku")}
                dir="ltr"
                autoComplete="off"
                className="h-11 w-full rounded-[10px] border border-line bg-surface pl-12 pr-3 text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <IconButton label="סריקת ברקוד" className="absolute end-0.5 top-0.5" onClick={() => setScan(true)}>
                <ScanBarcode className="size-5" />
              </IconButton>
            </div>
          </Field>

          <Input label="מחיר מכירה (₪)" type="number" inputMode="decimal" min={0} step="0.01" dir="ltr" value={f.sell_price} onChange={set("sell_price")} error={errors.sell_price} />
          <Input
            label="עלות (₪)"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            dir="ltr"
            value={f.cost_price}
            onChange={set("cost_price")}
            error={errors.cost_price}
            hint={margin != null ? `רווח גולמי ${margin}% (${money(sell - cost)} ליחידה)` : "משמש לחישוב רווח"}
          />

          {!product ? (
            <Input label="כמות במלאי" type="number" inputMode="numeric" min={0} step={1} dir="ltr" value={f.quantity} onChange={set("quantity")} error={errors.quantity} />
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">כמות במלאי</span>
              <div className="flex h-11 items-center rounded-[10px] bg-surface-2 px-3 text-muted">
                <span className="num font-semibold text-ink">{count(product.quantity)}</span>
                <span className="ms-2 text-xs">משנים דרך ״קליטת סחורה״ כדי שיירשם ביומן</span>
              </div>
            </div>
          )}
          <Input
            label="רף מלאי נמוך"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            dir="ltr"
            value={f.reorder_level}
            onChange={set("reorder_level")}
            error={errors.reorder_level}
            hint="מתחת לכמות הזו המוצר יסומן להזמנה"
          />

          <div>
            {newCat === null ? (
              <Select
                label="קטגוריה"
                value={f.category_id}
                onChange={(e) => (e.target.value === "__new" ? setNewCat("") : set("category_id")(e))}
              >
                <option value="">ללא קטגוריה</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="__new">+ קטגוריה חדשה…</option>
              </Select>
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">קטגוריה חדשה</span>
                <div className="flex gap-2">
                  <input
                    className="h-11 w-full rounded-[10px] border border-line bg-surface px-3 outline-none focus:border-brand"
                    value={newCat}
                    autoFocus
                    aria-label="שם הקטגוריה"
                    onChange={(e) => setNewCat(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())}
                  />
                  <Button onClick={addCategory} loading={saveCat.isPending} disabled={!newCat.trim()}>
                    הוספה
                  </Button>
                  <Button variant="ghost" onClick={() => setNewCat(null)}>
                    ביטול
                  </Button>
                </div>
              </div>
            )}
          </div>
          <Select label="ספק" value={f.supplier_id} onChange={set("supplier_id")} hint={suppliers.length ? undefined : "מוסיפים ספקים ב״קטגוריות וספקים״"}>
            <option value="">ללא ספק</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Textarea label="תיאור" value={f.description} onChange={set("description")} className="sm:col-span-2" rows={2} />
        </form>
      </Modal>

      <ScannerModal
        open={scan}
        onClose={() => setScan(false)}
        onResult={(code) => {
          setF((s) => ({ ...s, sku: code }));
          setScan(false);
        }}
      />
      <Confirm
        open={confirmDel}
        title={`למחוק את "${product?.name}"?`}
        text="המוצר יוסר מהמלאי. הזמנות קודמות יישארו בהיסטוריה עם שם המוצר."
        confirmLabel="מחיקת המוצר"
        danger
        loading={del.isPending}
        onConfirm={remove}
        onClose={() => setConfirmDel(false)}
      />
    </>
  );
}

// ---------------------------------------------------------------- Restock / count correction

export function RestockModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const adjust = useAdjustStock();
  const [mode, setMode] = useState<"restock" | "adjustment" | "return">("restock");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (product) {
      setMode("restock");
      setValue("");
      setNote("");
    }
  }, [product]);

  if (!product) return null;
  const n = Number(value);
  const valid = value !== "" && Number.isInteger(n) && n >= 0;
  const change = mode === "adjustment" ? n - product.quantity : n;
  const after = product.quantity + (valid ? change : 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || change === 0 || !product) return;
    try {
      const q = await adjust.mutateAsync({ productId: product.id, change, type: mode, note: note.trim() || undefined });
      toast.success(`${product.name}: ${count(q)} במלאי`);
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={product.name}
      footer={
        <Button type="submit" form="restock-form" className="w-full" loading={adjust.isPending} disabled={!valid || change === 0}>
          {mode === "adjustment" ? "עדכון הספירה" : `הוספת ${valid && n ? count(n) : ""} יחידות`}
        </Button>
      }
    >
      <form id="restock-form" onSubmit={submit} className="grid gap-4">
        <Segmented
          label="סוג עדכון"
          className="w-full"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setValue("");
          }}
          options={[
            { value: "restock", label: "קליטת סחורה" },
            { value: "adjustment", label: "ספירת מלאי" },
            { value: "return", label: "החזרה" },
          ]}
        />
        <Input
          label={mode === "adjustment" ? "כמה יש בפועל על המדף?" : "כמה יחידות?"}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          dir="ltr"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <div className="flex items-center justify-between rounded-[10px] bg-surface-2 px-4 py-3 text-sm">
          <span className="text-muted">
            במלאי עכשיו <span className="num font-semibold text-ink">{count(product.quantity)}</span>
          </span>
          <span className="text-muted">
            אחרי העדכון{" "}
            <span className={cx("num font-semibold", after < 0 ? "text-warn" : "text-ink")}>{count(after)}</span>
            {valid && change !== 0 && (
              <span className={cx("num ms-1", change > 0 ? "text-ok" : "text-warn")}>({change > 0 ? "+" : ""}{change})</span>
            )}
          </span>
        </div>
        <Input label="הערה" value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "restock" ? "למשל: חשבונית 1234" : ""} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- Product details + stock history

const LOG_LABEL: Record<string, string> = {
  initial: "מלאי פתיחה",
  restock: "קליטת סחורה",
  sale: "מכירה",
  adjustment: "ספירת מלאי",
  return: "החזרה",
  cancel: "ביטול הזמנה",
};

function ProductDetails({
  product,
  categoryName,
  supplierName,
  onClose,
  onEdit,
  onRestock,
}: {
  product: Product | null;
  categoryName?: string;
  supplierName?: string;
  onClose: () => void;
  onEdit: (p: Product) => void;
  onRestock: (p: Product) => void;
}) {
  const logs = useInventoryLogs(product?.id ?? null);
  if (!product) return null;
  const margin = product.sell_price ? Math.round((((product.sell_price ?? 0) - (product.cost_price ?? 0)) / product.sell_price) * 100) : null;

  return (
    <Modal
      open
      onClose={onClose}
      title={product.name}
      wide
      footer={
        <div className="flex gap-2">
          <Button icon={<PackagePlus className="size-4" />} onClick={() => onRestock(product)}>
            קליטת סחורה
          </Button>
          <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => onEdit(product)}>
            עריכה
          </Button>
        </div>
      }
    >
      <dl className="grid grid-cols-2 gap-4 rounded-[12px] bg-surface-2 p-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted">במלאי</dt>
          <dd className="mt-1">
            <StockBadge p={product} />
          </dd>
        </div>
        <div>
          <dt className="text-muted">מחיר</dt>
          <dd className="num mt-1 font-semibold">{money(product.sell_price)}</dd>
        </div>
        <div>
          <dt className="text-muted">עלות</dt>
          <dd className="num mt-1 font-semibold">{money(product.cost_price)}</dd>
        </div>
        <div>
          <dt className="text-muted">רווח גולמי</dt>
          <dd className="num mt-1 font-semibold">{margin != null ? `${margin}%` : "—"}</dd>
        </div>
        {product.sku && (
          <div>
            <dt className="text-muted">מק״ט</dt>
            <dd className="num mt-1">{product.sku}</dd>
          </div>
        )}
        <div>
          <dt className="text-muted">קטגוריה</dt>
          <dd className="mt-1">{categoryName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">ספק</dt>
          <dd className="mt-1">{supplierName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">רף הזמנה</dt>
          <dd className="num mt-1">{count(product.reorder_level)}</dd>
        </div>
      </dl>
      {product.description && <p className="mt-3 text-sm text-muted">{product.description}</p>}

      <h3 className="mb-2 mt-5 font-bold">תנועות מלאי</h3>
      {logs.isLoading ? (
        <Loading />
      ) : !logs.data?.length ? (
        <p className="text-sm text-muted">עדיין אין תנועות רשומות למוצר הזה.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {logs.data.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-2">
              <span className={cx("num w-12 shrink-0 font-semibold", l.change_amount > 0 ? "text-ok" : "text-warn")}>
                {l.change_amount > 0 ? "+" : ""}
                {l.change_amount}
              </span>
              <span className="min-w-0 flex-1">
                {LOG_LABEL[l.change_type] ?? l.change_type}
                {l.note && <span className="text-muted"> · {l.note}</span>}
              </span>
              <span className="shrink-0 text-xs text-muted">{dateTime(l.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- Categories & suppliers

function ListsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"categories" | "suppliers">("categories");
  return (
    <Modal open={open} onClose={onClose} title="קטגוריות וספקים">
      <Segmented
        label="רשימה"
        className="mb-4 w-full"
        value={tab}
        onChange={setTab}
        options={[
          { value: "categories", label: "קטגוריות" },
          { value: "suppliers", label: "ספקים" },
        ]}
      />
      {tab === "categories" ? <CategoryList /> : <SupplierList />}
    </Modal>
  );
}

function CategoryList() {
  const { data = [], isLoading } = useCategories();
  const save = useSaveRow<Category>("categories");
  const del = useDeleteRow("categories");
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<{ id: number; name: string } | null>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await save.mutateAsync({ data: { name: name.trim() } });
      setName("");
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  return (
    <div>
      <form onSubmit={add} className="flex gap-2">
        <Input aria-label="קטגוריה חדשה" placeholder="קטגוריה חדשה" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" loading={save.isPending && !edit} disabled={!name.trim()}>
          הוספה
        </Button>
      </form>
      {isLoading ? (
        <Loading />
      ) : data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">עוד אין קטגוריות.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {data.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-1.5">
              {edit?.id === c.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await save.mutateAsync({ id: c.id, data: { name: edit.name.trim() } });
                      setEdit(null);
                    } catch (err) {
                      toast.error(errorText(err));
                    }
                  }}
                >
                  <Input aria-label="שם הקטגוריה" value={edit.name} onChange={(e) => setEdit({ id: c.id, name: e.target.value })} autoFocus />
                  <Button type="submit" size="md" disabled={!edit.name.trim()}>
                    שמירה
                  </Button>
                </form>
              ) : (
                <>
                  <span className="flex-1">{c.name}</span>
                  <IconButton label={`עריכה: ${c.name}`} onClick={() => setEdit({ id: c.id, name: c.name })}>
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton label={`מחיקה: ${c.name}`} onClick={() => setToDelete(c)}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <Confirm
        open={!!toDelete}
        title={`למחוק את הקטגוריה "${toDelete?.name}"?`}
        text="המוצרים בקטגוריה יישארו, רק בלי קטגוריה."
        confirmLabel="מחיקה"
        danger
        loading={del.isPending}
        onConfirm={async () => {
          try {
            await del.mutateAsync(toDelete!.id);
            setToDelete(null);
          } catch (err) {
            toast.error(errorText(err));
          }
        }}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

function SupplierList() {
  const { data = [], isLoading } = useSuppliers();
  const save = useSaveRow<Supplier>("suppliers");
  const del = useDeleteRow("suppliers");
  const [form, setForm] = useState<{ id?: number; name: string; phone: string; contact_email: string; notes: string } | null>(null);
  const [toDelete, setToDelete] = useState<Supplier | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form?.name.trim()) return;
    try {
      await save.mutateAsync({
        id: form.id,
        data: {
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          contact_email: form.contact_email.trim() || null,
          notes: form.notes.trim() || null,
        },
      });
      setForm(null);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  if (form) {
    return (
      <form onSubmit={submit} className="grid gap-3">
        <Input label="שם הספק" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
        <Input label="טלפון" type="tel" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input label="אימייל" type="email" dir="ltr" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
        <Textarea label="הערות" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <div className="flex gap-2">
          <Button type="submit" loading={save.isPending} disabled={!form.name.trim()} className="flex-1">
            {form.id ? "שמירה" : "הוספת ספק"}
          </Button>
          <Button variant="secondary" onClick={() => setForm(null)}>
            ביטול
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <Button className="w-full" variant="secondary" icon={<Truck className="size-4" />} onClick={() => setForm({ name: "", phone: "", contact_email: "", notes: "" })}>
        ספק חדש
      </Button>
      {isLoading ? (
        <Loading />
      ) : data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">עוד אין ספקים.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {data.map((s) => (
            <li key={s.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{s.name}</div>
                {(s.phone || s.contact_email) && (
                  <div className="truncate text-xs text-muted" dir="ltr">
                    {[s.phone, s.contact_email].filter(Boolean).join("  ")}
                  </div>
                )}
              </div>
              <IconButton
                label={`עריכה: ${s.name}`}
                onClick={() => setForm({ id: s.id, name: s.name, phone: s.phone ?? "", contact_email: s.contact_email ?? "", notes: s.notes ?? "" })}
              >
                <Pencil className="size-4" />
              </IconButton>
              <IconButton label={`מחיקה: ${s.name}`} onClick={() => setToDelete(s)}>
                <Trash2 className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <Confirm
        open={!!toDelete}
        title={`למחוק את הספק "${toDelete?.name}"?`}
        text="המוצרים של הספק יישארו, רק בלי שיוך לספק."
        confirmLabel="מחיקה"
        danger
        loading={del.isPending}
        onConfirm={async () => {
          try {
            await del.mutateAsync(toDelete!.id);
            setToDelete(null);
          } catch (err) {
            toast.error(errorText(err));
          }
        }}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
