import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type {
  Category,
  Customer,
  Dashboard,
  InventoryLog,
  Order,
  OrderItem,
  Product,
  Profile,
  Reports,
  Supplier,
} from "./types";
import { useAuth } from "./auth";

/** Throws the Supabase error so React Query surfaces it. */
function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

/** PostgREST caps responses at 1000 rows, so page through larger tables. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const rows = unwrap(await build(from, from + size - 1));
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

export const keys = {
  profile: ["profile"] as const,
  products: ["products"] as const,
  categories: ["categories"] as const,
  suppliers: ["suppliers"] as const,
  customers: ["customers"] as const,
  orders: (f: OrderFilter) => ["orders", f] as const,
  orderItems: (id: number) => ["order-items", id] as const,
  customerOrders: (id: number) => ["customer-orders", id] as const,
  logs: (id: number) => ["logs", id] as const,
  dashboard: ["dashboard"] as const,
  reports: (days: number) => ["reports", days] as const,
};

// ---------------------------------------------------------------- reads

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.profile,
    enabled: !!user,
    queryFn: async () => {
      const res = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return unwrap(res) as Profile | null;
    },
  });
}

export function useProducts() {
  return useQuery({
    queryKey: keys.products,
    queryFn: () =>
      fetchAll<Product>((a, b) => supabase.from("products").select("*").order("name").range(a, b)),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: async () => unwrap(await supabase.from("categories").select("*").order("name")) as Category[],
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: keys.suppliers,
    queryFn: async () => unwrap(await supabase.from("suppliers").select("*").order("name")) as Supplier[],
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: keys.customers,
    queryFn: () =>
      fetchAll<Customer>((a, b) => supabase.from("customers").select("*").order("name").range(a, b)),
  });
}

export type OrderFilter = {
  from?: string;
  to?: string;
  status?: "all" | "completed" | "cancelled";
  payment?: string;
  q?: string;
  page: number;
};
export const ORDERS_PAGE = 30;

export function useOrders(f: OrderFilter) {
  return useQuery({
    queryKey: keys.orders(f),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(f.page * ORDERS_PAGE, f.page * ORDERS_PAGE + ORDERS_PAGE - 1);
      if (f.from) q = q.gte("created_at", new Date(f.from + "T00:00:00").toISOString());
      if (f.to) q = q.lt("created_at", new Date(new Date(f.to + "T00:00:00").getTime() + 86400000).toISOString());
      if (f.status && f.status !== "all") q = q.eq("status", f.status);
      if (f.payment) q = q.eq("payment_method", f.payment);
      if (f.q) {
        const n = Number(f.q.replace(/^#/, ""));
        q = Number.isInteger(n) && n > 0 ? q.eq("id", n) : q.ilike("customer_name", `%${f.q}%`);
      }
      const res = await q;
      if (res.error) throw res.error;
      return { rows: (res.data ?? []) as Order[], total: res.count ?? 0 };
    },
  });
}

export function useOrder(id: number | null) {
  return useQuery({
    queryKey: ["order", id],
    enabled: id != null,
    queryFn: async () => unwrap(await supabase.from("orders").select("*").eq("id", id!).single()) as Order,
  });
}

export function useOrderItems(id: number | null) {
  return useQuery({
    queryKey: keys.orderItems(id ?? 0),
    enabled: id != null,
    queryFn: async () =>
      unwrap(await supabase.from("order_items").select("*").eq("order_id", id!).order("id")) as OrderItem[],
  });
}

export function useCustomerOrders(id: number | null) {
  return useQuery({
    queryKey: keys.customerOrders(id ?? 0),
    enabled: id != null,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("orders")
          .select("*")
          .eq("customer_id", id!)
          .order("created_at", { ascending: false })
          .limit(100),
      ) as Order[],
  });
}

export function useInventoryLogs(productId: number | null) {
  return useQuery({
    queryKey: keys.logs(productId ?? 0),
    enabled: productId != null,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("inventory_logs")
          .select("*")
          .eq("product_id", productId!)
          .order("created_at", { ascending: false })
          .limit(50),
      ) as InventoryLog[],
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: keys.dashboard,
    queryFn: async () =>
      unwrap(
        await supabase.rpc("get_dashboard", {
          p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jerusalem",
        }),
      ) as Dashboard,
  });
}

export function useReports(days: number) {
  return useQuery({
    queryKey: keys.reports(days),
    placeholderData: keepPreviousData,
    queryFn: async () => unwrap(await supabase.rpc("get_reports", { p_days: days })) as Reports,
  });
}

// ---------------------------------------------------------------- writes

/** After anything that moves stock or money, refresh every view that shows it. */
function useInvalidateSales() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: keys.products });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["order"] });
    qc.invalidateQueries({ queryKey: ["customer-orders"] });
    qc.invalidateQueries({ queryKey: ["logs"] });
    qc.invalidateQueries({ queryKey: keys.dashboard });
    qc.invalidateQueries({ queryKey: ["reports"] });
  };
}

