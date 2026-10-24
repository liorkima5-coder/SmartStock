import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { registerSW } from "virtual:pwa-register";
import { AuthProvider } from "./lib/auth";
import { applyTheme, getTheme } from "./lib/theme";
import { App } from "./App";
import "./styles.css";

applyTheme(getTheme());
registerSW({ immediate: true });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (failures, err) => {
        const msg = String((err as { message?: string })?.message ?? "");
        // Permission and auth errors won't fix themselves on retry
        if (/jwt|permission|not authenticated|42501/i.test(msg)) return false;
        return failures < 2;
      },
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
        <Toaster position="top-center" dir="rtl" richColors closeButton toastOptions={{ style: { fontFamily: "var(--font-sans)" } }} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
