import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeEmployeeNumber } from "@/lib/employee-account";

/** Throws unless the caller holds the admin role. Returns the admin client. */
async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function logAction(
  admin: any,
  actorUserId: string,
  action: string,
  entity: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  await admin.from("audit_logs").insert({
    actor_user_id: actorUserId,
    action,
    entity,
    entity_id: entityId,
    details,
  });
}

/** Headline counts plus the newest audit entries. */
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context);

    const count = async (table: string, filter?: (q: any) => any) => {
      let q: any = (admin as any).from(table).select("id", { count: "exact", head: true });
      if (filter) q = filter(q);
      const { count: c } = await q;
      return c ?? 0;
    };

    const [employees, activated, awaitingActivation, inactive, modules, events, circulars, attempts] = await Promise.all([
      count("employees"),
      count("employees", (q) => q.eq("is_active", true).not("auth_user_id", "is", null)),
      count("employees", (q) => q.eq("is_active", true).is("auth_user_id", null)),
      count("employees", (q) => q.eq("is_active", false)),
      count("learning_modules"),
      count("events"),
      count("circulars"),
      count("quiz_attempts"),
    ]);

    const { data: roster, error: rosterError } = await admin
      .from("employees")
      .select("id, employee_number, full_name, designation, department, is_active, auth_user_id")
      .order("full_name", { ascending: true })
      .limit(1000);
    if (rosterError) throw new Error("Unable to load employee activation overview");

    const overviewEmployee = (employee: (typeof roster)[number]) => ({
      id: employee.id,
      employee_number: employee.employee_number,
      full_name: employee.full_name,
      designation: employee.designation,
      department: employee.department,
    });
    const activeRoster = (roster ?? []).filter((employee) => employee.is_active);
    const employeeStatus = {
      activated: activeRoster.filter((employee) => employee.auth_user_id).map(overviewEmployee),
      awaitingActivation: activeRoster.filter((employee) => !employee.auth_user_id).map(overviewEmployee),
      inactive: (roster ?? []).filter((employee) => !employee.is_active).map(overviewEmployee),
    };

    const { data: logs } = await admin
      .from("audit_logs")
      .select("id, action, entity, entity_id, employee_number, created_at, details")
      .order("created_at", { ascending: false })
      .limit(25);

    return {
      stats: { employees, activated, awaitingActivation, inactive, modules, events, circulars, attempts },
      employeeStatus,
      logs: logs ?? [],
    };
  });

