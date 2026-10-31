import { useEffect, useMemo, useState } from "react";
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
  extractWidgetAccessToken,
  fetchMsg91WidgetConfig,
  formatMsg91Error,
  initMsg91ExposeMethods,
  retryMsg91Otp,
  sendMsg91Otp,
  verifyMsg91Otp,
} from "@/lib/msg91-widget";

type LoginStep = "phone" | "otp";

export default function Login() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, setSession } = useAuth();
  const [step, setStep] = useState<LoginStep>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const redirectTarget = useMemo(() => {
    const params = new URLSearchParams(location.split("?")[1] || "");
    return params.get("redirect") || "/dashboard/orders";
  }, [location]);

  const phoneDigits = phone.replace(/\D/g, "").slice(-10);
  const maskedPhone =
    phoneDigits.length === 10 ? `******${phoneDigits.slice(-4)}` : phoneDigits;

  useEffect(() => {
    if (isAuthenticated) {
      setLocation(`/welcome?next=${encodeURIComponent(redirectTarget)}`);
    }
  }, [isAuthenticated, redirectTarget, setLocation]);

  async function completeWithAccessToken(accessToken: string, digits: string) {
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
          phone: digits,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message || "Verification failed");
      }
      const token = body?.data?.accessToken || body?.accessToken || body?.token;
      const refresh = body?.data?.refreshToken || body?.refreshToken || null;
      if (!token) throw new Error("No session token returned");
      setSession(token, refresh);
      toast({ title: "Signed in", description: "Welcome back to Fab Clean." });
      setLocation(`/welcome?next=${encodeURIComponent(redirectTarget)}`);
    } catch (error) {
      toast({
        title: "Sign-in failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  }

  async function sendOtpCode() {
    if (phoneDigits.length !== 10) {
      toast({
        title: "Enter a valid phone",
        description: "Use your 10-digit Indian mobile number.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const config = await fetchMsg91WidgetConfig();
      await initMsg91ExposeMethods(config);
      await sendMsg91Otp(`91${phoneDigits}`);
      setOtp("");
      setStep("otp");
      toast({
        title: "OTP sent",
        description: `Enter the code sent to +91 ${maskedPhone}.`,
      });
    } catch (error) {
      toast({
        title: "Unable to send OTP",
        description: formatMsg91Error(error, "Please try again shortly."),
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  }

  async function verifyOtpCode() {
    const code = otp.replace(/\D/g, "");
    if (code.length < 4) {
      toast({
        title: "Enter the OTP",
        description: "Type the one-time code from your message.",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    try {
      const config = await fetchMsg91WidgetConfig();
      await initMsg91ExposeMethods(config);
      const result = await verifyMsg91Otp(code);
      const accessToken = extractWidgetAccessToken(result);
      if (!accessToken) {
        throw new Error("No verification token received. Please try again.");
      }
      await completeWithAccessToken(accessToken, phoneDigits);
    } catch (error) {
      setIsVerifying(false);
      toast({
        title: "OTP failed",
        description: formatMsg91Error(error, "Check the code and try again."),
        variant: "destructive",
      });
    }
  }

  async function resendOtpCode() {
    setIsResending(true);
    try {
      const config = await fetchMsg91WidgetConfig();
      await initMsg91ExposeMethods(config);
      try {
        await retryMsg91Otp(null);
      } catch {
        await sendMsg91Otp(`91${phoneDigits}`);
      }
      toast({
        title: "OTP resent",
        description: `A new code was sent to +91 ${maskedPhone}.`,
      });
    } catch (error) {
      toast({
        title: "Unable to resend",
        description: formatMsg91Error(error, "Please wait a moment and try again."),
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  }

  function goBackToPhone() {
    setStep("phone");
    setOtp("");
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
              <h1 className="mt-6 font-display text-3xl text-ink sm:text-4xl">
                {step === "phone" ? "Sign in with your phone" : "Enter your OTP"}
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {step === "phone"
                  ? "No password. We send a one-time code through MSG91 so you can track orders and open your portal."
                  : `We sent a one-time code to +91 ${maskedPhone}. Demo OTP for test numbers works without SMS.`}
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {step === "phone" ? (
                <>
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
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void sendOtpCode();
                        }
                      }}
                    />
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    isLoading={isSending}
                    onClick={() => void sendOtpCode()}
                  >
                    Continue with OTP
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-ink" htmlFor="login-otp">
                      One-time code
                    </label>
                    <Input
                      id="login-otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      placeholder="Enter OTP"
                      value={otp}
                      autoFocus
                      onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void verifyOtpCode();
                        }
                      }}
                    />
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    isLoading={isVerifying}
                    onClick={() => void verifyOtpCode()}
                  >
                    Verify & sign in
                  </Button>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
                      disabled={isSending || isResending || isVerifying}
                      onClick={goBackToPhone}
                    >
                      Change number
                    </button>
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
                      disabled={isResending || isVerifying}
                      onClick={() => void resendOtpCode()}
                    >
                      {isResending ? "Resending…" : "Resend OTP"}
                    </button>
                  </div>
                </>
              )}
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
