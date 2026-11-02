import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { isCustomerAppHost } from "@/lib/site-hosts";

/** On app.myfabclean.com, send bare `/` into the portal. */
export function AppHostGate() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, sessionReady } = useAuth();

  useEffect(() => {
    if (!isCustomerAppHost() || !sessionReady) return;
    if (location === "/" || location === "") {
      setLocation(isAuthenticated ? "/dashboard" : "/login");
    }
  }, [location, isAuthenticated, sessionReady, setLocation]);

  return null;
}
