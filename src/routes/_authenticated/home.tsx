import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Cake,
  Award,
  BookOpen,
  Bot,
  CalendarDays,
  FileText,
  FileSpreadsheet,
  Quote,
  ArrowRight,
  Megaphone,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { getHomeFeed } from "@/lib/home.functions";
import { getDailyQuote } from "@/lib/daily-quote";
import { InstallPrompt } from "@/components/InstallPrompt";
import { getEvents } from "@/lib/events.functions";
import { NotificationBell } from "@/components/NotificationBell";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — SAIL Salem Steel Plant Knowledge Hub" },
      {
        name: "description",
        content:
          "Your personal SAIL Salem Steel Plant dashboard: profile, daily quote, celebrations and quick actions.",
      },
      { property: "og:title", content: "Home — SAIL Salem Steel Plant Knowledge Hub" },
      {
        property: "og:description",
        content: "Employee dashboard for the SAIL Salem Steel Plant Knowledge Hub.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

const QUICK_ACTIONS = [
  { to: "/knowledge", icon: BookOpen, key: "nav.knowledge", tone: "quick-learning", search: {} },
  { to: "/ai", icon: Bot, key: "nav.ai", tone: "quick-ai", search: {} },
  { to: "/circulars", icon: FileText, key: "nav.circulars", tone: "quick-circulars", search: {} },
  { to: "/forms", icon: FileSpreadsheet, key: "nav.forms", tone: "quick-forms", search: {} },
  { to: "/events", icon: CalendarDays, key: "nav.events", tone: "quick-activities", search: { event: undefined } },
] as const;

function HomePage() {
  const { t, lang } = useI18n();
  const fetchFeed = useServerFn(getHomeFeed);
  const fetchEvents = useServerFn(getEvents);

  const { data, isPending } = useQuery({
    queryKey: ["home-feed"],
    queryFn: () => fetchFeed(),
  });
  const { data: eventData } = useQuery({
    queryKey: ["events"],
    queryFn: () => fetchEvents(),
  });

  const quote = getDailyQuote();
  const profile = data?.profile;
  const featuredEvents = (eventData?.events ?? []).filter((event) => event.home_image_url);
  const carouselActivities =
    featuredEvents.length > 1
      ? [...featuredEvents, ...featuredEvents, ...featuredEvents]
      : featuredEvents;
  const eventCarouselRef = useRef<HTMLDivElement>(null);
  const [eventCarouselPaused, setEventCarouselPaused] = useState(false);

  useEffect(() => {
    if (featuredEvents.length < 2 || eventCarouselPaused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const carousel = eventCarouselRef.current;
    if (!carousel) return;

    const cards = Array.from(carousel.querySelectorAll<HTMLElement>("[data-event-highlight]"));
    const firstRepeatedCard = cards[featuredEvents.length];
    const firstCard = cards[0];
    if (!firstRepeatedCard || !firstCard) return;

    // Keep the movement continuous instead of jumping one card at a time.
    // Repeated copies let the scroll position reset without a visible break.
    const loopWidth = firstRepeatedCard.offsetLeft - firstCard.offsetLeft;
    if (loopWidth <= 0) return;
    carousel.scrollLeft = 0;
    let lastTimestamp: number | undefined;
    let animationFrame = 0;
    const move = (timestamp: number) => {
      if (lastTimestamp !== undefined) {
        const elapsed = Math.min(timestamp - lastTimestamp, 50);
        carousel.scrollLeft += elapsed * 0.026;
        if (carousel.scrollLeft >= loopWidth) carousel.scrollLeft -= loopWidth;
      }
      lastTimestamp = timestamp;
      animationFrame = window.requestAnimationFrame(move);
    };
    animationFrame = window.requestAnimationFrame(move);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [eventCarouselPaused, featuredEvents.length]);

  return (
    <AppShell title={t("app.shortName")} headerAction={<NotificationBell />}>
      {isPending ? (
        <p className="flex items-center gap-2 text-lg text-muted-foreground">
          <Loader2 aria-hidden className="size-5 animate-spin" />
          {t("common.loading")}
        </p>
      ) : (
        <>
          <section className="home-welcome card-elevated p-6">
            <p className="text-base text-muted-foreground">{t("home.welcome")}</p>
            <h1 className="mt-1 text-2xl font-bold">{profile?.full_name ?? "—"}</h1>
            <p className="mt-1 text-base text-muted-foreground">
              {[profile?.designation, profile?.department].filter(Boolean).join(" · ") || "—"}
            </p>
            <p className="mt-3 text-sm font-semibold tracking-wide">
              {t("home.employeeNumber")}: {profile?.employee_number ?? "—"}
            </p>
          </section>

          {featuredEvents.length > 0 && (
            <section className="gallery-section mt-5" aria-labelledby="event-highlights-title">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 id="event-highlights-title" className="text-xl font-bold">
                    {t("home.eventHighlights")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t("home.eventHighlightsSubtitle")}</p>
                </div>
                <Link
                  to="/events"
                  search={{ event: undefined }}
                  className="flex min-h-12 shrink-0 items-center gap-1 font-bold text-primary"
                >
                  {t("home.viewAll")}
                  <ArrowRight aria-hidden className="size-5" />
                </Link>
              </div>

              <div
                ref={eventCarouselRef}
                role="region"
                aria-label="Activities gallery"
                onPointerDown={() => setEventCarouselPaused(true)}
                onKeyDown={() => setEventCarouselPaused(true)}
                className="mt-4 flex gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {carouselActivities.map((event, index) => (
                  <Link
                    key={`${event.id}-${index}`}
                    to="/events"
                    search={{ event: event.id }}
                    className="gallery-card group shrink-0 overflow-hidden rounded-lg border bg-card"
                    aria-label={`${t("events.viewGallery")}: ${event.title}`}
                    data-event-highlight
                    style={{ width: "112px", flex: "0 0 112px" }}
                  >
                    <div className="overflow-hidden bg-muted" style={{ height: "76px" }}>
                      <img
                        src={event.home_image_url ?? ""}
                        alt={event.title}
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        style={{
                          objectPosition: `${event.home_cover_position_x ?? 50}% ${
                            event.home_cover_position_y ?? 50
                          }%`,
                          transform: `scale(${event.home_cover_scale ?? 1})`,
                          transformOrigin: `${event.home_cover_position_x ?? 50}% ${
                            event.home_cover_position_y ?? 50
                          }%`,
                        }}
                      />
                    </div>
                    <div className="min-h-12 px-1.5 py-1.5">
                      <p className="text-[11px] font-bold leading-tight line-clamp-2">{event.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data?.latestAnnouncement ? (
            <section className="announcement-card card-elevated mt-5 overflow-hidden" aria-labelledby="latest-announcement-title">
              {data.latestAnnouncement.image_url ? (
                <img
                  src={data.latestAnnouncement.image_url}
                  alt="Announcement"
                  loading="lazy"
                  className="max-h-72 w-full bg-muted object-contain"
                />
              ) : null}
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="latest-announcement-title" className="flex items-center gap-2 text-lg font-bold">
                    <Megaphone aria-hidden className="size-5 text-primary" />
                    {t("home.latestAnnouncement")}
                  </h2>
                  <Link to="/notifications" className="text-sm font-bold text-primary">
                    {t("home.viewAll")}
                  </Link>
                </div>
                <h3 className="mt-3 text-xl font-bold leading-snug">{data.latestAnnouncement.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-muted-foreground line-clamp-3">
                  {data.latestAnnouncement.body}
                </p>
                <Link
                  to="/notifications"
                  className="mt-4 flex min-h-11 items-center gap-1 font-bold text-primary"
                >
                  {t("home.readAnnouncement")}
                  <ArrowRight aria-hidden className="size-5" />
                </Link>
              </div>
            </section>
          ) : null}

          <section className="mt-5">
            <h2 className="text-lg font-bold">{t("home.quickActions")}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {QUICK_ACTIONS.map(({ to, icon: Icon, key, tone, search }) => (
                <Link
                  key={to}
                  to={to}
                  search={search}
                  className={`quick-action ${tone} flex flex-col items-center justify-center gap-2 p-4 text-center text-base font-bold`}
                >
                  <Icon aria-hidden className="size-7" />
                  {t(key)}
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-5">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Cake aria-hidden className="size-5 text-accent" />
              {t("home.birthdays")}
            </h2>
            {data && data.birthdays.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {data.birthdays.map((b) => (
                  <li key={b.id} className="celebration-card birthday-card card-elevated p-4">
                    <p className="text-lg font-bold">{b.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {[b.designation, b.department].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-base text-muted-foreground">{t("home.noBirthdays")}</p>
            )}
          </section>

          <section className="mt-5">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Award aria-hidden className="size-5 text-accent" />
              {t("home.anniversaries")}
            </h2>
            {data && data.anniversaries.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {data.anniversaries.map((a) => (
                  <li key={a.id} className="celebration-card anniversary-card card-elevated p-4">
                    <p className="text-lg font-bold">{a.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.years} {t("home.years")} ·{" "}
                      {[a.designation, a.department].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-base text-muted-foreground">{t("home.noAnniversaries")}</p>
            )}
          </section>

          <section className="quote-card card-elevated mt-5 rounded-2xl p-6">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
              <Quote aria-hidden className="size-4" />
              {t("home.quoteOfDay")}
            </div>
            <blockquote className="mt-3 text-xl font-semibold leading-snug">
              {quote.text[lang]}
            </blockquote>
            <p className="mt-3 text-sm text-muted-foreground">— {quote.author}</p>
          </section>

          <InstallPrompt />
        </>
      )}
    </AppShell>
  );
}