/** Roster search for the admin employee manager. */
export const adminListEmployees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string }) =>
    z.object({ search: z.string().max(80).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    let q = admin
      .from("employees")
      .select(
        "id, employee_number, full_name, designation, grade, department, work_email, phone, date_of_birth, date_of_joining, date_of_joining_ssp, is_active, is_admin, auth_user_id",
      )
      .order("employee_number", { ascending: true })
      .limit(1000);

    const search = data.search?.trim();
    if (search) {
      q = q.or(
        `employee_number.ilike.%${search}%,full_name.ilike.%${search}%,department.ilike.%${search}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error("Unable to load employees");
    return { employees: rows ?? [] };
  });

const employeeInput = z.object({
  id: z.string().uuid().optional(),
  employee_number: z.string().min(3).max(32),
  full_name: z.string().min(2).max(120),
  designation: z.string().max(120).optional().nullable(),
  grade: z.string().max(32).optional().nullable(),
  department: z.string().max(120).optional().nullable(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  date_of_joining: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  date_of_joining_ssp: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  work_email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().max(24).optional().nullable(),
  is_active: z.boolean().optional(),
  is_admin: z.boolean().optional(),
});

/** Create or update a roster record. */
export const adminSaveEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => employeeInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const payload = {
      employee_number: normalizeEmployeeNumber(data.employee_number),
      full_name: data.full_name.trim(),
      designation: data.designation || null,
      grade: data.grade || null,
      department: data.department || null,
      date_of_birth: data.date_of_birth || null,
      date_of_joining: data.date_of_joining || null,
      date_of_joining_ssp: data.date_of_joining_ssp || null,
      work_email: data.work_email || null,
      phone: data.phone || null,
      ...(data.is_active === undefined ? {} : { is_active: data.is_active }),
      ...(data.is_admin === undefined ? {} : { is_admin: data.is_admin }),
    };

    if (data.id) {
      const { error } = await admin.from("employees").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAction(admin, context.userId, "employee.update", "employees", data.id, {
        employee_number: payload.employee_number,
      });
      return { id: data.id };
    }

    const { data: row, error } = await admin
      .from("employees")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAction(admin, context.userId, "employee.create", "employees", row.id, {
      employee_number: payload.employee_number,
    });
    return { id: row.id as string };
  });

/** Activate/deactivate an employee, or grant/revoke the admin role. */
export const adminSetEmployeeFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; is_active?: boolean; is_admin?: boolean }) =>
    z
      .object({
        id: z.string().uuid(),
        is_active: z.boolean().optional(),
        is_admin: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { data: row } = await admin
      .from("employees")
      .select("id, employee_number, auth_user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Employee not found");

    const patch: { is_active?: boolean; is_admin?: boolean } = {};
    if (data.is_active !== undefined) patch.is_active = data.is_active;
    if (data.is_admin !== undefined) patch.is_admin = data.is_admin;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await admin.from("employees").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);

    // Keep the role table in sync for already-activated accounts.
    if (data.is_admin !== undefined && row.auth_user_id) {
      if (data.is_admin) {
        await admin
          .from("user_roles")
          .upsert({ user_id: row.auth_user_id, role: "admin" }, { onConflict: "user_id,role" });
      } else {
        await admin
          .from("user_roles")
          .delete()
          .eq("user_id", row.auth_user_id)
          .eq("role", "admin");
      }
    }

    await logAction(admin, context.userId, "employee.flags", "employees", data.id, patch);
    return { ok: true };
  });

const CONTENT_TABLES = ["circulars", "events", "learning_modules", "forms"] as const;
type ContentTable = (typeof CONTENT_TABLES)[number];

/** All content rows (published and drafts) for the admin content manager. */
export const adminListContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context);
    const [circulars, events, modules] = await Promise.all([
      admin
        .from("circulars")
        .select("id, circular_number, title, category, department, issued_date, is_published")
        .order("issued_date", { ascending: false }),
      admin
        .from("events")
        .select("id, title, category, location, event_date, activity_type, is_published")
        .order("event_date", { ascending: false }),
      admin
        .from("learning_modules")
        .select("id, title, category, publish_date, is_published")
        .order("publish_date", { ascending: false }),
    ]);
    return {
      circulars: circulars.data ?? [],
      events: events.data ?? [],
      modules: modules.data ?? [],
    };
  });

/** Publish or unpublish any content row. */
export const adminSetPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { table: ContentTable; id: string; is_published: boolean }) =>
    z
      .object({
        table: z.enum(CONTENT_TABLES),
        id: z.string().uuid(),
        is_published: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { error } = await admin
      .from(data.table)
      .update({ is_published: data.is_published })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction(admin, context.userId, "content.publish", data.table, data.id, {
      is_published: data.is_published,
    });
    return { ok: true };
  });

/** Publish a new circular straight from the admin panel. */
export const adminCreateCircular = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        circular_number: z.string().min(2).max(60),
        title: z.string().min(3).max(200),
        summary: z.string().max(500).optional(),
        body: z.string().max(20000).optional(),
        category: z.string().min(1).max(60),
        department: z.string().max(80).optional(),
        issued_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        file_url: z.string().min(1).max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { data: row, error } = await admin
      .from("circulars")
      .insert({
        circular_number: data.circular_number.trim(),
        title: data.title.trim(),
        summary: data.summary || null,
        body: data.body || null,
        category: data.category,
        department: data.department || null,
        issued_date: data.issued_date,
        file_url: data.file_url || null,
        is_published: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAction(admin, context.userId, "circular.create", "circulars", row.id, {
      circular_number: data.circular_number,
    });
    return { id: row.id as string };
  });

/** Signed upload slot for an optional circular attachment. */
export const adminCreateCircularUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileName: string }) =>
    z.object({ fileName: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `circulars/${crypto.randomUUID()}-${safe}`;
    const { data: signed, error } = await admin.storage
      .from("circular-files")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error("Unable to prepare circular attachment upload");
    return { path, token: signed.token };
  });

const eventInput = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(4000).optional(),
  category: z.string().max(60).optional(),
  activity_type: z.enum(["ld", "other"]).optional(),
  location: z.string().max(160).optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_published: z.boolean().optional(),
});

/** Create an event. Photos can be attached immediately afterwards. */
export const adminCreateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => eventInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { data: row, error } = await admin
      .from("events")
      .insert({
        title: data.title.trim(),
        description: data.description?.trim() || null,
        category: data.category?.trim() || null,
        activity_type: data.activity_type ?? "ld",
        location: data.location?.trim() || null,
        event_date: data.event_date,
        is_published: data.is_published ?? true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAction(admin, context.userId, "event.create", "events", row.id, { title: data.title });
    return { id: row.id as string };
  });

/** Signed upload slot for one event image. Only ordinary image formats are accepted. */
export const adminCreateEventPhotoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileName: string; contentType: string }) =>
    z
      .object({
        fileName: z.string().min(1).max(200),
        contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `events/${crypto.randomUUID()}-${safe}`;
    const { data: signed, error } = await admin.storage
      .from("event-media")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error("Unable to prepare event photo upload");
    return { path, token: signed.token };
  });

/** Attach an uploaded image to an activity and optionally set its gallery or Home cover. */
export const adminAddEventPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        path: z.string().min(1).max(400).regex(/^events\//),
        caption: z.string().max(300).optional(),
        setAsCover: z.boolean().optional(),
        setAsHomeCover: z.boolean().optional(),
        homeCoverPositionX: z.number().int().min(0).max(100).optional(),
        homeCoverPositionY: z.number().int().min(0).max(100).optional(),
        homeCoverScale: z.number().min(1).max(2.5).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { count: photoCount, error: countError } = await admin
      .from("event_photos")
      .select("id", { count: "exact", head: true })
      .eq("event_id", data.eventId);
    if (countError) throw new Error(countError.message);
    if ((photoCount ?? 0) >= 5) {
      throw new Error("An activity can have a maximum of 5 photos.");
    }

    const { data: lastPhoto } = await admin
      .from("event_photos")
      .select("order_index")
      .eq("event_id", data.eventId)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: publicUrl } = admin.storage.from("event-media").getPublicUrl(data.path);
    if (!publicUrl.publicUrl) throw new Error("Unable to prepare event image");

    const { data: row, error } = await admin
      .from("event_photos")
      .insert({
        event_id: data.eventId,
        image_url: publicUrl.publicUrl,
        caption: data.caption?.trim() || null,
        order_index: (lastPhoto?.order_index ?? -1) + 1,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (data.setAsCover) {
      const { error: coverError } = await admin
        .from("events")
        .update({ cover_image_url: publicUrl.publicUrl })
        .eq("id", data.eventId);
      if (coverError) throw new Error(coverError.message);
    }
    if (data.setAsHomeCover) {
      const { error: homeCoverError } = await admin
        .from("events")
        .update({
          home_cover_image_url: publicUrl.publicUrl,
          home_cover_position_x: data.homeCoverPositionX ?? 50,
          home_cover_position_y: data.homeCoverPositionY ?? 50,
          home_cover_scale: data.homeCoverScale ?? 1,
        })
        .eq("id", data.eventId);
      if (homeCoverError) throw new Error(homeCoverError.message);
    }
    await logAction(admin, context.userId, "event.photo.add", "event_photos", row.id, {
      event_id: data.eventId,
    });
    return { id: row.id as string };
  });

/** The admin-only photo list used to choose a dedicated Home gallery cover. */
export const adminGetEventHomeCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) =>
    z.object({ eventId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const [{ data: event, error: eventError }, { data: photos, error: photosError }] = await Promise.all([
      admin
        .from("events")
        .select(
          "id, title, home_cover_image_url, home_cover_position_x, home_cover_position_y, home_cover_scale",
        )
        .eq("id", data.eventId)
        .maybeSingle(),
      admin
        .from("event_photos")
        .select("id, image_url, caption, order_index")
        .eq("event_id", data.eventId)
        .order("order_index", { ascending: true }),
    ]);
    if (eventError) throw new Error(eventError.message);
    if (photosError) throw new Error(photosError.message);
    if (!event) throw new Error("Activity not found");
    return { event, photos: photos ?? [] };
  });

/** Set the photo used in the Home gallery only. */
export const adminSetEventHomeCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    eventId: string;
    photoId: string;
    cropX: number;
    cropY: number;
    cropScale: number;
  }) =>
    z
      .object({
        eventId: z.string().uuid(),
        photoId: z.string().uuid(),
        cropX: z.number().int().min(0).max(100),
        cropY: z.number().int().min(0).max(100),
        cropScale: z.number().min(1).max(2.5),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { data: photo, error: photoError } = await admin
      .from("event_photos")
      .select("id, image_url")
      .eq("id", data.photoId)
      .eq("event_id", data.eventId)
      .maybeSingle();
    if (photoError) throw new Error(photoError.message);
    if (!photo) throw new Error("Photo not found in this activity");

    const { error } = await admin
      .from("events")
      .update({
        home_cover_image_url: photo.image_url,
        home_cover_position_x: data.cropX,
        home_cover_position_y: data.cropY,
        home_cover_scale: data.cropScale,
      })
      .eq("id", data.eventId);
    if (error) throw new Error(error.message);
    await logAction(admin, context.userId, "event.home_cover.set", "events", data.eventId, {
      photo_id: data.photoId,
      crop_x: data.cropX,
      crop_y: data.cropY,
      crop_scale: data.cropScale,
    });
    return { ok: true };
  });

/** Celebration notifications created by the daily database task. */
export const adminGetCelebrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context);
    const { data } = await (admin as any)
      .from("notifications")
      .select("id, kind, title, body, notice_date, created_at")
      .in("kind", ["birthday", "anniversary"])
      .order("created_at", { ascending: false })
      .limit(50);
    return { greetings: data ?? [] };
  });

/** Manually run the same India-time scan that runs every morning. */
export const adminRunCelebrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context);
    const { data, error } = await (admin as any).rpc("generate_daily_celebration_notifications");
    if (error) throw new Error(error.message);
    await logAction(admin, context.userId, "celebrations.run", "notifications", null, data ?? {});
    return data as { count: number; date: string; birthdays: number; anniversaries: number };
  });

const announcementInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1).max(10000),
  image_path: z.string().max(400).regex(/^announcements\//).optional().nullable(),
  is_published: z.boolean(),
});

/** Announcements, including unpublished drafts, for the admin composer. */
export const adminListAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context);
    const { data, error } = await (admin as any)
      .from("announcements")
      .select("id, title, body, image_path, is_published, published_at, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error("Unable to load announcements");
    return { announcements: data ?? [] };
  });

/** A short-lived direct upload token for an optional announcement image. */
export const adminCreateAnnouncementImageUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileName: string; contentType: string }) =>
    z
      .object({
        fileName: z.string().min(1).max(200),
        contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `announcements/${crypto.randomUUID()}-${safe}`;
    const { data: signed, error } = await admin.storage
      .from("announcement-images")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error("Unable to prepare announcement image upload");
    return { path, token: signed.token };
  });

/** Create or edit an announcement and synchronise its employee notification. */
export const adminSaveAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => announcementInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const now = new Date().toISOString();
    let id = data.id;
    let oldImagePath: string | null = null;

    if (id) {
      const { data: current, error: currentError } = await (admin as any)
        .from("announcements")
        .select("image_path, published_at")
        .eq("id", id)
        .maybeSingle();
      if (currentError || !current) throw new Error("Announcement not found");
      oldImagePath = current.image_path;
      const { error } = await (admin as any)
        .from("announcements")
        .update({
          title: data.title,
          body: data.body,
          image_path: data.image_path ?? null,
          is_published: data.is_published,
          published_at: data.is_published ? current.published_at ?? now : null,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await (admin as any)
        .from("announcements")
        .insert({
          title: data.title,
          body: data.body,
          image_path: data.image_path ?? null,
          is_published: data.is_published,
          published_at: data.is_published ? now : null,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = row.id as string;
    }

    if (data.is_published) {
      const { error } = await (admin as any).from("notifications").upsert(
        {
          announcement_id: id,
          kind: "announcement",
          title: data.title,
          body: data.body,
          image_path: data.image_path ?? null,
          notice_date: now.slice(0, 10),
        },
        { onConflict: "announcement_id" },
      );
      if (error) throw new Error(`Announcement saved, but notification failed: ${error.message}`);
    } else {
      await (admin as any).from("notifications").delete().eq("announcement_id", id);
    }

    if (oldImagePath && oldImagePath !== data.image_path) {
      await admin.storage.from("announcement-images").remove([oldImagePath]);
    }
    await logAction(admin, context.userId, "announcement.save", "announcements", id, {
      is_published: data.is_published,
    });
    return { id };
  });

/** Remove an announcement and its related notification/wishes. */
export const adminDeleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { data: row } = await (admin as any)
      .from("announcements")
      .select("image_path")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Announcement not found");
    const { error } = await (admin as any).from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row.image_path) await admin.storage.from("announcement-images").remove([row.image_path]);
    await logAction(admin, context.userId, "announcement.delete", "announcements", data.id);
    return { ok: true };
  });

/** All forms (published and hidden) for the admin forms manager. */
export const adminListForms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context);
    const { data } = await admin
      .from("forms")
      .select("id, title, description, category, department, file_name, is_published, created_at")
      .order("created_at", { ascending: false });
    return { forms: data ?? [] };
  });

/** Signed upload slot so the browser can send the file straight to storage. */
export const adminCreateFormUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileName: string }) =>
    z.object({ fileName: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${crypto.randomUUID()}-${safe}`;
    const { data: signed, error } = await admin.storage.from("forms").createSignedUploadUrl(path);
    if (error || !signed) throw new Error("Unable to prepare upload");
    return { path, token: signed.token };
  });

/** Save a form record once its file has been uploaded. */
export const adminCreateForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().min(3).max(200),
        description: z.string().max(1000).optional(),
        category: z.string().min(1).max(60),
        department: z.string().max(80).optional(),
        file_url: z.string().min(1).max(400),
        file_name: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { data: row, error } = await admin
      .from("forms")
      .insert({
        title: data.title.trim(),
        description: data.description || null,
        category: data.category,
        department: data.department || null,
        file_url: data.file_url,
        file_name: data.file_name,
        is_published: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAction(admin, context.userId, "form.create", "forms", row.id, { title: data.title });
    return { id: row.id as string };
  });

/** Remove a form and its stored file. */
export const adminDeleteForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { data: row } = await admin
      .from("forms")
      .select("id, file_url, title")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Form not found");
    await admin.storage.from("forms").remove([row.file_url]);
    const { error } = await admin.from("forms").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction(admin, context.userId, "form.delete", "forms", data.id, { title: row.title });
    return { ok: true };
  });

