import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CalendarDays, Images, Loader2, MapPin, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { getEvent, getEvents } from "@/lib/events.functions";

export const Route = createFileRoute("/_authenticated/events")({
  validateSearch: (search: Record<string, unknown>) => ({
    event: typeof search["event"] === "string" ? search["event"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Activities — SAIL Salem Steel Plant Knowledge Hub" },
      {
        name: "description",
        content: "L&D and other plant activities with photo galleries for Salem Steel Plant staff.",
      },
      { property: "og:title", content: "Activities — SAIL Salem Steel Plant Knowledge Hub" },
      {
        property: "og:description",
        content: "L&D and other plant activities with photo galleries for Salem Steel Plant staff.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EventsPage,
});

function formatDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "long", year: "numeric" });
}

function EventsPage() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/events" });
  const [openId, setOpenId] = useState<string | null>(search.event ?? null);

  const openEvent = (eventId: string) => {
    setOpenId(eventId);
    void navigate({ search: { event: eventId }, replace: true });
  };

  const closeEvent = () => {
    setOpenId(null);
    void navigate({ search: { event: undefined }, replace: true });
  };

  if (openId) {
    return <EventDetail eventId={openId} onBack={closeEvent} />;
  }

  return (
    <AppShell title={t("nav.events")}>
      <EventList onOpen={openEvent} />
    </AppShell>
  );
}

function EventList({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useI18n();
  const fetchEvents = useServerFn(getEvents);
  const { data, isPending } = useQuery({ queryKey: ["events"], queryFn: () => fetchEvents() });

  const events = data?.events ?? [];
  const ldActivities = events.filter((event) => event.activity_type === "ld");
  const otherActivities = events.filter((event) => event.activity_type === "other");

  if (isPending) {
    return (
      <p className="flex items-center gap-2 text-lg text-muted-foreground">
        <Loader2 aria-hidden className="size-5 animate-spin" />
        {t("common.loading")}
      </p>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold">{t("events.title")}</h1>
      <p className="mt-1 text-base text-muted-foreground">{t("events.subtitle")}</p>

      {events.length === 0 && (
        <p className="card-elevated mt-5 p-5 text-lg text-muted-foreground">{t("events.empty")}</p>
      )}

      <ActivitySection title={t("events.ldActivities")} activities={ldActivities} onOpen={onOpen} />
      <ActivitySection
        title={t("events.otherActivities")}
        activities={otherActivities}
        onOpen={onOpen}
      />
    </>
  );
}

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  event_date: string;
  activity_type: string;
  cover_image_url: string | null;
  photo_count: number;
};

function ActivitySection({
  title,
  activities,
  onOpen,
}: {
  title: string;
  activities: EventRow[];
  onOpen: (id: string) => void;
}) {
  if (!activities.length) return null;

  return (
    <section className="mt-7" aria-label={title}>
      <h2 className="text-xl font-bold">{title}</h2>
      <ul className="mt-4 space-y-4">
        {activities.map((event) => (
          <li key={event.id}>
            <EventCard event={event} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function EventCard({ event, onOpen }: { event: EventRow; onOpen: (id: string) => void }) {
  const { t } = useI18n();
  return (
    <article className="card-elevated overflow-hidden">
      {event.cover_image_url && (
        <img
          src={event.cover_image_url}
          alt={event.title}
          loading="lazy"
          className="max-h-80 w-full bg-muted object-contain"
        />
      )}
      <div className="p-4">
        {event.category && (
          <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-wide text-secondary-foreground">
            {event.category}
          </span>
        )}
        <h3 className="mt-2 text-xl font-bold leading-snug">{event.title}</h3>
        <p className="mt-2 flex items-center gap-2 text-base text-muted-foreground">
          <CalendarDays aria-hidden className="size-5 shrink-0" />
          {formatDate(event.event_date)}
        </p>
        {event.location && (
          <p className="mt-1 flex items-center gap-2 text-base text-muted-foreground">
            <MapPin aria-hidden className="size-5 shrink-0" />
            {event.location}
          </p>
        )}
        {event.description && <p className="mt-3 text-base">{event.description}</p>}
        <button
          type="button"
          onClick={() => onOpen(event.id)}
          className="btn-primary mt-4 flex w-full items-center justify-center gap-2"
        >
          <Images aria-hidden className="size-5" />
          {t("events.viewGallery")}
          {event.photo_count > 0 ? ` (${event.photo_count})` : ""}
        </button>
      </div>
    </article>
  );
}

function EventDetail({ eventId, onBack }: { eventId: string; onBack: () => void }) {
  const { t } = useI18n();
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; alt: string } | null>(null);
  const fetchEvent = useServerFn(getEvent);
  const { data, isPending } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => fetchEvent({ data: { eventId } }),
  });

  return (
    <AppShell title={t("nav.events")}>
      <button
        type="button"
        onClick={onBack}
        className="btn-secondary mb-4 flex items-center justify-center gap-2"
      >
        <ArrowLeft aria-hidden className="size-5" />
        {t("events.back")}
      </button>

      {isPending || !data ? (
        <p className="flex items-center gap-2 text-lg text-muted-foreground">
          <Loader2 aria-hidden className="size-5 animate-spin" />
          {t("common.loading")}
        </p>
      ) : (
        <>
          <h1 className="text-2xl font-bold leading-snug">{data.event.title}</h1>
          <p className="mt-2 flex items-center gap-2 text-base text-muted-foreground">
            <CalendarDays aria-hidden className="size-5 shrink-0" />
            {formatDate(data.event.event_date)}
          </p>
          {data.event.location && (
            <p className="mt-1 flex items-center gap-2 text-base text-muted-foreground">
              <MapPin aria-hidden className="size-5 shrink-0" />
              {data.event.location}
            </p>
          )}
          {data.event.description && <p className="mt-3 text-lg">{data.event.description}</p>}

          <h2 className="mt-6 text-lg font-bold">{t("events.gallery")}</h2>
          {data.photos.length === 0 ? (
            <p className="mt-2 text-base text-muted-foreground">{t("events.noPhotos")}</p>
          ) : (
            <ul className="mt-3 space-y-4">
              {data.photos.map((p) => (
                <li key={p.id} className="card-elevated overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSelectedPhoto({ url: p.image_url, alt: p.caption ?? data.event.title })}
                    className="block w-full bg-muted"
                    aria-label={`View ${p.caption ?? data.event.title} full screen`}
                  >
                    <img
                      src={p.image_url}
                      alt={p.caption ?? data.event.title}
                      loading="lazy"
                      className="max-h-[70vh] w-full object-contain"
                    />
                  </button>
                  {p.caption && <p className="p-3 text-base font-semibold">{p.caption}</p>}
                </li>
              ))}
            </ul>
          )}

          {selectedPhoto && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Full screen activity photo"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
              onClick={() => setSelectedPhoto(null)}
            >
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                aria-label="Close photo viewer"
                className="absolute right-4 top-4 flex size-12 items-center justify-center rounded-full bg-background/15 text-white"
              >
                <X aria-hidden className="size-6" />
              </button>
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.alt}
                className="max-h-full max-w-full rounded-lg object-contain"
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
