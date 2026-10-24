import { MessageCircle, Printer } from "lucide-react";
import { dateTime, money, waPhone } from "../lib/format";
import type { Order, OrderItem, Profile } from "../lib/types";
import { Button } from "./ui";

/** The receipt as a thermal strip. Also the printable area. */
export function Receipt({ order, items, profile }: { order: Order; items: OrderItem[]; profile?: Profile | null }) {
  const subtotal = items.reduce((a, i) => a + i.quantity * Number(i.sell_price), 0);
  const cancelled = order.status === "cancelled";
  return (
    <div className="receipt print-area mx-auto w-full max-w-[340px] rounded-t-[6px] border border-b-0 border-line px-5 pt-5 text-sm shadow-panel">
      <div className="text-center">
        {profile?.logo_url && /^(https?:|data:image)/.test(profile.logo_url) && (
          <img src={profile.logo_url} alt="" className="mx-auto mb-2 size-12 object-contain" />
        )}
        <div className="text-base font-bold">{profile?.business_name || "קבלה"}</div>
        {(profile?.tax_id || profile?.phone) && (
          <div className="mt-0.5 text-xs text-muted">
            {profile.tax_id && <>ח״פ/ע״מ <span className="num">{profile.tax_id}</span></>}
            {profile.tax_id && profile.phone && " · "}
            {profile.phone && <span className="num">{profile.phone}</span>}
          </div>
        )}
        {profile?.address && <div className="text-xs text-muted">{profile.address}</div>}
      </div>

      <hr className="receipt-rule my-3" />
      <div className="flex justify-between text-xs text-muted">
        <span>
          הזמנה <span className="num font-semibold text-ink">#{order.id}</span>
        </span>
        <span className="num">{dateTime(order.created_at)}</span>
      </div>
      {order.customer_name && <div className="mt-1 text-xs text-muted">לקוח: {order.customer_name}</div>}
      {cancelled && <div className="mt-2 rounded bg-warn-soft px-2 py-1 text-center text-xs font-bold text-warn">ההזמנה בוטלה</div>}

      <hr className="receipt-rule my-3" />
      <ul className="grid gap-2">
        {items.map((i) => (
          <li key={i.id} className="flex items-start gap-2">
            <span className="min-w-0 flex-1">
              {i.product_name}
              <span className="block text-xs text-muted">
                <span className="num">{i.quantity}</span> × <span className="num">{money(i.sell_price)}</span>
              </span>
            </span>
            <span className="num font-medium">{money(i.quantity * Number(i.sell_price))}</span>
          </li>
        ))}
      </ul>

      <hr className="receipt-rule my-3" />
      {Number(order.discount) > 0 && (
        <>
          <div className="flex justify-between text-muted">
            <span>סכום ביניים</span>
            <span className="num">{money(subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>הנחה</span>
            <span className="num">−{money(order.discount)}</span>
          </div>
        </>
      )}
      <div className="mt-1 flex items-end justify-between">
        <span className="font-bold">סה״כ</span>
        <span className="figure num text-[34px]">{money(order.total_amount)}</span>
      </div>
      <div className="mt-1 text-xs text-muted">שולם ב{order.payment_method}</div>
      {order.note && <div className="mt-2 text-xs text-muted">{order.note}</div>}
      <div className="mt-4 text-center text-xs text-muted">תודה שקניתם אצלנו</div>
    </div>
  );
}

export function receiptText(order: Order, items: OrderItem[], profile?: Profile | null) {
  const lines = [
    `*${profile?.business_name || "קבלה"}*`,
    `הזמנה #${order.id} · ${dateTime(order.created_at)}`,
    "",
    ...items.map((i) => `${i.product_name} × ${i.quantity}  ${money(i.quantity * Number(i.sell_price))}`),
    "",
    ...(Number(order.discount) > 0 ? [`הנחה: −${money(order.discount)}`] : []),
    `*סה״כ: ${money(order.total_amount)}*`,
    `אמצעי תשלום: ${order.payment_method ?? ""}`,
    "",
    "תודה שקניתם אצלנו!",
  ];
  return lines.join("\n");
}

export function ReceiptActions({
  order,
  items,
  profile,
  customerPhone,
}: {
  order: Order;
  items: OrderItem[];
  profile?: Profile | null;
  customerPhone?: string | null;
}) {
  const phone = waPhone(customerPhone);
  const text = encodeURIComponent(receiptText(order, items, profile));
  const href = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  return (
    <div className="no-print grid grid-cols-2 gap-2">
      <Button
        variant="primary"
        icon={<MessageCircle className="size-[18px]" />}
        onClick={() => window.open(href, "_blank", "noopener")}
        title={phone ? `שליחה ל־${customerPhone}` : "בחירת איש קשר בוואטסאפ"}
      >
        וואטסאפ
      </Button>
      <Button variant="secondary" icon={<Printer className="size-[18px]" />} onClick={() => window.print()}>
        הדפסה
      </Button>
    </div>
  );
}
