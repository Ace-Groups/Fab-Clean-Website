import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetProfile, setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { getApiBaseUrl } from "@/lib/api-base";

setBaseUrl(getApiBaseUrl());

const TOKEN_KEY = "fabclean_token";
const REFRESH_KEY = "fabclean_refresh";
const LAST_ACCESS_KEY = "fabclean_last_access";
/** Stay signed in across visits; sign out only after 30 days without activity. */
const IDLE_MS = 30 * 24 * 60 * 60 * 1000;

interface AuthContextType {
  token: string | null;
  setToken: (token: string | null) => void;
  /** Persist access + refresh so the next visit stays signed in. */
  setSession: (accessToken: string, refreshToken?: string | null) => void;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readIdleExpired(): boolean {
  const raw = localStorage.getItem(LAST_ACCESS_KEY);
  if (!raw) return false;
  const last = Number(raw);
  return Number.isFinite(last) && Date.now() - last > IDLE_MS;
}

function clearSessionStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(LAST_ACCESS_KEY);
}

function touchLastAccess() {
  localStorage.setItem(LAST_ACCESS_KEY, String(Date.now()));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [token, setTokenState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    if (readIdleExpired()) {
      clearSessionStorage();
      return null;
    }
    return localStorage.getItem(TOKEN_KEY);
  });
  const queryClient = useQueryClient();
  const bootstrapped = useRef(false);

  const logout = useCallback(() => {
    clearSessionStorage();
    setTokenState(null);
    queryClient.clear();
    setLocation("/");
  }, [queryClient, setLocation]);

  const setSession = useCallback((accessToken: string, refreshToken?: string | null) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    touchLastAccess();
    setTokenState(accessToken);
  }, []);

  const setToken = useCallback(
    (newToken: string | null) => {
      if (newToken) {
        setSession(newToken);
      } else {
        clearSessionStorage();
        setTokenState(null);
      }
    },
    [setSession],
  );

  useEffect(() => {
    setAuthTokenGetter(() => token);
  }, [token]);

  // Refresh access JWT on load using stored 30d refresh token (cookie may fail cross-origin).
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    if (readIdleExpired()) {
      clearSessionStorage();
      setTokenState(null);
      return;
    }

    const refresh = localStorage.getItem(REFRESH_KEY);
    if (!refresh) {
      if (localStorage.getItem(TOKEN_KEY)) touchLastAccess();
      return;
    }

    const base = getApiBaseUrl();
    void fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    })
      .then(async (response) => {
        if (!response.ok) {
          clearSessionStorage();
          setTokenState(null);
          return;
        }
        const body = await response.json().catch(() => ({}));
        const access =
          body?.data?.accessToken || body?.accessToken || body?.token || null;
        const nextRefresh = body?.data?.refreshToken || body?.refreshToken || refresh;
        if (typeof access === "string" && access) {
          setSession(access, typeof nextRefresh === "string" ? nextRefresh : refresh);
        }
      })
      .catch(() => {
        /* keep existing access token if refresh network fails */
        touchLastAccess();
      });
  }, [setSession]);

  // 30-day inactivity clock
  useEffect(() => {
    if (!token) return;

    if (readIdleExpired()) {
      logout();
      return;
    }
    touchLastAccess();

    let throttleTimer: number | null = null;
    const handleActivity = () => {
      if (throttleTimer) return;
      throttleTimer = window.setTimeout(() => {
        if (readIdleExpired()) {
          logout();
        } else {
          touchLastAccess();
        }
        throttleTimer = null;
      }, 10_000);
    };

    const events = ["mousedown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((event) => document.addEventListener(event, handleActivity, { passive: true }));
    return () => {
      if (throttleTimer) window.clearTimeout(throttleTimer);
      events.forEach((event) => document.removeEventListener(event, handleActivity));
    };
  }, [token, logout]);

  return (
    <AuthContext.Provider value={{ token, setToken, setSession, isAuthenticated: !!token, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function useRequireAuth() {
  const { isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const { data: profile, isLoading } = useGetProfile({
    query: {
      enabled: isAuthenticated,
      retry: false,
    } as never,
  });

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !profile)) {
      const t = setTimeout(() => {
        const redirectTarget = location.split("?")[0] || "/";
        setLocation(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
      }, 100);
      return () => clearTimeout(t);
    }
    return () => {};
  }, [isAuthenticated, location, profile, isLoading, setLocation]);

  return { profile: profile?.data, isLoading };
}
