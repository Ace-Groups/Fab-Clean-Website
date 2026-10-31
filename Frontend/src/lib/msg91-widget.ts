const SCRIPT_CANDIDATES = [
  "https://verify.msg91.com/otp-provider.js",
  "https://verify.phone91.com/otp-provider.js",
] as const;

declare global {
  interface Window {
    initSendOTP?: (config: Record<string, unknown>) => void;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-msg91-otp="${src}"]`);
    if (existing) {
      if (window.initSendOTP) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.msg91Otp = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export async function ensureMsg91WidgetScript(): Promise<void> {
  if (window.initSendOTP) return;
  if (scriptPromise) return scriptPromise;

  scriptPromise = (async () => {
    let lastError: unknown;
    for (const src of SCRIPT_CANDIDATES) {
      try {
        await loadScript(src);
        if (window.initSendOTP) return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Unable to load MSG91 OTP widget script");
  })();

  try {
    await scriptPromise;
  } catch (error) {
    scriptPromise = null;
    throw error;
  }
}

export type Msg91WidgetSuccess = {
  message?: string;
  accessToken?: string;
  token?: string;
};

export function extractWidgetAccessToken(payload: unknown): string {
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Msg91WidgetSuccess & Record<string, unknown>;
  const candidates = [record.message, record.accessToken, record.token, record["access-token"]];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export type Msg91WidgetConfig = {
  widgetId: string;
  tokenAuth: string;
};

export async function fetchMsg91WidgetConfig(): Promise<Msg91WidgetConfig> {
  const envWidgetId = import.meta.env.VITE_MSG91_WIDGET_ID as string | undefined;
  const envTokenAuth = import.meta.env.VITE_MSG91_TOKEN_AUTH as string | undefined;
  if (envWidgetId && envTokenAuth) {
    return { widgetId: envWidgetId, tokenAuth: envTokenAuth };
  }

  const { getApiBaseUrl } = await import("./api-base");
  const response = await fetch(`${getApiBaseUrl()}/api/auth/otp-widget-config`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("OTP widget is not configured");
  }
  const body = await response.json();
  const widgetId = body?.data?.widgetId || body?.widgetId;
  const tokenAuth = body?.data?.tokenAuth || body?.tokenAuth;
  if (!widgetId || !tokenAuth) {
    throw new Error("OTP widget configuration is incomplete");
  }
  return { widgetId: String(widgetId), tokenAuth: String(tokenAuth) };
}
