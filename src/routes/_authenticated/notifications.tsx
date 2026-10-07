import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Cake, Check, Loader2, Megaphone, PartyPopper, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  sendCelebrationWish,
} from "@/lib/notifications.functions";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — SAIL Salem Steel Plant Knowledge Hub" },
      {
        name: "description",
        content: "Employee announcements, birthdays, work anniversaries and colleague wishes.",
      },
    ],
  }),
  component: NotificationsPage,
});

function NotificationIcon({ kind }: { kind: "birthday" | "anniversary" | "announcement" }) {
  if (kind === "birthday") return <Cake aria-hidden className="size-6 text-accent" />;
  if (kind === "anniversary") return <PartyPopper aria-hidden className="size-6 text-primary" />;
  return <Megaphone aria-hidden className="size-6 text-primary" />;
}

function NotificationsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(getNotifications);
  const markReadFn = useServerFn(markNotificationRead);
  const markAllFn = useServerFn(markAllNotificationsRead);
  const sendWishFn = useServerFn(sendCelebrationWish);
  const [wishText, setWishText] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const { data, isPending, error } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn(),
  });

  const markRead = useMutation({
    mutationFn: (notificationId: string) => markReadFn({ data: { notificationId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notification-summary"] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => {
      setMessage("All notifications are marked as read.");
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notification-summary"] });
    },
    onError: (mutationError: Error) => setMessage(mutationError.message),
  });

  const sendWish = useMutation({
    mutationFn: ({ notificationId, text }: { notificationId: string; text: string }) =>
      sendWishFn({ data: { notificationId, message: text } }),
    onSuccess: (_result, variables) => {
      setWishText((current) => ({ ...current, [variables.notificationId]: "" }));
      setMessage("Your wish has been sent.");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (mutationError: Error) => setMessage(mutationError.message),
  });

  return (
    <AppShell title="Notifications">
      <section className="notification-summary card-elevated flex items-center gap-3 p-4">
        <div className="rounded-full bg-primary/10 p-3">
          <Bell aria-hidden className="size-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">Your updates</h1>
          <p className="text-sm text-muted-foreground">
            {data?.unread ? `${data.unread} unread update${data.unread === 1 ? "" : "s"}` : "You are all caught up."}
          </p>
        </div>
        {data?.unread ? (
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="min-h-11 rounded-xl border-2 border-primary px-3 text-sm font-bold text-primary"
          >
            Mark all read
          </button>
        ) : null}
      </section>

      {message ? <p className="mt-3 text-base font-semibold text-accent">{message}</p> : null}
      {error ? <p className="mt-4 text-lg text-destructive">Unable to load notifications. Please refresh and try again.</p> : null}
      {isPending ? (
        <p className="mt-5 flex items-center gap-2 text-lg text-muted-foreground">
          <Loader2 aria-hidden className="size-5 animate-spin" /> Loading updates…
        </p>
      ) : null}
      {!isPending && !error && (data?.notifications ?? []).length === 0 ? (
        <section className="card-elevated mt-5 p-6 text-center">
          <Bell aria-hidden className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 text-xl font-bold">No notifications yet</h2>
          <p className="mt-2 text-base text-muted-foreground">
            Published announcements and today's celebrations will appear here.
          </p>
        </section>
      ) : null}

      <ul className="mt-5 space-y-4">
        {(data?.notifications ?? []).map((notification) => {
          const celebration = notification.kind === "birthday" || notification.kind === "anniversary";
          const text = wishText[notification.id] ?? "";
          return (
            <li
              key={notification.id}
              className={`notification-card ${
                notification.kind === "birthday"
                  ? "celebration-notification notification-birthday"
                  : notification.kind === "anniversary"
                    ? "celebration-notification notification-anniversary"
                    : "notification-announcement"
              } card-elevated overflow-hidden ${notification.is_read ? "" : "notification-unread"}`}
            >
              {notification.image_url ? (
                <img
                  src={notification.image_url}
                  alt="Announcement"
                  className="max-h-[70vh] w-full bg-muted object-contain"
                  loading="lazy"
                />
              ) : null}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-muted p-2.5">
                    <NotificationIcon kind={notification.kind} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-lg font-bold leading-snug">{notification.title}</h2>
                      {!notification.is_read ? <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" /> : null}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-muted-foreground">
                      {notification.body}
                    </p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {new Date(notification.created_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                {!notification.is_read ? (
                  <button
                    type="button"
                    onClick={() => markRead.mutate(notification.id)}
                    disabled={markRead.isPending}
                    className="mt-4 flex min-h-11 items-center gap-2 text-sm font-bold text-primary"
                  >
                    <Check aria-hidden className="size-4" /> Mark as read
                  </button>
                ) : null}

                {celebration ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <h3 className="text-base font-bold">Colleague wishes</h3>
                    {notification.wishes.length ? (
                      <ul className="mt-3 space-y-2">
                        {notification.wishes.map((wish) => (
                          <li key={wish.id} className="wish-entry rounded-xl px-3 py-2">
                            <p className="text-sm font-bold">{wish.sender_name}</p>
                            <p className="mt-0.5 text-sm text-muted-foreground">{wish.message}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Be the first colleague to send wishes.</p>
                    )}
                    <form
                      className="mt-3 flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (text.trim()) sendWish.mutate({ notificationId: notification.id, text });
                      }}
                    >
                      <input
                        value={text}
                        maxLength={280}
                        onChange={(event) =>
                          setWishText((current) => ({ ...current, [notification.id]: event.target.value }))
                        }
                        placeholder="Write your wishes…"
                        className="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={sendWish.isPending || !text.trim()}
                        aria-label="Send wishes"
                        className="wish-send-button flex size-11 shrink-0 items-center justify-center rounded-xl text-primary-foreground disabled:opacity-50"
                      >
                        <Send aria-hidden className="size-4" />
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
