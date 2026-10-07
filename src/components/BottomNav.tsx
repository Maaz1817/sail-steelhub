import { Link } from "@tanstack/react-router";
import { Home, BookOpen, CalendarDays, FileSpreadsheet, FileText, User } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const ITEMS = [
  { to: "/home", icon: Home, key: "nav.home" },
  { to: "/knowledge", icon: BookOpen, key: "nav.knowledge" },
  { to: "/events", icon: CalendarDays, key: "nav.events" },
  { to: "/circulars", icon: FileText, key: "nav.circulars" },
  { to: "/forms", icon: FileSpreadsheet, key: "nav.forms" },
  { to: "/profile", icon: User, key: "nav.profile" },
] as const;

export function BottomNav() {
  const { t } = useI18n();

  return (
    <nav
      aria-label={t("nav.label")}
      className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-md grid-cols-6">
        {ITEMS.map(({ to, icon: Icon, key }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold leading-tight text-muted-foreground"
              activeProps={{ className: "text-primary" }}
            >
              <Icon aria-hidden className="size-6" />
              <span className="text-center">{t(key)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
