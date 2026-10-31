import type { Store } from "./site-catalog";

const EARTH_RADIUS_KM = 6371;
export const VISITOR_GEO_STORAGE_KEY = "fab_clean_visitor_geo_v1";
export const VISITOR_GEO_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_STORE_SLUG = "pollachi";

export type VisitorGeo = {
  lat: number;
  lng: number;
  resolvedAt: number;
  source: "browser" | "address" | "cache";
};

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return EARTH_RADIUS_KM * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function findNearestStore(stores: Store[], lat: number, lng: number): Store | null {
  if (!stores.length) return null;

  let nearest = stores[0];
  let minDistance = Infinity;

  for (const store of stores) {
    const d = haversineDistanceKm(lat, lng, store.latitude, store.longitude);
    if (d < minDistance) {
      minDistance = d;
      nearest = store;
    }
  }

  return nearest;
}

export function readVisitorGeo(): VisitorGeo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(VISITOR_GEO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VisitorGeo;
    if (
      typeof parsed.lat !== "number" ||
      typeof parsed.lng !== "number" ||
      typeof parsed.resolvedAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.resolvedAt > VISITOR_GEO_MAX_AGE_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeVisitorGeo(geo: Omit<VisitorGeo, "resolvedAt"> & { resolvedAt?: number }) {
  if (typeof window === "undefined") return;
  const payload: VisitorGeo = {
    lat: geo.lat,
    lng: geo.lng,
    source: geo.source,
    resolvedAt: geo.resolvedAt ?? Date.now(),
  };
  localStorage.setItem(VISITOR_GEO_STORAGE_KEY, JSON.stringify(payload));
}

export function sortStoresNearestFirst(stores: Store[], nearestSlug: string | null): Store[] {
  if (!nearestSlug) return stores;
  const copy = [...stores];
  copy.sort((a, b) => {
    if (a.slug === nearestSlug) return -1;
    if (b.slug === nearestSlug) return 1;
    return 0;
  });
  return copy;
}

export function storeRegionKeywords(slug: string): string[] {
  switch (slug) {
    case "pollachi":
      return ["pollachi", "mahalingapuram", "flagship"];
    case "suleeshwaranpatti":
      return ["suleeshwaranpatti", "suleshwaranpatti", "kottur"];
    case "udumalpet":
      return ["udumalpet", "udumalaipettai", "udumalapettai"];
    case "kinathukadavu":
      return ["kinathukadavu", "kenathukadavu", "vadaputhur", "krishnasamy"];
    default:
      return [slug.replace(/-/g, " ")];
  }
}
