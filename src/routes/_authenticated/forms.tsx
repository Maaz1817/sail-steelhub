import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileSpreadsheet, Loader2, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { getForms, getFormDownloadUrl } from "@/lib/forms.functions";

const HR_FORMS_CATEGORY = "HR Forms";

function isHrForm(category: string | null) {
  return ["hr", "hr forms", "human resources"].includes(category?.trim().toLowerCase() ?? "");
}

export const Route = createFileRoute("/_authenticated/forms")({
  head: () => ({
    meta: [
      { title: "Forms — SAIL Salem Steel Plant Knowledge Hub" },
      {
        name: "description",
        content: "Download official Salem Steel Plant employee forms and applications.",
      },
      { property: "og:title", content: "Forms — SAIL Salem Steel Plant Knowledge Hub" },
      {
        property: "og:description",
        content: "Official employee forms available to view and download.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FormsPage,
});

function FormsPage() {
  const { t } = useI18n();
  const fetchForms = useServerFn(getForms);
  const downloadFn = useServerFn(getFormDownloadUrl);

  const { data, isPending } = useQuery({ queryKey: ["forms"], queryFn: () => fetchForms() });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("__all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const forms = data?.forms ?? [];
  const categories = useMemo(
    () => [
      HR_FORMS_CATEGORY,
      ...(Array.from(new Set(forms.map((f) => f.category).filter(Boolean))) as string[]).filter(
        (item) => !isHrForm(item),
      ),
    ],
    [forms],
  );

  const filtered = forms.filter((f) => {
    const inCategory =
      category === "__all" ||
      (category === HR_FORMS_CATEGORY ? isHrForm(f.category) : f.category === category);
    const q = query.trim().toLowerCase();
    const inQuery =
      !q ||
      [f.title, f.description, f.department, f.category]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    return inCategory && inQuery;
  });

  async function download(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await downloadFn({ data: { formId: id } });
      const response = await fetch(res.url);
      if (!response.ok) throw new Error("Unable to download the form");

      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = res.fileName || "SAIL-form";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    } catch {
      setError(t("forms.downloadFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell title={t("nav.forms")}>
      <label className="relative block">
        <span className="sr-only">{t("forms.search")}</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("forms.search")}
          className="forms-search min-h-14 w-full rounded-xl border-2 border-border bg-card pl-11 pr-3 text-base"
        />
      </label>

      {categories.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {["__all", ...categories].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`min-h-12 rounded-full border-2 px-4 text-sm font-bold ${
                category === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {c === "__all" ? t("forms.all") : c}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-base font-semibold text-destructive">{error}</p> : null}

      {isPending ? (
        <div className="flex justify-center py-16">
          <Loader2 aria-hidden className="size-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-lg text-muted-foreground">{t("forms.empty")}</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {filtered.map((f) => (
            <li key={f.id} className="form-card card-elevated p-4">
              <div className="flex items-start gap-3">
                <FileSpreadsheet aria-hidden className="mt-1 size-6 shrink-0 text-primary" />
                <div className="min-w-0">
                  <h2 className="text-lg font-bold leading-snug">{f.title}</h2>
                  {f.description ? (
                    <p className="mt-1 text-base text-muted-foreground">{f.description}</p>
                  ) : null}
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">
                    {[f.category, f.department].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => download(f.id)}
                disabled={busyId === f.id}
                className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground"
              >
                {busyId === f.id ? (
                  <Loader2 aria-hidden className="size-5 animate-spin" />
                ) : (
                  <Download aria-hidden className="size-5" />
                )}
                {t("forms.download")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