export type ProductInput = Omit<Product, "id" | "created_at">;

export function useSaveProduct() {
  const invalidate = useInvalidateSales();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: Partial<ProductInput> }) => {
      if (id) {
        // quantity changes go through adjust_stock so they are logged
        const { quantity: _q, ...rest } = data;
        void _q;
        return unwrap(await supabase.from("products").update(rest).eq("id", id).select().single()) as Product;
      }
      return unwrap(await supabase.from("products").insert(data as ProductInput).select().single()) as Product;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateSales();
  return useMutation({
    mutationFn: async (id: number) => unwrap(await supabase.from("products").delete().eq("id", id)),
    onSuccess: invalidate,
  });
}

export function useAdjustStock() {
  const invalidate = useInvalidateSales();
  return useMutation({
    mutationFn: async (v: { productId: number; change: number; type: "restock" | "adjustment" | "return"; note?: string }) =>
      unwrap(
        await supabase.rpc("adjust_stock", {
          p_product_id: v.productId,
          p_change: v.change,
          p_type: v.type,
          p_note: v.note ?? null,
        }),
      ) as number,
    onSuccess: invalidate,
  });
}

export function useCreateOrder() {
  const invalidate = useInvalidateSales();
  return useMutation({
    mutationFn: async (v: {
      items: { product_id: number; quantity: number }[];
      customerId: number | null;
      payment: string;
      discount: number;
      note?: string;
    }) =>
      unwrap(
        await supabase.rpc("create_order", {
          p_items: v.items,
          p_customer_id: v.customerId,
          p_payment_method: v.payment,
          p_discount: v.discount,
          p_note: v.note ?? null,
        }),
      ) as number,
    onSuccess: invalidate,
  });
}

export function useCancelOrder() {
  const invalidate = useInvalidateSales();
  return useMutation({
    mutationFn: async (id: number) => unwrap(await supabase.rpc("cancel_order", { p_order_id: id })),
    onSuccess: invalidate,
  });
}

type Named = "categories" | "suppliers" | "customers";

export function useSaveRow<T extends { id: number }>(table: Named) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: Partial<Omit<T, "id">> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = data as any;
      if (id) return unwrap(await supabase.from(table).update(row).eq("id", id).select().single()) as T;
      return unwrap(await supabase.from(table).insert(row).select().single()) as T;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: keys.products });
    },
  });
}

export function useDeleteRow(table: Named) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => unwrap(await supabase.from(table).delete().eq("id", id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: keys.products });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: Partial<Profile>) =>
      unwrap(
        await supabase
          .from("profiles")
          .upsert({ ...data, id: user!.id })
          .select()
          .single(),
      ) as Profile,
    onSuccess: (p) => qc.setQueryData(keys.profile, p),
  });
}

export async function uploadLogo(userId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${userId}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true, cacheControl: "31536000" });
  if (error) throw error;
  return supabase.storage.from("logos").getPublicUrl(path).data.publicUrl;
}
