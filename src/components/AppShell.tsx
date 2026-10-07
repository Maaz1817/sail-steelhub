import type { ReactNode } from "react";
import { SailLogo } from "@/components/SailLogo";
import { BottomNav } from "@/components/BottomNav";
import { useI18n } from "@/lib/i18n";

export function AppShell({
  title,
  children,
  headerAction,
}: {
  title: string;
  children: ReactNode;
  headerAction?: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="app-header surface-steel flex items-center gap-3 px-5 py-4">
        <div className="rounded-full bg-primary-foreground/95 p-2">
          <SailLogo size={36} priority />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{title}</p>
          <p className="truncate text-sm text-primary-foreground/85">{t("app.org")}</p>
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </header>
      <main className="mx-auto w-full max-w-md px-4 py-5">{children}</main>
      <BottomNav />
    </div>
  );
}

export function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <section className="card-elevated p-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-3 text-lg text-muted-foreground">{note}</p>
    </section>
  );
}