/** Signed upload slot for an admin-uploaded learning video. */
export const adminCreateLearningVideoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileName: string; contentType: string }) =>
    z
      .object({
        fileName: z.string().min(1).max(200),
        contentType: z.enum(["video/mp4", "video/webm", "video/quicktime"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `lessons/${crypto.randomUUID()}-${safe}`;
    const { data: signed, error } = await admin.storage
      .from("learning-videos")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error("Unable to prepare learning video upload");
    return { path, token: signed.token };
  });

/** Learning modules with their question counts, newest first. */
export const adminListModules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context);
    const { data: modules } = await admin
      .from("learning_modules")
      .select("id, title, summary, category, video_url, video_path, publish_date, is_published")
      .order("publish_date", { ascending: false });
    const { data: questions } = await admin.from("quiz_questions").select("id, module_id");
    const counts: Record<string, number> = {};
    for (const q of questions ?? []) counts[q.module_id] = (counts[q.module_id] ?? 0) + 1;
    return {
      modules: (modules ?? []).map((m) => ({ ...m, question_count: counts[m.id] ?? 0 })),
    };
  });

const questionSchema = z.object({
  question: z.string().min(5).max(400),
  options: z.array(z.string().min(1).max(200)).length(4),
  correct_index: z.number().int().min(0).max(3),
  explanation: z.string().max(600).optional().nullable(),
});

