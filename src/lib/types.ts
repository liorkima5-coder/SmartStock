export type Profile = {
  id: string;
  username: string | null;
  business_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  company_id: string | null;
  logo_url: string | null;
  created_at: string;
};

export type Category = { id: number; name: string; created_at: string };

export type Supplier = {
  id: number;
  name: string;
  contact_email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
};

export type Product = {
  id: number;
  name: string;
  sku: string | null;
  description: string | null;
  quantity: number;
  reorder_level: number;
  cost_price: number | null;
  sell_price: number | null;
  category_id: number | null;
  supplier_id: number | null;
  created_at: string;
};

export type Customer = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  business_name: string | null;
  notes: string | null;
  created_at: string;
};

export type Order = {
  id: number;
  customer_id: number | null;
  customer_name: string | null;
  total_amount: number;
  discount: number;
  payment_method: string | null;
  status: "completed" | "cancelled";
  note: string | null;
  created_at: string;
};

export type OrderItem = {
  id: number;
  order_id: number;
  product_id: number | null;
  product_name: string | null;
  quantity: number;
  sell_price: number;
  cost_price: number | null;
};

export type InventoryLog = {
  id: number;
  product_id: number | null;
  change_amount: number;
  change_type: "initial" | "restock" | "sale" | "adjustment" | "return" | "cancel";
  note: string | null;
  created_at: string;
};

export type Dashboard = {
  today_sales: number;
  today_orders: number;
  month_sales: number;
  month_profit: number;
  month_orders: number;
  product_count: number;
  inventory_cost: number;
  inventory_retail: number;
  low_stock_count: number;
  out_of_stock_count: number;
  daily: { day: string; sales: number; profit: number; orders: number }[];
  payments: { method: string; total: number }[];
  top_products: { name: string; qty: number; revenue: number }[];
  low_stock: { id: number; name: string; quantity: number; reorder_level: number }[];
};

export type Reports = {
  days: number;
  total_revenue: number;
  total_profit: number;
  abc: {
    product_id: number | null;
    name: string;
    qty: number;
    revenue: number;
    profit: number;
    share: number;
    grade: "A" | "B" | "C";
  }[];
  forecast: {
    product_id: number;
    name: string;
    stock: number;
    reorder_level: number;
    daily_rate: number;
    days_left: number;
  }[];
  dead_stock: { product_id: number; name: string; stock: number; value: number }[];
  categories: { name: string; revenue: number }[];
};

export const PAYMENT_METHODS = ["מזומן", "אשראי", "ביט", "פייבוקס", "העברה בנקאית"] as const;
