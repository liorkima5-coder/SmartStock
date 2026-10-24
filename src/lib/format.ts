const amount2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amount0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const int = new Intl.NumberFormat("he-IL");

// "₪12" / "₪12.50", wrapped in a left-to-right isolate so it never flips inside Hebrew text
const LRI = "\u2066";
const PDI = "\u2069";

export function money(n: number | null | undefined) {
  const v = Math.round(Number(n ?? 0) * 100) / 100;
  const body = Number.isInteger(v) ? amount0.format(Math.abs(v)) : amount2.format(Math.abs(v));
  return `${LRI}${v < 0 ? "-" : ""}₪${body}${PDI}`;
}
export function moneyShort(n: number | null | undefined) {
  const v = Number(n ?? 0);
  if (Math.abs(v) < 10000) return money(v);
  return `${LRI}${v < 0 ? "-" : ""}₪${compact.format(Math.abs(v))}${PDI}`;
}
export const count = (n: number | null | undefined) => int.format(Number(n ?? 0));

export const dateTime = (s: string) =>
  new Date(s).toLocaleString("he-IL", { day: "numeric", month: "numeric", year: "2-digit", hour: "2-digit", minute: "2-digit" });
export const dateShort = (s: string) => new Date(s).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
export const dateLong = (s: string) =>
  new Date(s).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });

/** Turns an Israeli phone number into the international form WhatsApp expects. */
export function waPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "972" + d.slice(1);
  if (d.length < 9) return null;
  return d;
}

/** Translates the errors people actually hit into plain Hebrew. */
export function errorText(err: unknown): string {
  const raw =
    typeof err === "string"
      ? err
      : err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "";
  const map: [RegExp, string][] = [
    [/invalid login credentials/i, "האימייל או הסיסמה שגויים"],
    [/email not confirmed/i, "צריך לאשר את כתובת האימייל. בדקו את תיבת הדואר (גם בספאם)"],
    [/user already registered|already been registered/i, "כבר קיים חשבון עם האימייל הזה. נסו להתחבר"],
    [/password should be at least/i, "הסיסמה צריכה להכיל לפחות 6 תווים"],
    [/rate limit|too many requests|security purposes/i, "יותר מדי ניסיונות. נסו שוב בעוד דקה"],
    [/unable to validate email|invalid email/i, "כתובת האימייל לא תקינה"],
    [/failed to fetch|networkerror|load failed/i, "אין חיבור לאינטרנט. בדקו את החיבור ונסו שוב"],
    [/products_user_sku_key|duplicate key.*sku/i, "כבר קיים מוצר עם המק״ט הזה"],
    [/products_quantity_nonneg/i, "המלאי לא יכול לרדת מתחת לאפס"],
    [/products_prices_nonneg/i, "מחיר לא יכול להיות שלילי"],
    [/jwt expired|invalid jwt|not authenticated/i, "פג תוקף ההתחברות. התחברו מחדש"],
    [/new password should be different/i, "הסיסמה החדשה חייבת להיות שונה מהקודמת"],
  ];
  for (const [re, text] of map) if (re.test(raw)) return text;
  // Messages raised by our own database functions are already in Hebrew
  if (/[֐-׿]/.test(raw)) return raw;
  return raw ? `שגיאה: ${raw}` : "משהו השתבש. נסו שוב";
}

/** CSV with a BOM so Excel opens Hebrew correctly. */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const normalize = (s: string) => s.trim().toLowerCase();