/** Create or update one learning module together with up to 5 quiz questions. */
export const adminSaveModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional().nullable(),
        title: z.string().min(3).max(200),
        summary: z.string().max(1000).optional().nullable(),
        category: z.string().max(60).optional().nullable(),
        video_url: z.string().max(500).optional().nullable(),
        video_path: z.string().max(400).optional().nullable(),
        publish_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        is_published: z.boolean(),
        questions: z.array(questionSchema).max(5),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const payload = {
      title: data.title.trim(),
      summary: data.summary || null,
      category: data.category || null,
      video_url: data.video_url || null,
      video_path: data.video_path || null,
      publish_date: data.publish_date,
      is_published: data.is_published,
    };

    let moduleId = data.id ?? null;
    let previousVideoPath: string | null = null;
    if (moduleId) {
      const { data: existing } = await admin
        .from("learning_modules")
        .select("video_path")
        .eq("id", moduleId)
        .maybeSingle();
      previousVideoPath = existing?.video_path ?? null;
      const { error } = await admin.from("learning_modules").update(payload).eq("id", moduleId);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await admin
        .from("learning_modules")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      moduleId = row.id as string;
    }

    if (previousVideoPath && previousVideoPath !== payload.video_path) {
      await admin.storage.from("learning-videos").remove([previousVideoPath]);
    }

    await admin.from("quiz_questions").delete().eq("module_id", moduleId);
    if (data.questions.length > 0) {
      const { error } = await admin.from("quiz_questions").insert(
        data.questions.map((q, i) => ({
          module_id: moduleId as string,
          order_index: i,
          question: q.question.trim(),
          options: q.options,
          correct_index: q.correct_index,
          explanation: q.explanation || null,
        })),
      );
      if (error) throw new Error(error.message);
    }

    await logAction(admin, context.userId, data.id ? "module.update" : "module.create", "learning_modules", moduleId, {
      title: payload.title,
      questions: data.questions.length,
    });
    return { id: moduleId as string };
  });

