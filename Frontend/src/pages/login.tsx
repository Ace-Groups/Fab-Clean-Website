import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout";
import { Button, Input } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";
import { SEO } from "@/components/seo";
import { BRAND } from "@/lib/brand";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { getApiBaseUrl } from "@/lib/api-base";
import {
  ensureMsg91WidgetScript,
  extractWidgetAccessToken,
  fetchMsg91WidgetConfig,
} from "@/lib/msg91-widget";

export default function Login() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, setToken } = useAuth();
  const [phone, setPhone] = useState("");
  const [isBooting, setIsBooting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const widgetStarted = useRef(false);

  const redirectTarget = useMemo(() => {
    const params = new URLSearchParams(location.split("?")[1] || "");
    return params.get("redirect") || "/dashboard/orders";
  }, [location]);

  useEffect(() => {
    if (isAuthenticated) {
      setLocation(redirectTarget);
    }
  }, [isAuthenticated, redirectTarget, setLocation]);

  async function completeWithAccessToken(accessToken: string, phoneDigits: string) {
    setIsVerifying(true);
    try {
      const base = getApiBaseUrl();
      const response = await fetch(`${base}/api/auth/verify-widget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          accessToken,
          "access-token": accessToken,
          phone: phoneDigits,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message || "Verification failed");
      }
      const token = body?.data?.accessToken || body?.accessToken || body?.token;
      if (!token) throw new Error("No session token returned");
      setToken(token);
      toast({ title: "Signed in", description: "Welcome back to Fab Clean." });
      setLocation(redirectTarget);
    } catch (error) {
      toast({
        title: "Sign-in failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
      widgetStarted.current = false;
    }
  }

  async function startOtpWidget() {
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (digits.length !== 10) {
      toast({
        title: "Enter a valid phone",
        description: "Use your 10-digit Indian mobile number.",
        variant: "destructive",
      });
      return;
    }
    if (widgetStarted.current) return;
    widgetStarted.current = true;
    setIsBooting(true);

    try {
      const config = await fetchMsg91WidgetConfig();
      await ensureMsg91WidgetScript();
      if (!window.initSendOTP) {
        throw new Error("OTP widget failed to initialize");
      }

      window.initSendOTP({
        widgetId: config.widgetId,
        tokenAuth: config.tokenAuth,
        identifier: `91${digits}`,
        exposeMethods: true,
        success: (data: unknown) => {
          const accessToken = extractWidgetAccessToken(data);
          if (!accessToken) {
            toast({
              title: "OTP incomplete",
              description: "No verification token received. Please try again.",
              variant: "destructive",
            });
            widgetStarted.current = false;
            return;
          }
          void completeWithAccessToken(accessToken, digits);
        },
        failure: (error: unknown) => {
          widgetStarted.current = false;
          const message =
            typeof error === "string"
              ? error
              : error && typeof error === "object" && "message" in error
                ? String((error as { message: unknown }).message)
                : "OTP verification was cancelled or failed.";
          toast({ title: "OTP failed", description: message, variant: "destructive" });
        },
      });
    } catch (error) {
      widgetStarted.current = false;
      toast({
        title: "Unable to open OTP",
        description: error instanceof Error ? error.message : "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setIsBooting(false);
    }
  }

  return (
    <AppLayout>
      <SEO
        title="Sign in | Fab Clean"
        description="Sign in with your phone number using a one-time code to track orders and open your portal."
        canonical="https://myfabclean.com/login"
      />

      <div className="page-shell">
        <section className="container-tight section-padding">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-md plane-step p-8 sm:p-10"
          >
            <div className="flex flex-col items-center text-center">
              <BrandLogo imgClassName="h-12 w-auto" />
              <h1 className="mt-6 font-display text-3xl text-ink sm:text-4xl">Sign in with your phone</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                No password. We send a one-time code through MSG91 so you can track orders and open your portal.
              </p>
            </div>

            <div className="mt-8 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-ink" htmlFor="login-phone">
                  Mobile number
                </label>
                <Input
                  id="login-phone"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  placeholder="10-digit mobile"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
                />
              </div>
              <Button
                className="w-full"
                size="lg"
                isLoading={isBooting || isVerifying}
                onClick={() => void startOtpWidget()}
              >
                Continue with OTP
              </Button>
              <p className="text-center text-xs leading-5 text-muted-foreground">
                By continuing you agree to {BRAND.name} contacting you about this order on this number.
              </p>
            </div>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Need a pickup instead?{" "}
              <Link href="/schedule-pickup" className="font-medium text-primary underline-offset-4 hover:underline">
                Schedule pickup
              </Link>
            </p>
          </motion.div>
        </section>
      </div>
    </AppLayout>
  );
}
