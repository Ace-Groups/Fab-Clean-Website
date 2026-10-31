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

router.get("/stores", async (req, res) => {
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
      })
      .from(storesTable)
      .where(eq(storesTable.isActive, true))
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
      });
    }

    const data = Array.from(mergedBySlug.values())
      .filter(isCustomerFacingStore)
      .sort((a, b) => {
        const aOrder = CANONICAL_STORE_SLUG_ORDER.indexOf(
          String(a.slug).toLowerCase() as (typeof CANONICAL_STORE_SLUG_ORDER)[number],
        );
        const bOrder = CANONICAL_STORE_SLUG_ORDER.indexOf(
          String(b.slug).toLowerCase() as (typeof CANONICAL_STORE_SLUG_ORDER)[number],
        );
        return aOrder - bOrder;
      });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    req.log.error(err, "Failed to load stores");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to load stores" },
    });
  }
});

export default router;