/** Full module detail including quiz questions and answers, for editing. */
export const adminGetModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { data: module } = await admin
      .from("learning_modules")
      .select("id, title, summary, category, video_url, video_path, publish_date, is_published")
      .eq("id", data.id)
      .maybeSingle();
    if (!module) throw new Error("Module not found");
    const { data: questions } = await admin
      .from("quiz_questions")
      .select("id, order_index, question, options, correct_index, explanation")
      .eq("module_id", data.id)
      .order("order_index", { ascending: true });
    return {
      module,
      questions: (questions ?? []).slice(0, 5).map((q) => ({
        question: q.question,
        options: (q.options as string[]) ?? [],
        correct_index: q.correct_index,
        explanation: q.explanation,
      })),
    };
  });

/** Delete a learning module and its quiz questions. */
export const adminDeleteModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { data: module } = await admin
      .from("learning_modules")
      .select("video_path")
      .eq("id", data.id)
      .maybeSingle();
    await admin.from("quiz_attempts").delete().eq("module_id", data.id);
    await admin.from("quiz_questions").delete().eq("module_id", data.id);
    const { error } = await admin.from("learning_modules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (module?.video_path) await admin.storage.from("learning-videos").remove([module.video_path]);
    await logAction(admin, context.userId, "module.delete", "learning_modules", data.id, {});
    return { ok: true };
  });

