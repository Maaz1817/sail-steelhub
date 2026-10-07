import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SailLogo } from "@/components/SailLogo";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SAIL Salem Steel Plant — Employee Knowledge Management" },
      {
        name: "description",
        content:
          "Arivu is the official employee knowledge app for SAIL Salem Steel Plant: daily learning, quizzes, circulars, activities and announcements.",
      },
      { property: "og:title", content: "Arivu — SAIL Salem Steel Plant" },
      {
        property: "og:description",
        content:
          "Daily learning, safety knowledge, circulars and activities for Salem Steel Plant employees.",
      },
    ],
  }),
  component: SplashScreen,
});

function SplashScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void navigate({ to: "/login" });
    }, 1900);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <main className="surface-steel flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="animate-rise flex flex-col items-center">
        <div className="rounded-full bg-primary-foreground/95 p-5 shadow-[var(--shadow-lift)]">
          <SailLogo size={104} priority />
        </div>
        <h1 className="mt-8 text-3xl font-bold tracking-wide">{t("app.org")}</h1>
        <p className="mt-3 max-w-sm text-lg text-primary-foreground/85">{t("app.name")}</p>
        <p className="mt-6 text-base font-medium text-accent">{t("splash.tagline")}</p>
      </div>

      <div
        className="mt-12 h-1.5 w-40 overflow-hidden rounded-full bg-primary-foreground/20"
        role="status"
        aria-label={t("common.loading")}
      >
        <div className="surface-molten h-full w-1/3 animate-[rise-in_0.4s_ease-out,pulse_1.2s_ease-in-out_infinite]" />
      </div>
    </main>
  );
}
