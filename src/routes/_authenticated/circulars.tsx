import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CalendarDays, FileText, Loader2, Paperclip, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { getCircular, getCirculars } from "@/lib/circulars.functions";

export const Route = createFileRoute("/_authenticated/circulars")({
  head: () => ({
    meta: [
      { title: "Circulars — SAIL Salem Steel Plant Knowledge Hub" },
      {
        name: "description",
        content: "Searchable official circulars and notices for Salem Steel Plant employees.",
      },
      { property: "og:title", content: "Circulars — SAIL Salem Steel Plant Knowledge Hub" },
      {
        property: "og:description",
        content: "Searchable official circulars and notices for Salem Steel Plant employees.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CircularsPage,
});

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function CircularsPage() {
  const { t } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);

  if (openId) return <CircularDetail circularId={openId} onBack={() => setOpenId(null)} />;

  return (
    <AppShell title={t("nav.circulars")}>
      <CircularList onOpen={setOpenId} />
    </AppShell>
  );
}

function CircularList({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useI18n();
  const fetchCirculars = useServerFn(getCirculars);
  const { data, isPending } = useQuery({
    queryKey: ["circulars"],
    queryFn: () => fetchCirculars(),
  });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("__all");

  const circulars = data?.circulars ?? [];
  const categories = useMemo(
    () => Array.from(new Set(circulars.map((c) => c.category).filter(Boolean))) as string[],
    [circulars],
  );

  const filtered = circulars.filter((c) => {
    const inCategory = category === "__all" || c.category === category;
    const q = query.trim().toLowerCase();
    const inQuery =
      !q ||
      [c.title, c.summary, c.circular_number, c.department, c.category]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    return inCategory && inQuery;
  });

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-base text-muted-foreground">{t("circulars.subtitle")}</p>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("circulars.search")}
          aria-label={t("circulars.search")}
          className="circular-search h-14 w-full rounded-xl border-2 border-border bg-card pl-12 pr-4 text-base outline-none focus:border-primary"
        />
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {["__all", ...categories].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded-full border-2 px-4 py-2 text-sm font-semibold ${
                category === cat
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground"
              }`}
            >
              {cat === "__all" ? t("circulars.all") : cat}
            </button>
          ))}
        </div>
      )}

      {circulars.length === 0 && (
        <p className="rounded-xl border-2 border-border bg-card p-5 text-base">
          {t("circulars.empty")}
        </p>
      )}
      {circulars.length > 0 && filtered.length === 0 && (
        <p className="rounded-xl border-2 border-border bg-card p-5 text-base">
          {t("circulars.noResults")}
        </p>
      )}

      <ul className="space-y-3">
        {filtered.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onOpen(c.id)}
              className="circular-card w-full rounded-xl border-2 border-border bg-card p-4 text-left transition-colors hover:border-primary"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <FileText className="h-4 w-4" />
                <span>{c.circular_number}</span>
                {c.category && (
                  <span className="ml-auto rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
                    {c.category}
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-lg font-bold leading-snug">{c.title}</h2>
              {c.summary && (
                <p className="mt-1 text-base text-muted-foreground">{c.summary}</p>
              )}
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span>{formatDate(c.issued_date)}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CircularDetail({
  circularId,
  onBack,
}: {
  circularId: string;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const fetchCircular = useServerFn(getCircular);
  const { data, isPending } = useQuery({
    queryKey: ["circular", circularId],
    queryFn: () => fetchCircular({ data: { circularId } }),
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const circular = data?.circular;

  async function downloadAttachment() {
    if (!circular?.file_url) return;
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const response = await fetch(circular.file_url);
      if (!response.ok) throw new Error("Unable to download the attachment");

      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      const savedName = new URL(circular.file_url).pathname.split("/").pop() ?? "attachment";
      link.href = objectUrl;
      link.download = savedName.replace(/^[0-9a-f-]{36}-/, "") || "SAIL-circular-attachment";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    } catch {
      setDownloadError("Could not download the attachment. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <AppShell title={t("nav.circulars")}>
      <button type="button" onClick={onBack} className="btn-secondary mb-4 w-full">
        <ArrowLeft className="mr-2 inline h-5 w-5" />
        {t("circulars.back")}
      </button>

      {isPending && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {circular && (
        <article className="space-y-4 rounded-xl border-2 border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-primary">
            <FileText className="h-4 w-4" />
            <span>
              {t("circulars.number")} {circular.circular_number}
            </span>
            {circular.category && (
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
                {circular.category}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold leading-tight">{circular.title}</h1>

          <dl className="space-y-1 text-base text-muted-foreground">
            <div className="flex gap-2">
              <dt className="font-semibold">{t("circulars.issued")}:</dt>
              <dd>{formatDate(circular.issued_date)}</dd>
            </div>
            {circular.department && (
              <div className="flex gap-2">
                <dt className="font-semibold">{t("circulars.department")}:</dt>
                <dd>{circular.department}</dd>
              </div>
            )}
          </dl>

          {circular.summary && (
            <p className="rounded-lg bg-muted p-4 text-base font-semibold">{circular.summary}</p>
          )}
          {circular.body && (
            <p className="whitespace-pre-line text-base leading-relaxed">{circular.body}</p>
          )}

          {circular.file_url && (
            <button
              type="button"
              onClick={downloadAttachment}
              disabled={isDownloading}
              className="btn-primary flex w-full items-center justify-center disabled:opacity-60"
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Paperclip className="mr-2 h-5 w-5" />
              )}
              {isDownloading ? "Downloading…" : t("circulars.download")}
            </button>
          )}
          {downloadError && <p className="text-sm font-semibold text-destructive">{downloadError}</p>}
        </article>
      )}
    </AppShell>
  );
}
