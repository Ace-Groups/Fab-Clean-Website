const SCRIPT_CANDIDATES = [
  "https://verify.msg91.com/otp-provider.js",
  "https://verify.phone91.com/otp-provider.js",
] as const;

export type Msg91WidgetCallback = (payload: unknown) => void;

declare global {
  interface Window {
    initSendOTP?: (config: Record<string, unknown>) => void;
    sendOtp?: (identifier: string, success?: Msg91WidgetCallback, failure?: Msg91WidgetCallback) => void;
    verifyOtp?: (
      otp: string | number,
      success?: Msg91WidgetCallback,
      failure?: Msg91WidgetCallback,
      reqId?: string,
    ) => void;
    retryOtp?: (
      channel: string | null,
      success?: Msg91WidgetCallback,
      failure?: Msg91WidgetCallback,
      reqId?: string,
    ) => void;
    getWidgetData?: () => unknown;
  }
}

let scriptPromise: Promise<void> | null = null;
let methodsInitialized = false;

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

function looksLikeJwt(value: string): boolean {
  const parts = value.split(".");
  return parts.length >= 3 && parts.every((part) => part.length > 0);
}

export type Msg91WidgetSuccess = {
  message?: string;
  accessToken?: string;
  token?: string;
};

/** Prefer explicit access-token fields; only fall back to message when it looks like a JWT. */
export function extractWidgetAccessToken(payload: unknown): string {
  if (typeof payload === "string" && payload.trim()) {
    const trimmed = payload.trim();
    return looksLikeJwt(trimmed) ? trimmed : "";
  }
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Msg91WidgetSuccess & Record<string, unknown>;
  const preferred = [record.accessToken, record.token, record["access-token"]];
  for (const value of preferred) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  if (typeof record.message === "string" && looksLikeJwt(record.message.trim())) {
    return record.message.trim();
  }
  return "";
}

export function formatMsg91Error(error: unknown, fallback = "OTP request failed."): string {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    for (const key of ["message", "error", "msg", "reason"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return fallback;
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
    credentials: "omit",
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** initSendOTP with exposeMethods:true — no MSG91 overlay; use window.sendOtp / verifyOtp. */
export async function initMsg91ExposeMethods(config: Msg91WidgetConfig): Promise<void> {
  await ensureMsg91WidgetScript();
  if (!window.initSendOTP) {
    throw new Error("OTP widget failed to initialize");
  }

  if (!methodsInitialized || !window.sendOtp || !window.verifyOtp) {
    window.initSendOTP({
      widgetId: config.widgetId,
      tokenAuth: config.tokenAuth,
      exposeMethods: true,
    });
    methodsInitialized = true;
  }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (typeof window.sendOtp === "function" && typeof window.verifyOtp === "function") {
      return;
    }
    await sleep(50);
  }

  throw new Error("OTP methods are not available. Please refresh and try again.");
}

export function sendMsg91Otp(identifier: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (typeof window.sendOtp !== "function") {
      reject(new Error("OTP send is not ready"));
      return;
    }
    window.sendOtp(identifier, resolve, reject);
  });
}

export function verifyMsg91Otp(otp: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (typeof window.verifyOtp !== "function") {
      reject(new Error("OTP verify is not ready"));
      return;
    }
    window.verifyOtp(otp, resolve, reject);
  });
}

export function retryMsg91Otp(channel: string | null = null): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (typeof window.retryOtp !== "function") {
      reject(new Error("OTP resend is not ready"));
      return;
    }
    window.retryOtp(channel, resolve, reject);
  });
}
