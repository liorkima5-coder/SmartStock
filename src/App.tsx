import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./lib/auth";
import { CartProvider, useCart } from "./lib/cart";
import { useRoute } from "./lib/router";
import { Shell } from "./components/Shell";
import { Spinner } from "./components/ui";
import { Logo } from "./components/Logo";
import { AuthPage, NewPasswordPage } from "./pages/Auth";
import { DashboardPage } from "./pages/Dashboard";
import { PosPage } from "./pages/Pos";
import { ProductsPage } from "./pages/Products";
import { OrdersPage } from "./pages/Orders";
import { CustomersPage } from "./pages/Customers";
import { ReportsPage } from "./pages/Reports";
import { SettingsPage } from "./pages/Settings";

export function App() {
  const { user, loading, recovering } = useAuth();
  const qc = useQueryClient();
  const lastUser = useRef<string | null>(null);

  // Never show one account's cached data to another account on a shared device.
  // Runs during render (before pages mount their queries) and only when a signed-in account goes away or changes.
  const id = user?.id ?? null;
  if (lastUser.current !== id) {
    if (lastUser.current !== null) qc.clear();
    lastUser.current = id;
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <Logo className="size-12" />
        <Spinner />
      </div>
    );
  }
  if (recovering) return <NewPasswordPage />;
  if (!user) return <AuthPage />;

  return (
    <CartProvider userId={user.id} key={user.id}>
      <Main />
    </CartProvider>
  );
}

function Main() {
  const route = useRoute();
  const { count } = useCart();
  const page = {
    dashboard: <DashboardPage />,
    pos: <PosPage />,
    products: <ProductsPage />,
    orders: <OrdersPage />,
    customers: <CustomersPage />,
    reports: <ReportsPage />,
    settings: <SettingsPage />,
  }[route];

  useEffect(() => {
    const titles: Record<string, string> = {
      dashboard: "סקירה",
      pos: "קופה",
      products: "מלאי",
      orders: "הזמנות",
      customers: "לקוחות",
      reports: "דוחות",
      settings: "הגדרות",
    };
    document.title = `${titles[route]} · SmartStock`;
  }, [route]);

  return (
    <Shell cartCount={count}>
      <div key={route}>{page}</div>
    </Shell>
  );
}
