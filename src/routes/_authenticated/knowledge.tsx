import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PlayCircle, History, Trophy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { QuizRunner } from "@/components/QuizRunner";
import { useI18n } from "@/lib/i18n";
import { getLearningFeed } from "@/lib/knowledge.functions";

export const Route = createFileRoute("/_authenticated/knowledge")({
  head: () => ({
    meta: [
      { title: "Knowledge — SAIL Salem Steel Plant Knowledge Hub" },
      {
        name: "description",
        content: "Daily learning videos and 10-question quizzes for Salem Steel Plant employees.",
      },
      { property: "og:title", content: "Knowledge — SAIL Salem Steel Plant Knowledge Hub" },
      {
        property: "og:description",
        content: "Daily learning videos and 10-question quizzes for Salem Steel Plant employees.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KnowledgePage,
});

function KnowledgePage() {
  const { t } = useI18n();
  const [activeQuiz, setActiveQuiz] = useState<string | null>(null);
  const fetchFeed = useServerFn(getLearningFeed);

  const { data, isPending } = useQuery({
    queryKey: ["learning-feed"],
    queryFn: () => fetchFeed(),
  });

  if (activeQuiz) {
    return (
      <AppShell title={t("nav.knowledge")}>
        <QuizRunner moduleId={activeQuiz} onExit={() => setActiveQuiz(null)} />
      </AppShell>
    );
  }

  const modules = data?.modules ?? [];
  const attempts = data?.attempts ?? [];
  const bestFor = (moduleId: string) => {
    const mine = attempts.filter((a) => a.module_id === moduleId);
    return mine.length ? Math.max(...mine.map((a) => a.score)) : null;
  };
  const [today, ...rest] = modules;

  return (
    <AppShell title={t("nav.knowledge")}>
      {isPending ? (
        <p className="flex items-center gap-2 text-lg text-muted-foreground">
          <Loader2 aria-hidden className="size-5 animate-spin" />
          {t("common.loading")}
        </p>
      ) : (
        <>
          {today && (
            <section>
              <h1 className="text-lg font-bold">{t("knowledge.today")}</h1>
              <ModuleCard
                module={today}
                best={bestFor(today.id)}
                onStart={() => setActiveQuiz(today.id)}
                featured
              />
            </section>
          )}

          {rest.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-bold">{t("knowledge.library")}</h2>
              <div className="mt-3 space-y-4">
                {rest.map((m) => (
                  <ModuleCard
                    key={m.id}
                    module={m}
                    best={bestFor(m.id)}
                    onStart={() => setActiveQuiz(m.id)}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="mt-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <History aria-hidden className="size-5 text-accent" />
              {t("knowledge.history")}
            </h2>
            {attempts.length === 0 ? (
              <p className="mt-2 text-base text-muted-foreground">{t("knowledge.noHistory")}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {attempts.map((a) => {
                  const m = modules.find((x) => x.id === a.module_id);
                  return (
                      <li key={a.id} className="learning-history-card card-elevated flex items-center gap-3 p-4">
                      <Trophy aria-hidden className="size-6 shrink-0 text-accent" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold">{m?.title ?? "—"}</p>
                        <p className="text-sm text-muted-foreground">
                          {t("knowledge.completed")}:{" "}
                          {new Date(a.completed_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-lg font-extrabold text-primary">
                        {a.score}/{a.total}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}

type ModuleRow = {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  video_url: string | null;
  video_source: "external" | "upload";
  publish_date: string;
};

function ModuleCard({
  module,
  best,
  onStart,
  featured = false,
}: {
  module: ModuleRow;
  best: number | null;
  onStart: () => void;
  featured?: boolean;
}) {
  const { t } = useI18n();
  return (
    <article className={`${featured ? "learning-feature-card" : "learning-card"} card-elevated mt-3 overflow-hidden`}>
      {featured && module.video_url && (
        <div className="aspect-video w-full bg-muted">
          {module.video_source === "upload" ? (
            <video
              src={module.video_url}
              controls
              preload="metadata"
              className="size-full bg-black object-contain"
            >
              Your browser cannot play this video.
            </video>
          ) : (
            <iframe
              src={module.video_url}
              title={module.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              loading="lazy"
              className="size-full"
            />
          )}
        </div>
      )}
      <div className="p-5">
        {module.category && (
          <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            {module.category}
          </span>
        )}
        <h3 className="mt-2 text-xl font-bold leading-snug">{module.title}</h3>
        {module.summary && (
          <p className="mt-2 text-base text-muted-foreground">{module.summary}</p>
        )}
        {!featured && module.video_url && (
          <a
            href={module.video_url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-base font-semibold text-primary underline-offset-4 hover:underline"
          >
            <PlayCircle aria-hidden className="size-5" />
            {t("knowledge.watch")}
          </a>
        )}
        {best !== null && (
          <p className="mt-3 text-sm font-semibold">
            {t("knowledge.best")}: <span className="text-primary">{best}/5</span>
          </p>
        )}
        <button type="button" onClick={onStart} className="btn-primary mt-4 w-full">
          {best === null ? t("knowledge.startQuiz") : t("knowledge.retake")}
        </button>
      </div>
    </article>
  );
}
