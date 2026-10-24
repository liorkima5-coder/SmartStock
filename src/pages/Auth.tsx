import { useState, type FormEvent } from "react";
import { BarChart3, Boxes, ScanBarcode, ShoppingCart } from "lucide-react";
import { supabase } from "../lib/supabase";
import { errorText } from "../lib/format";
import { useAuth } from "../lib/auth";
import { Button, Input, Panel, Segmented } from "../components/ui";
import { Logo } from "../components/Logo";

type Mode = "login" | "register" | "forgot";

export function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Pitch */}
      <section className="relative overflow-hidden bg-brand px-6 pb-10 pt-8 text-brand-ink lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div className="flex items-center gap-3">
          <Logo className="size-10 [&_rect]:fill-[rgb(255_255_255/0.14)]" />
          <span className="text-lg font-bold">SmartStock</span>
        </div>

        <div className="mt-10 max-w-xl lg:mt-0">
          <h1 className="figure text-[64px] leading-[0.85] sm:text-[84px] lg:text-[104px]">
            המלאי, הקופה והלקוחות
            <br />
            בכיס אחד.
          </h1>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed opacity-90">
            מוכרים מהטלפון ליד הדלפק, רואים מה עומד להיגמר לפני שהוא נגמר, ושולחים קבלה בוואטסאפ. בלי התקנה ובלי ציוד מיוחד.
          </p>
        </div>

        <ul className="mt-10 grid max-w-xl grid-cols-2 gap-x-6 gap-y-4 text-[15px] lg:mt-0">
          {[
            { icon: ShoppingCart, t: "קופה מהירה עם הנחות ואמצעי תשלום" },
            { icon: ScanBarcode, t: "סריקת ברקוד במצלמת הטלפון" },
            { icon: Boxes, t: "התראות מלאי נמוך וקליטת סחורה" },
            { icon: BarChart3, t: "רווח, מוצרים מובילים ותחזית מלאי" },
          ].map((f) => (
            <li key={f.t} className="flex items-start gap-2.5">
              <f.icon className="mt-0.5 size-5 shrink-0 text-tag" aria-hidden />
              <span className="opacity-95">{f.t}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Form */}
      <section className="flex items-start justify-center px-4 py-8 lg:items-center lg:py-12">
        <Panel className="w-full max-w-[420px] p-6 sm:p-8">
          {mode === "forgot" ? (
            <ForgotForm onBack={() => setMode("login")} />
          ) : (
            <>
              <Segmented
                label="כניסה או הרשמה"
                className="mb-6 w-full"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "login", label: "כניסה" },
                  { value: "register", label: "חשבון חדש" },
                ]}
              />
              {mode === "login" ? <LoginForm onForgot={() => setMode("forgot")} /> : <RegisterForm onDone={() => setMode("login")} />}
            </>
          )}
        </Panel>
      </section>
    </div>
  );
}

function LoginForm({ onForgot }: { onForgot: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr(errorText(error));
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <Input label="אימייל" type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input label="סיסמה" type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      {err && <p className="text-sm text-warn" role="alert">{err}</p>}
      <Button type="submit" size="lg" loading={busy} disabled={!email || !password}>
        כניסה
      </Button>
      <button type="button" onClick={onForgot} className="justify-self-center text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
        שכחתי סיסמה
      </button>
    </form>
  );
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const [biz, setBiz] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) return setErr("הסיסמה צריכה להכיל לפחות 6 תווים");
    setBusy(true);
    setErr("");
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { business_name: biz.trim() }, emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) return setErr(errorText(error));
    // With email confirmation on, there is no session yet
    if (!data.session) setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center">
        <p className="text-lg font-bold">כמעט סיימנו</p>
        <p className="mt-2 text-muted">
          שלחנו קישור אישור ל־<span dir="ltr" className="font-medium text-ink">{email}</span>. לחצו עליו כדי להפעיל את החשבון, ואז התחברו.
        </p>
        <Button variant="secondary" className="mt-5 w-full" onClick={onDone}>
          למסך הכניסה
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <Input label="שם העסק" autoComplete="organization" required value={biz} onChange={(e) => setBiz(e.target.value)} />
      <Input label="אימייל" type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input
        label="סיסמה"
        hint="לפחות 6 תווים"
        type="password"
        dir="ltr"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {err && <p className="text-sm text-warn" role="alert">{err}</p>}
      <Button type="submit" size="lg" loading={busy} disabled={!biz || !email || !password}>
        פתיחת חשבון
      </Button>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setBusy(false);
    if (error) setErr(errorText(error));
    else setSent(true);
  }

  return (
    <div>
      <h2 className="text-xl font-bold">איפוס סיסמה</h2>
      {sent ? (
        <p className="mt-3 text-muted">אם קיים חשבון עם הכתובת הזו, שלחנו אליה קישור לבחירת סיסמה חדשה.</p>
      ) : (
        <form onSubmit={submit} className="mt-4 grid gap-4" noValidate>
          <p className="text-sm text-muted">נשלח קישור לבחירת סיסמה חדשה.</p>
          <Input label="אימייל" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {err && <p className="text-sm text-warn" role="alert">{err}</p>}
          <Button type="submit" size="lg" loading={busy} disabled={!email}>
            שליחת קישור
          </Button>
        </form>
      )}
      <button type="button" onClick={onBack} className="mt-4 text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
        חזרה לכניסה
      </button>
    </div>
  );
}

/** Shown after opening a password-reset link. */
export function NewPasswordPage() {
  const { setRecovering } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) return setErr("הסיסמה צריכה להכיל לפחות 6 תווים");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setErr(errorText(error));
    else setRecovering(false);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Panel className="w-full max-w-[420px] p-6 sm:p-8">
        <h1 className="text-xl font-bold">בחירת סיסמה חדשה</h1>
        <form onSubmit={submit} className="mt-4 grid gap-4">
          <Input label="סיסמה חדשה" type="password" dir="ltr" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {err && <p className="text-sm text-warn" role="alert">{err}</p>}
          <Button type="submit" size="lg" loading={busy} disabled={!password}>
            שמירת הסיסמה
          </Button>
        </form>
      </Panel>
    </div>
  );
}