/** Ask the AI to draft a daily learning module: topic, video suggestion and 5 quiz questions. */
export const adminAiDraftModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { topic?: string }) =>
    z.object({ topic: z.string().max(200).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const provider = process.env["AI_PROVIDER"]?.trim().toLowerCase() === "openai" ? "openai" : "ollama";

    const topic = data.topic?.trim();
    const prompt = `Create one short daily learning module for employees of SAIL Salem Steel Plant (stainless steel cold rolling plant in Tamil Nadu, India).
${topic ? `Topic: ${topic}.` : "Choose a useful topic: plant safety, PPE, quality, machinery basics, HR policy awareness or workplace conduct."}
Return JSON only with this exact shape:
{"title":string,"summary":string,"category":string,"video_url":string,"questions":[{"question":string,"options":[string,string,string,string],"correct_index":0,"explanation":string}]}
Rules:
- Exactly 5 questions, each with exactly 4 options and one correct answer.
- Simple clear English suitable for employees aged 25-60.
- video_url must be a real, well-known public YouTube training video embed URL in the form https://www.youtube.com/embed/VIDEO_ID related to the topic. If unsure, use https://www.youtube.com/embed/results?search_query= followed by URL-encoded keywords.`;

    let res: Response;
    try {
      if (provider === "ollama") {
        const baseUrl = (process.env["OLLAMA_BASE_URL"]?.trim() || "http://127.0.0.1:11434").replace(
          /\/$/,
          "",
        );
        const model = process.env["OLLAMA_MODEL"]?.trim() || "llama3.2:3b";
        res = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            stream: false,
            format: "json",
            messages: [
              { role: "system", content: "You write concise workplace training content and return strict JSON." },
              { role: "user", content: prompt },
            ],
          }),
        });
      } else {
        const apiKey = process.env["OPENAI_API_KEY"];
        if (!apiKey) throw new Error("AI is not configured. Contact the IT department.");
        const model = process.env["OPENAI_MODEL"]?.trim() || "gpt-5-mini";
        res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: "You write concise workplace training content and return strict JSON." },
              { role: "user", content: prompt },
            ],
          }),
        });
      }
    } catch {
      throw new Error(
        provider === "ollama"
          ? "Free local AI is not running. Start Ollama on this computer, then try again."
          : "AI is unavailable. Please try again in a moment.",
      );
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (provider === "ollama") {
        throw new Error(
          detail.toLowerCase().includes("model")
            ? "The free local AI model is not installed. Run: ollama pull llama3.2:3b"
            : "Free local AI is unavailable. Start Ollama on this computer, then try again.",
        );
      }
      if (res.status === 429) throw new Error("AI is busy right now. Please try again in a moment.");
      if (res.status === 402) throw new Error("AI usage limit reached. Please contact the IT department.");
      throw new Error(`AI unavailable (${res.status}). ${detail.slice(0, 160)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      message?: { content?: string };
    };
    const raw = provider === "ollama" ? (json.message?.content ?? "") : (json.choices?.[0]?.message?.content ?? "");
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("The AI reply could not be read. Please try again.");
      parsed = JSON.parse(match[0]);
    }

    const questions = Array.isArray(parsed?.questions) ? parsed.questions.slice(0, 5) : [];
    return {
      title: String(parsed?.title ?? "").slice(0, 200),
      summary: String(parsed?.summary ?? "").slice(0, 1000),
      category: String(parsed?.category ?? "Safety").slice(0, 60),
      video_url: String(parsed?.video_url ?? "").slice(0, 500),
      questions: questions.map((q: any) => ({
        question: String(q?.question ?? "").slice(0, 400),
        options: (Array.isArray(q?.options) ? q.options : []).slice(0, 4).map((o: any) => String(o).slice(0, 200)),
        correct_index: Number.isInteger(q?.correct_index) ? Math.min(Math.max(q.correct_index, 0), 3) : 0,
        explanation: String(q?.explanation ?? "").slice(0, 600),
      })),
    };
  });
