import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ImageUp } from "lucide-react";
import { uploadLogo, useProfile, useSaveProfile } from "../lib/api";
import { useAuth } from "../lib/auth";
import { errorText } from "../lib/format";
import { supabase } from "../lib/supabase";
import { applyTheme, getTheme, type Theme } from "../lib/theme";
import { Button, Input, Loading, PageHeader, Panel, Segmented } from "../components/ui";
import { Logo } from "../components/Logo";

export function SettingsPage() {
  const { data: profile, isLoading } = useProfile();
  const { user } = useAuth();
  const save = useSaveProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [theme, setTheme] = useState<Theme>(getTheme());
  const [f, setF] = useState({ business_name: "", tax_id: "", contact_name: "", phone: "", email: "", address: "" });

  useEffect(() => {
    if (profile)
      setF({
        business_name: profile.business_name ?? "",
        tax_id: profile.tax_id ?? "",
        contact_name: profile.contact_name ?? "",
        phone: profile.phone ?? "",
        email: profile.email ?? "",
        address: profile.address ?? "",
      });
  }, [profile]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null])));
      toast.success("פרטי העסק נשמרו");
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function onLogo(file: File | undefined) {
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("הקובץ גדול מדי. עד 2MB");
    setUploading(true);
    try {
      const url = await uploadLogo(user.id, file);
      await save.mutateAsync({ logo_url: url });
      toast.success("הלוגו עודכן");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (isLoading) return <Loading />;
  const logo = profile?.logo_url && /^(https?:|data:image)/.test(profile.logo_url) ? profile.logo_url : null;

  return (
    <>
      <PageHeader title="הגדרות" sub="הפרטים האלה מופיעים על הקבלות" />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
        <Panel className="p-5 sm:p-6">
          <h2 className="mb-4 font-bold">פרטי העסק</h2>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Input label="שם העסק" value={f.business_name} onChange={set("business_name")} />
            <Input label="ח״פ / עוסק מורשה" dir="ltr" inputMode="numeric" value={f.tax_id} onChange={set("tax_id")} />
            <Input label="איש קשר" value={f.contact_name} onChange={set("contact_name")} />
            <Input label="טלפון" type="tel" dir="ltr" value={f.phone} onChange={set("phone")} />
            <Input label="אימייל לקבלות" type="email" dir="ltr" value={f.email} onChange={set("email")} />
            <Input label="כתובת" value={f.address} onChange={set("address")} />
            <div className="sm:col-span-2">
              <Button type="submit" loading={save.isPending && !uploading}>
                שמירת הפרטים
              </Button>
            </div>
          </form>
        </Panel>

        <div className="grid gap-4">
          <Panel className="p-5 sm:p-6">
            <h2 className="mb-4 font-bold">לוגו</h2>
            <div className="flex items-center gap-4">
              {logo ? (
                <img src={logo} alt="הלוגו של העסק" className="size-20 rounded-[12px] border border-line bg-white object-contain p-1" />
              ) : (
                <Logo className="size-20" />
              )}
              <div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" id="logo-file" onChange={(e) => onLogo(e.target.files?.[0])} />
                <Button variant="secondary" icon={<ImageUp className="size-4" />} loading={uploading} onClick={() => fileRef.current?.click()}>
                  {logo ? "החלפת לוגו" : "העלאת לוגו"}
                </Button>
                <p className="mt-2 text-xs text-muted">PNG או JPG מרובע, עד 2MB</p>
              </div>
            </div>
          </Panel>

          <Panel className="p-5 sm:p-6">
            <h2 className="mb-3 font-bold">תצוגה</h2>
            <Segmented
              label="ערכת צבעים"
              className="w-full"
              value={theme}
              onChange={(t) => {
                setTheme(t);
                applyTheme(t);
              }}
              options={[
                { value: "light", label: "בהיר" },
                { value: "dark", label: "כהה" },
                { value: "system", label: "לפי המכשיר" },
              ]}
            />
          </Panel>

          <Panel className="p-5 sm:p-6">
            <h2 className="mb-1 font-bold">חשבון</h2>
            <p className="mb-4 truncate text-sm text-muted" dir="ltr">
              {user?.email}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  const { error } = await supabase.auth.resetPasswordForEmail(user!.email!, { redirectTo: window.location.origin });
                  if (error) toast.error(errorText(error));
                  else toast.success("שלחנו קישור לשינוי סיסמה לאימייל שלך");
                }}
              >
                שינוי סיסמה
              </Button>
              <Button variant="ghost" onClick={() => supabase.auth.signOut()}>
                יציאה
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
