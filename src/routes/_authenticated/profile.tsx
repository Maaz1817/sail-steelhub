import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, LogOut, Pencil, Save, ShieldCheck, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useI18n } from "@/lib/i18n";
import { getMyProfile, updateMyContactDetails } from "@/lib/employee-auth.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — SAIL Salem Steel Plant Knowledge Hub" },
      {
        name: "description",
        content: "View your official Salem Steel Plant employee record and app settings.",
      },
      { property: "og:title", content: "My Profile — SAIL Salem Steel Plant Knowledge Hub" },
      {
        property: "og:description",
        content: "View your official Salem Steel Plant employee record and app settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
      <dd className="text-lg">{value ?? "—"}</dd>
    </div>
  );
}

function ProfilePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const updateContactDetails = useServerFn(updateMyContactDetails);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [designation, setDesignation] = useState("");
  const [phone, setPhone] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });

  const updateContact = useMutation({
    mutationFn: () => updateContactDetails({ data: { designation, phone, workEmail } }),
    onSuccess: () => {
      setIsEditingContact(false);
      setMessage("Your contact details were updated.");
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["home-feed"] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const p = data?.profile;

  function startEditingContact() {
    setDesignation(p?.designation ?? "");
    setPhone(p?.phone ?? "");
    setWorkEmail(p?.work_email ?? "");
    setMessage(null);
    setIsEditingContact(true);
  }

  return (
    <AppShell title={t("nav.profile")}>
      {isPending ? (
        <p className="flex items-center gap-2 text-lg text-muted-foreground">
          <Loader2 aria-hidden className="size-5 animate-spin" />
          {t("common.loading")}
        </p>
      ) : (
        <section className="card-elevated p-6">
          <h1 className="text-2xl font-bold">{p?.full_name ?? "—"}</h1>
          {data?.roles.includes("admin") ? (
            <p className="mt-2 inline-block rounded-full bg-accent/15 px-3 py-1 text-sm font-bold text-accent">
              {t("profile.adminBadge")}
            </p>
          ) : null}
          <dl className="mt-5 space-y-4">
            <Row label={t("home.employeeNumber")} value={p?.employee_number} />
            <Row label={t("home.designation")} value={p?.designation} />
            <Row label={t("home.department")} value={p?.department} />
            <Row label={t("profile.joined")} value={p?.date_of_joining} />
          </dl>

          <div className="mt-6 border-t-2 border-border pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{t("profile.contactDetails")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("profile.contactNote")}</p>
              </div>
              {!isEditingContact ? (
                <button
                  type="button"
                  onClick={startEditingContact}
                  className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border-2 border-primary px-3 text-sm font-bold text-primary"
                >
                  <Pencil aria-hidden className="size-4" />
                  {t("profile.edit")}
                </button>
              ) : null}
            </div>

            {isEditingContact ? (
              <form
                className="mt-4 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  updateContact.mutate();
                }}
              >
                <label className="block text-sm font-bold">
                  {t("home.designation")}
                  <input
                    type="text"
                    value={designation}
                    onChange={(event) => setDesignation(event.target.value)}
                    maxLength={120}
                    className="mt-2 min-h-12 w-full rounded-xl border-2 border-border bg-background px-3 text-base"
                  />
                </label>
                <label className="block text-sm font-bold">
                  {t("profile.phone")}
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    maxLength={32}
                    className="mt-2 min-h-12 w-full rounded-xl border-2 border-border bg-background px-3 text-base"
                  />
                </label>
                <label className="block text-sm font-bold">
                  {t("profile.email")}
                  <input
                    type="email"
                    value={workEmail}
                    onChange={(event) => setWorkEmail(event.target.value)}
                    maxLength={254}
                    className="mt-2 min-h-12 w-full rounded-xl border-2 border-border bg-background px-3 text-base"
                  />
                </label>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={updateContact.isPending}
                    className="btn-primary flex flex-1 items-center justify-center gap-2"
                  >
                    {updateContact.isPending ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Save aria-hidden className="size-5" />}
                    {t("profile.save")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingContact(false)}
                    className="btn-secondary flex items-center justify-center gap-2"
                  >
                    <X aria-hidden className="size-5" />
                    {t("profile.cancel")}
                  </button>
                </div>
              </form>
            ) : (
              <dl className="mt-4 space-y-4">
                <Row label={t("profile.email")} value={p?.work_email} />
                <Row label={t("profile.phone")} value={p?.phone} />
              </dl>
            )}
            {message ? <p className="mt-4 text-sm font-semibold text-primary">{message}</p> : null}
          </div>
        </section>
      )}

      {data?.roles.includes("admin") ? (
        <Link
          to="/admin"
          className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground"
        >
          <ShieldCheck aria-hidden className="size-5" />
          {t("profile.adminPanel")}
        </Link>
      ) : null}

      <section className="card-elevated mt-5 p-6">
        <LanguageSelector />
      </section>


      <button
        type="button"
        onClick={handleSignOut}
        className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-destructive px-4 text-lg font-bold text-destructive"
      >
        <LogOut aria-hidden className="size-5" />
        {t("home.signOut")}
      </button>
    </AppShell>
  );
}
