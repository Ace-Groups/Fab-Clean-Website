/** Marketing site vs customer app subdomain. */

export const MARKETING_ORIGIN = "https://myfabclean.com";
export const APP_ORIGIN = "https://app.myfabclean.com";

const APP_HOSTS = new Set([
  "app.myfabclean.com",
  "app.localhost",
  "localhost", // local: treat ?app=1 or path /dashboard as app; hostname alone stays marketing in dev
]);

export function getHostname(): string {
  if (typeof window === "undefined") return "";
  return window.location.hostname.toLowerCase();
}

/** True when serving the customer portal shell (app.myfabclean.com). */
export function isCustomerAppHost(hostname = getHostname()): boolean {
  if (hostname === "app.myfabclean.com" || hostname.startsWith("app.")) return true;
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("app") === "1") return true;
  }
  return false;
}

export function appUrl(path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined" && isCustomerAppHost()) return clean;
  return `${APP_ORIGIN}${clean}`;
}

export function marketingUrl(path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined" && !isCustomerAppHost()) return clean;
  return `${MARKETING_ORIGIN}${clean}`;
}
