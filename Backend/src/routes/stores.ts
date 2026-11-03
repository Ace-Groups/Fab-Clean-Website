import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, storesTable } from "@workspace/db";
import { fetchAppStores } from "../lib/supabase-admin.js";

const router: IRouter = Router();

/** Customer-facing branch slugs only (legacy UUID/short-name rows excluded). */
const CANONICAL_STORE_SLUG_ORDER = [
  "pollachi",
  "suleeshwaranpatti",
  "udumalpet",
  "kinathukadavu",
] as const;
const CANONICAL_STORE_SLUGS = new Set<string>(CANONICAL_STORE_SLUG_ORDER);

function isCustomerFacingStore(store: { slug?: string | null; name?: string | null }): boolean {
  const slug = String(store.slug || "").toLowerCase().trim();
  const name = String(store.name || "").trim();
  if (!CANONICAL_STORE_SLUGS.has(slug)) return false;
  // Prefer Fab Clean–prefixed display names; drop legacy short labels (Pollachi, etc.).
  return /^fab\s*clean\s*-/i.test(name);
}

router.get(["/stores", "/erp/website/stores", "/api/erp/website/stores"], async (req, res) => {
  try {
    const [stores, appStores] = await Promise.all([
      db
      .select({
        id: storesTable.id,
        slug: storesTable.slug,
        name: storesTable.name,
        address: storesTable.address,
        phone: storesTable.phone,
        email: storesTable.email,
        latitude: storesTable.latitude,
        longitude: storesTable.longitude,
        coverageRadiusKm: storesTable.coverageRadiusKm,
        mapHref: storesTable.mapHref,
        isActive: storesTable.isActive,
      })
      .from(storesTable)
      .orderBy(asc(storesTable.sortOrder), asc(storesTable.name)),
      fetchAppStores(),
    ]);

    const mergedBySlug = new Map<string, any>();
    for (const store of stores) {
      mergedBySlug.set(store.slug, store);
    }
    for (const appStore of appStores) {
      if (!appStore.slug) continue;
      if (mergedBySlug.has(appStore.slug)) continue;
      mergedBySlug.set(appStore.slug, {
        id: appStore.code || appStore.slug,
        slug: appStore.slug,
        name: appStore.name,
        address: appStore.address || "",
        phone: appStore.phone || "",
        email: appStore.email || "",
        latitude: Number(appStore.latitude ?? 0),
        longitude: Number(appStore.longitude ?? 0),
        coverageRadiusKm: 10,
        mapHref: appStore.map_href || "",
        isActive: appStore.is_active ?? true,
      });
    }

    const isErpRequest = req.path.includes("erp");
    const data = Array.from(mergedBySlug.values())
      .filter((s) => isErpRequest || isCustomerFacingStore(s))
      .sort((a, b) => {
        const aOrder = CANONICAL_STORE_SLUG_ORDER.indexOf(
          String(a.slug).toLowerCase() as (typeof CANONICAL_STORE_SLUG_ORDER)[number],
        );
        const bOrder = CANONICAL_STORE_SLUG_ORDER.indexOf(
          String(b.slug).toLowerCase() as (typeof CANONICAL_STORE_SLUG_ORDER)[number],
        );
        if (aOrder !== -1 && bOrder !== -1) return aOrder - bOrder;
        if (aOrder !== -1) return -1;
        if (bOrder !== -1) return 1;
        return String(a.name).localeCompare(String(b.name));
      });

    res.json({
      success: true,
      data,
    });
  } catch (err: any) {
    req.log.error(err, "Failed to load stores");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to load stores" },
    });
  }
});

// Create Store
router.post(["/stores", "/erp/website/stores", "/api/erp/website/stores"], async (req, res) => {
  try {
    const { name, slug, address, phone, email, latitude, longitude, coverageRadiusKm, mapHref, isActive } = req.body || {};
    if (!name || !address) {
      return res.status(400).json({ success: false, error: "Store name and address are required" });
    }

    const cleanSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).trim();

    const [inserted] = await db
      .insert(storesTable)
      .values({
        name,
        slug: cleanSlug,
        address,
        phone: phone || "93630 59595",
        email: email || null,
        latitude: Number(latitude ?? 10.6677),
        longitude: Number(longitude ?? 77.012),
        coverageRadiusKm: Number(coverageRadiusKm ?? 10),
        mapHref: mapHref || null,
        isActive: isActive !== false,
      })
      .returning();

    res.json({ success: true, message: "Store created successfully", data: inserted });
  } catch (err: any) {
    req.log.error(err, "Failed to create store");
    res.status(500).json({ success: false, error: err.message || "Failed to create store" });
  }
});

// Update Store
router.put(["/stores/:id", "/erp/website/stores/:id", "/api/erp/website/stores/:id"], async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, address, phone, email, latitude, longitude, coverageRadiusKm, mapHref, isActive } = req.body || {};

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (latitude !== undefined) updateData.latitude = Number(latitude);
    if (longitude !== undefined) updateData.longitude = Number(longitude);
    if (coverageRadiusKm !== undefined) updateData.coverageRadiusKm = Number(coverageRadiusKm);
    if (mapHref !== undefined) updateData.mapHref = mapHref;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(storesTable)
      .set(updateData)
      .where(eq(storesTable.id, id))
      .returning();

    res.json({ success: true, message: "Store updated successfully", data: updated });
  } catch (err: any) {
    req.log.error(err, "Failed to update store");
    res.status(500).json({ success: false, error: err.message || "Failed to update store" });
  }
});

export default router;
