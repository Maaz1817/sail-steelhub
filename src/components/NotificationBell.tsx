import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { getNotificationSummary } from "@/lib/notifications.functions";

/** Compact, Instagram-style unread indicator for the Home page header. */
export function NotificationBell() {
  const summaryFn = useServerFn(getNotificationSummary);
  const { data } = useQuery({
    queryKey: ["notification-summary"],
    queryFn: () => summaryFn(),
    refetchInterval: 60_000,
  });
  const unread = data?.unread ?? 0;

  return (
    <Link
      to="/notifications"
      aria-label={unread ? `${unread} unread notifications` : "Open notifications"}
      className="relative flex size-11 items-center justify-center rounded-full bg-primary-foreground/15 text-primary-foreground transition-colors hover:bg-primary-foreground/25"
    >
      <Bell aria-hidden className={`size-5 ${unread > 0 ? "bell-with-unread" : ""}`} />
      {unread > 0 ? (
        <span className="notification-badge absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-extrabold leading-5 text-destructive-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
