import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Home dashboard feed: the signed-in employee's own profile plus today's
 * celebrations across the plant. Celebration rows expose only a name,
 * department and designation — never contact details or dates of birth.
 */
export const getHomeFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db: any = context.supabase;
    const { data: profile } = await context.supabase
      .from("employees")
      .select("employee_number, full_name, designation, department, photo_url, date_of_joining")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roster } = await supabaseAdmin
      .from("employees")
      .select("id, full_name, designation, department, date_of_birth, date_of_joining")
      .eq("is_active", true);

    const { data: latestAnnouncement } = await db
      .from("announcements")
      .select("id, title, body, image_path, published_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let announcementImageUrl: string | null = null;
    if (latestAnnouncement?.image_path) {
      const { data: signed } = await (supabaseAdmin as any).storage
        .from("announcement-images")
        .createSignedUrl(latestAnnouncement.image_path, 60 * 60);
      announcementImageUrl = signed?.signedUrl ?? null;
    }

    const now = new Date();
    const indiaDate = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const getPart = (type: Intl.DateTimeFormatPartTypes) =>
      indiaDate.find((part) => part.type === type)?.value ?? "";
    const mm = getPart("month");
    const dd = getPart("day");
    const year = Number(getPart("year"));
    const today = `${mm}-${dd}`;

    const birthdays = (roster ?? [])
      .filter((r) => r.date_of_birth?.slice(5) === today)
      .map((r) => ({
        id: r.id,
        name: r.full_name,
        designation: r.designation,
        department: r.department,
      }));

    const anniversaries = (roster ?? [])
      .filter((r) => r.date_of_joining?.slice(5) === today)
      .map((r) => ({
        id: r.id,
        name: r.full_name,
        designation: r.designation,
        department: r.department,
        years: r.date_of_joining
          ? year - Number(r.date_of_joining.slice(0, 4))
          : null,
      }))
      .filter((r) => (r.years ?? 0) > 0);

    return {
      profile,
      birthdays,
      anniversaries,
      latestAnnouncement: latestAnnouncement
        ? { ...latestAnnouncement, image_url: announcementImageUrl }
        : null,
    };
  });
