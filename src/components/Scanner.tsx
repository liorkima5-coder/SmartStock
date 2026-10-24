import { useEffect, useId, useRef, useState } from "react";
import { Modal, Spinner } from "./ui";

/**
 * Camera barcode scanner. html5-qrcode is loaded only when the scanner opens.
 * USB/Bluetooth scanners don't need this: they type into the search box and press Enter.
 */
export function ScannerModal({ open, onClose, onResult }: { open: boolean; onClose: () => void; onResult: (code: string) => void }) {
  const id = "scanner-" + useId().replace(/:/g, "");
  const [err, setErr] = useState("");
  const [starting, setStarting] = useState(true);
  const done = useRef(false);

  useEffect(() => {
    if (!open) return;
    done.current = false;
    setErr("");
    setStarting(true);
    let scanner: { stop: () => Promise<void>; clear: () => void; isScanning?: boolean } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import("html5-qrcode");
        if (cancelled) return;
        const s = new Html5Qrcode(id, {
          verbose: false,
          formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.QR_CODE, F.ITF],
        });
        scanner = s;
        await s.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: (w: number, h: number) => ({ width: Math.min(300, w * 0.85), height: Math.min(160, h * 0.5) }) },
          (text: string) => {
            if (done.current) return;
            done.current = true;
            navigator.vibrate?.(60);
            onResult(text.trim());
          },
          () => {},
        );
        if (!cancelled) setStarting(false);
      } catch (e) {
        if (cancelled) return;
        setStarting(false);
        const msg = String((e as Error)?.message ?? e);
        setErr(
          /permission|notallowed/i.test(msg)
            ? "אין הרשאה למצלמה. אשרו גישה למצלמה בהגדרות הדפדפן ונסו שוב."
            : /notfound|no camera|requested device not found/i.test(msg)
              ? "לא נמצאה מצלמה במכשיר הזה. אפשר להקליד את הברקוד בשדה החיפוש."
              : "לא הצלחנו להפעיל את המצלמה. ודאו שהאתר נפתח ב־https ונסו שוב.",
        );
      }
    })();

    return () => {
      cancelled = true;
      if (scanner) {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scanner?.clear();
            } catch {
              /* already cleared */
            }
          });
      }
    };
  }, [open, id, onResult]);

  return (
    <Modal open={open} onClose={onClose} title="סריקת ברקוד">
      <div className="relative overflow-hidden rounded-[12px] bg-black" style={{ minHeight: 240 }}>
        <div id={id} className="w-full [&_video]:w-full [&_video]:object-cover" />
        {starting && !err && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-white/80">
            <Spinner className="text-white/80" /> מפעיל מצלמה…
          </div>
        )}
      </div>
      {err ? (
        <p className="mt-3 text-sm text-warn" role="alert">
          {err}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted">כוונו את הברקוד למסגרת. הסריקה מתבצעת אוטומטית.</p>
      )}
    </Modal>
  );
}
