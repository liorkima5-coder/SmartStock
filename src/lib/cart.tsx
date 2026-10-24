import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** productId -> quantity */
export type Cart = Record<number, number>;

type CartCtx = {
  cart: Cart;
  count: number;
  set: (productId: number, qty: number) => void;
  add: (productId: number, by?: number) => void;
  clear: () => void;
};

const KEY = "smartstock.cart";
const Ctx = createContext<CartCtx | null>(null);

function load(): Cart {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export function CartProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const storageKey = `${KEY}.${userId}`;
  const [cart, setCart] = useState<Cart>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : load();
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      /* cart still works for this visit */
    }
  }, [cart, storageKey]);

  const value = useMemo<CartCtx>(
    () => ({
      cart,
      count: Object.values(cart).reduce((a, b) => a + b, 0),
      set: (id, qty) =>
        setCart((c) => {
          const next = { ...c };
          if (qty <= 0) delete next[id];
          else next[id] = qty;
          return next;
        }),
      add: (id, by = 1) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + by })),
      clear: () => setCart({}),
    }),
    [cart],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart outside CartProvider");
  return v;
}
