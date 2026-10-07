import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "ssp-install-dismissed";

export function InstallPrompt() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => {});
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      setDeferred(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!deferred) return null;

  return (
    <section className="card-elevated mt-5 flex items-start gap-3 p-5">
      <Download aria-hidden className="mt-1 size-6 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-bold">{t("install.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("install.body")}</p>
        <button
          type="button"
          onClick={async () => {
            await deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
          }}
          className="mt-3 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-base font-bold text-primary-foreground"
        >
          {t("install.button")}
        </button>
      </div>
      <button
        type="button"
        aria-label={t("install.later")}
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setDeferred(null);
        }}
        className="rounded-lg p-2 text-muted-foreground"
      >
        <X aria-hidden className="size-5" />
      </button>
    </section>
  );
}
