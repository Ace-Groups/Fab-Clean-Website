import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStores } from "@/lib/public-api";
import { DEFAULT_STORES } from "@/lib/site-catalog";
import {
  DEFAULT_STORE_SLUG,
  findNearestStore,
  readVisitorGeo,
  sortStoresNearestFirst,
  writeVisitorGeo,
  type VisitorGeo,
} from "@/lib/geo";

type UseNearestStoreOptions = {
  /** When true, attempt browser geolocation once if no fresh cached coords exist. */
  requestOnMount?: boolean;
};

export function useNearestStore(options: UseNearestStoreOptions = {}) {
  const { requestOnMount = false } = options;
  const [visitorGeo, setVisitorGeo] = useState<VisitorGeo | null>(() => readVisitorGeo());
  const [isLocating, setIsLocating] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);

  const { data: storesResponse } = useQuery({
    queryKey: ["stores"],
    queryFn: fetchStores,
  });

  const stores = useMemo(
    () =>
      storesResponse?.data && storesResponse.data.length > 0
        ? storesResponse.data
        : DEFAULT_STORES,
    [storesResponse],
  );

  const persistCoords = useCallback((lat: number, lng: number, source: VisitorGeo["source"]) => {
    const geo: VisitorGeo = { lat, lng, source, resolvedAt: Date.now() };
    writeVisitorGeo(geo);
    setVisitorGeo(geo);
  }, []);

  const requestBrowserLocation = useCallback(
    (opts?: { highAccuracy?: boolean; silent?: boolean }) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setGeoDenied(true);
        return Promise.resolve(null);
      }

      setIsLocating(true);
      return new Promise<VisitorGeo | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const geo: VisitorGeo = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              source: "browser",
              resolvedAt: Date.now(),
            };
            writeVisitorGeo(geo);
            setVisitorGeo(geo);
            setIsLocating(false);
            resolve(geo);
          },
          (error) => {
            setIsLocating(false);
            if (error.code === error.PERMISSION_DENIED) {
              setGeoDenied(true);
            }
            if (!opts?.silent) {
              resolve(null);
            } else {
              resolve(null);
            }
          },
          {
            enableHighAccuracy: opts?.highAccuracy ?? true,
            timeout: 12000,
            maximumAge: readVisitorGeo() ? 86400000 : 0,
          },
        );
      });
    },
    [],
  );

  useEffect(() => {
    if (!requestOnMount || visitorGeo || geoDenied) return;
    void requestBrowserLocation({ silent: true });
  }, [requestOnMount, visitorGeo, geoDenied, requestBrowserLocation]);

  const nearestStore = useMemo(() => {
    if (visitorGeo) {
      return findNearestStore(stores, visitorGeo.lat, visitorGeo.lng);
    }
    return stores.find((s) => s.slug === DEFAULT_STORE_SLUG) ?? stores[0] ?? null;
  }, [stores, visitorGeo]);

  const storesNearestFirst = useMemo(
    () => sortStoresNearestFirst(stores, nearestStore?.slug ?? null),
    [stores, nearestStore],
  );

  return {
    stores,
    storesNearestFirst,
    nearestStore,
    visitorGeo,
    isLocating,
    geoDenied,
    persistCoords,
    requestBrowserLocation,
  };
}
