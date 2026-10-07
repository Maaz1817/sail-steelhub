import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Published plant activities, newest first. */
export const getEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: events } = await context.supabase
      .from("events")
      .select(
        "id, title, description, category, location, event_date, activity_type, cover_image_url, home_cover_image_url, home_cover_position_x, home_cover_position_y, home_cover_scale",
      )
      .eq("is_published", true)
      .order("event_date", { ascending: false });

    const ids = (events ?? []).map((e) => e.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: photos } = await context.supabase
        .from("event_photos")
        .select("event_id")
        .in("event_id", ids);
      counts = (photos ?? []).reduce<Record<string, number>>((acc, p) => {
        acc[p.event_id] = (acc[p.event_id] ?? 0) + 1;
        return acc;
      }, {});
    }

    return {
      events: (events ?? []).map((e) => ({
        ...e,
        home_image_url: e.home_cover_image_url ?? e.cover_image_url,
        photo_count: counts[e.id] ?? 0,
      })),
    };
  });

/** One published activity with its photo gallery. */
export const getEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string }) => {
    if (!data?.eventId) throw new Error("eventId is required");
    return { eventId: data.eventId };
  })
  .handler(async ({ data, context }) => {
    const { data: event } = await context.supabase
      .from("events")
      .select("id, title, description, category, location, event_date, activity_type, cover_image_url")
      .eq("id", data.eventId)
      .eq("is_published", true)
      .maybeSingle();
    if (!event) throw new Error("Activity not found");

    const { data: photos } = await context.supabase
      .from("event_photos")
      .select("id, image_url, caption, order_index")
      .eq("event_id", data.eventId)
      .order("order_index", { ascending: true });

    return { event, photos: photos ?? [] };
  });
