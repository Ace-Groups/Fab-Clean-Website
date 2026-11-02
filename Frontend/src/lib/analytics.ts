/**
 * Lightweight first-party analytics.
 * - Always records page/time events in-memory for this session.
 * - Mirrors to GA4 / gtag only when VITE_GA_MEASUREMENT_ID is set (free tier).
 * Never send phone numbers, OTPs, or full addresses.
 */

type AnalyticsProps = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const sessionEvents: Array<{ name: string; props: AnalyticsProps; at: number }> = [];
const pageEnteredAt = new Map<string, number>();

function gaId(): string | undefined {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
  return id?.trim() || undefined;
}

function ensureGtag(measurementId: string) {
  if (typeof window === "undefined") return;
  if (typeof window.gtag === "function") return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });

  if (!document.querySelector(`script[data-fc-ga="${measurementId}"]`)) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.dataset.fcGa = measurementId;
    document.head.appendChild(script);
  }
}

export function track(event: string, props: AnalyticsProps = {}) {
  const cleaned: AnalyticsProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    cleaned[key] = value;
  }
  sessionEvents.push({ name: event, props: cleaned, at: Date.now() });

  const id = gaId();
  if (!id || typeof window === "undefined") return;
  try {
    ensureGtag(id);
    window.gtag?.("event", event, cleaned);
  } catch {
    /* never break UX for analytics */
  }
}

export function trackPageView(path: string, title?: string) {
  const previous = [...pageEnteredAt.entries()][0];
  if (previous) {
    const [prevPath, started] = previous;
    const seconds = Math.round((Date.now() - started) / 1000);
    if (seconds > 0) {
      track("page_time", { path: prevPath, seconds });
    }
    pageEnteredAt.clear();
  }
  pageEnteredAt.set(path, Date.now());
  track("page_view", { path, title: title || document.title });
}

export function getSessionAnalyticsSnapshot() {
  return [...sessionEvents];
}
