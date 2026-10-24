import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Loader2, Search, X } from "lucide-react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ---------------------------------------------------------------- Button

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "tag";
type BtnSize = "sm" | "md" | "lg";

const btnBase =
  "inline-flex items-center justify-center gap-2 font-semibold select-none transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-hover active:brightness-95",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2",
  danger: "bg-warn text-white hover:brightness-110",
  tag: "bg-tag text-tag-ink hover:brightness-95",
};
const btnSizes: Record<BtnSize, string> = {
  sm: "h-9 px-3 text-sm rounded-[9px]",
  md: "h-11 px-4 text-[15px] rounded-[10px]",
  lg: "h-13 px-5 text-base rounded-[12px]",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize; loading?: boolean; icon?: ReactNode }
>(function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx(btnBase, btnVariants[variant], btnSizes[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex size-10 items-center justify-center rounded-[10px] text-muted hover:bg-surface-2 hover:text-ink transition-colors",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Form fields

const fieldBase =
  "w-full rounded-[10px] border border-line bg-surface px-3 h-11 text-ink placeholder:text-muted/70 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-warn">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string }>(
  function Input({ label, hint, error, className, id, ...rest }, ref) {
    const auto = useId();
    const el = <input ref={ref} id={id ?? auto} className={cx(fieldBase, error && "border-warn", className)} {...rest} />;
    return label ? (
      <Field label={label} hint={hint} error={error} htmlFor={id ?? auto}>
        {el}
      </Field>
    ) : (
      el
    );
  },
);

export function Select({
  label,
  hint,
  className,
  id,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: string }) {
  const auto = useId();
  const el = (
    <select id={id ?? auto} className={cx(fieldBase, "pe-3 ps-8 appearance-none bg-no-repeat", className)} style={selectArrow} {...rest}>
      {children}
    </select>
  );
  return label ? (
    <Field label={label} hint={hint} htmlFor={id ?? auto}>
      {el}
    </Field>
  ) : (
    el
  );
}

const selectArrow = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%235e6b74' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundPosition: "left 10px center",
};

export function Textarea({ label, className, id, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const auto = useId();
  const el = <textarea id={id ?? auto} className={cx(fieldBase, "h-auto min-h-20 py-2.5", className)} {...rest} />;
  return label ? (
    <Field label={label} htmlFor={id ?? auto}>
      {el}
    </Field>
  ) : (
    el
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
  trailing,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
  autoFocus?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div className={cx("relative flex items-center", className)}>
      <Search className="pointer-events-none absolute start-3 size-[18px] text-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        className={cx(fieldBase, "ps-10", trailing ? "pe-12" : value ? "pe-10" : "")}
      />
      {value && !trailing && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="נקה חיפוש"
          className="absolute end-2 inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2"
        >
          <X className="size-4" />
        </button>
      )}
      {trailing && <div className="absolute end-1">{trailing}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Surfaces

export function Panel({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-[14px] bg-surface border border-line/70 shadow-panel", className)} {...rest}>
      {children}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 lg:mb-6">
      <div className="min-w-0">
        <h1 className="figure text-[44px] text-ink lg:text-[52px]">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "ok" | "warn" | "brand" | "tag"; children: ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 text-muted border border-line",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    brand: "bg-brand-soft text-brand",
    tag: "bg-tag text-tag-ink",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("size-5 animate-spin text-muted", className)} aria-label="טוען" />;
}

export function Loading({ label = "טוען…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted" role="status">
      <Spinner /> <span>{label}</span>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-muted [&>svg]:size-10">{icon}</div>}
      <p className="text-base font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn" role="alert">
      <span>{error}</span>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          נסו שוב
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Modal / bottom sheet

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // focus the first field (or the dialog) for keyboard users
    requestAnimationFrame(() => {
      const first = ref.current?.querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]), select, textarea");
      (first ?? ref.current)?.focus({ preventScroll: true });
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      <div className="anim-fade absolute inset-0 bg-[#0b1116]/55" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cx(
          "anim-sheet sm:anim-pop relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[20px] bg-surface shadow-2xl outline-none sm:rounded-[16px]",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
          className,
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        {title && (
          <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-3 sm:pt-4">
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>
            <IconButton label="סגירה" onClick={onClose} className="-me-2">
              <X className="size-5" />
            </IconButton>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="safe-bottom border-t border-line bg-surface px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({
  open,
  title,
  text,
  confirmLabel,
  danger,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  text?: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          <Button variant={danger ? "danger" : "primary"} className="flex-1" loading={loading} onClick={onConfirm} data-autofocus>
            {confirmLabel}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            ביטול
          </Button>
        </div>
      }
    >
      {text && <p className="text-muted">{text}</p>}
    </Modal>
  );
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx("inline-flex rounded-[10px] border border-line bg-surface-2 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-9 flex-1 whitespace-nowrap rounded-[8px] px-3 text-sm font-medium transition-colors",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Numeric stepper for quantities: big touch targets on mobile. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  const clamp = (v: number) => Math.max(min, max != null ? Math.min(max, v) : v);
  return (
    <div className="inline-flex items-center rounded-[10px] border border-line bg-surface" role="group" aria-label={label}>
      <button type="button" className="size-9 text-lg text-muted hover:text-ink disabled:opacity-40" onClick={() => onChange(clamp(value + 1))} disabled={max != null && value >= max} aria-label="הוספה">
        +
      </button>
      <span className="num min-w-7 text-center font-semibold">{value}</span>
      <button type="button" className="size-9 text-lg text-muted hover:text-ink disabled:opacity-40" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="הפחתה">
        −
      </button>
    </div>
  );
}
