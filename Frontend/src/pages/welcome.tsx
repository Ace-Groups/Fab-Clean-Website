import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, Mail, MapPin, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { BrandLogo } from "@/components/brand-logo";
import { SEO } from "@/components/seo";
import { Button, Input } from "@/components/ui";
import { StructuredAddressFields } from "@/components/structured-address-fields";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import {
  EMPTY_STRUCTURED_ADDRESS,
  formatStructuredAddress,
  isStructuredAddressComplete,
  type StructuredAddress,
} from "@/lib/address";
import { fileToAvatarDataUrl } from "@/lib/avatar";
import { track } from "@/lib/analytics";
import {
  PROFILE_GAP_COPY,
  markProfileGapSkipped,
  pendingProfileGaps,
  type ProfileGapId,
} from "@/lib/profile-gaps";
import { fetchPortalProfile, patchPortalProfile, type PortalProfile } from "@/lib/portal-api";

export default function Welcome() {
  const [location, setLocation] = useLocation();
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.split("?")[1] || "");
    const next = params.get("next") || "/dashboard/orders";
    return next.startsWith("/") ? next : "/dashboard/orders";
  }, [location]);

  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gapIndex, setGapIndex] = useState(0);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState<StructuredAddress>({ ...EMPTY_STRUCTURED_ADDRESS });
  const [showAddressErrors, setShowAddressErrors] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const gaps = useMemo(() => pendingProfileGaps(profile), [profile]);
  const activeGap: ProfileGapId | null = gaps[gapIndex] ?? gaps[0] ?? null;
  const copy = activeGap ? PROFILE_GAP_COPY[activeGap] : null;

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLocation(`/login?redirect=${encodeURIComponent(`/welcome?next=${encodeURIComponent(nextPath)}`)}`);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchPortalProfile(token)
      .then((res) => {
        if (cancelled) return;
        setProfile(res.data);
        setName(res.data.name || "");
        setEmail(res.data.email || "");
        setPhotoPreview(res.data.avatarUrl || null);
      })
      .catch(() => {
        if (!cancelled) {
          toast({
            title: "Couldn’t load profile",
            description: "Continuing to your destination.",
            variant: "destructive",
          });
          setLocation(nextPath);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, token, nextPath, setLocation]);

  useEffect(() => {
    if (loading || !profile) return;
    const pending = pendingProfileGaps(profile);
    if (pending.length === 0) {
      setLocation(nextPath);
    }
  }, [loading, profile, nextPath, setLocation]);

  async function refreshProfile() {
    if (!token) return null;
    const res = await fetchPortalProfile(token);
    setProfile(res.data);
    void queryClient.invalidateQueries({ queryKey: ["/api/users/profile"] });
    return res.data;
  }

  function advanceAfterSave(updated: PortalProfile) {
    const remaining = pendingProfileGaps(updated);
    track("profile_gap_saved", { remaining: remaining.length });
    if (remaining.length === 0) {
      toast({ title: "You’re all set", description: "Thanks — heading in." });
      setLocation(nextPath);
      return;
    }
    setGapIndex(0);
    setShowAddressErrors(false);
  }

  async function onSkip() {
    if (!activeGap) return;
    markProfileGapSkipped(activeGap);
    track("profile_gap_skipped", { gap: activeGap });
    const remaining = pendingProfileGaps(profile);
    // pendingProfileGaps now excludes the one we just skipped
    if (remaining.length === 0) {
      setLocation(nextPath);
      return;
    }
    setGapIndex(0);
  }

  async function onSave() {
    if (!token || !activeGap) return;
    setSaving(true);
    try {
      if (activeGap === "name") {
        if (name.trim().length < 2) {
          toast({ title: "Enter your name", variant: "destructive" });
          return;
        }
        const res = await patchPortalProfile(token, { name: name.trim() });
        advanceAfterSave(res.data);
      } else if (activeGap === "email") {
        const trimmed = email.trim();
        if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          toast({ title: "Enter a valid email", variant: "destructive" });
          return;
        }
        if (!trimmed) {
          await onSkip();
          return;
        }
        const res = await patchPortalProfile(token, { email: trimmed });
        advanceAfterSave(res.data);
      } else if (activeGap === "address") {
        setShowAddressErrors(true);
        if (!isStructuredAddressComplete(address)) {
          toast({
            title: "Add a bit more detail",
            description: "House/street, pincode, city, and state help our agent find you.",
            variant: "destructive",
          });
          return;
        }
        const composed = formatStructuredAddress(address);
        const existing = profile?.addresses || [];
        const res = await patchPortalProfile(token, {
          addresses: [...existing.filter((a) => a !== composed), composed],
        });
        advanceAfterSave(res.data);
      } else if (activeGap === "photo") {
        if (!photoPreview) {
          await onSkip();
          return;
        }
        const res = await patchPortalProfile(token, { avatarUrl: photoPreview });
        advanceAfterSave(res.data);
      }
      await refreshProfile();
    } catch (error) {
      toast({
        title: "Couldn’t save",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onPickPhoto(file: File | null) {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setPhotoPreview(dataUrl);
    } catch (error) {
      toast({
        title: "Photo didn’t work",
        description: error instanceof Error ? error.message : "Try another image.",
        variant: "destructive",
      });
    } finally {
      setPhotoBusy(false);
    }
  }

  if (loading || !activeGap || !copy) {
    return (
      <AppLayout>
        <div className="page-shell">
          <section className="container-tight section-padding">
            <div className="mx-auto max-w-md plane-step p-10 text-center text-sm text-muted-foreground">
              Getting things ready…
            </div>
          </section>
        </div>
      </AppLayout>
    );
  }

  const stepNumber = Math.max(1, gaps.indexOf(activeGap) + 1);
  const stepTotal = Math.max(gaps.length, 1);

  return (
    <AppLayout>
      <SEO
        title="Welcome | Fab Clean"
        description="A quick, one-at-a-time profile setup after sign-in."
        canonical="https://myfabclean.com/welcome"
        noIndex
      />

      <div className="page-shell">
        <section className="container-tight section-padding">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-md plane-step overflow-hidden p-8 sm:p-10"
          >
            <div className="flex flex-col items-center text-center">
              <BrandLogo imgClassName="h-10 w-auto" />
              <p className="mt-5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Just one thing · {stepNumber} of {stepTotal}
              </p>
              <div className="mt-3 flex gap-1.5">
                {gaps.map((gap) => (
                  <span
                    key={gap}
                    className={`h-1.5 w-6 rounded-full transition-colors ${
                      gap === activeGap ? "bg-primary" : "bg-line"
                    }`}
                  />
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeGap}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="mt-8"
              >
                <div className="mb-6 flex justify-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {activeGap === "name" ? <User className="h-5 w-5" /> : null}
                    {activeGap === "email" ? <Mail className="h-5 w-5" /> : null}
                    {activeGap === "address" ? <MapPin className="h-5 w-5" /> : null}
                    {activeGap === "photo" ? <Camera className="h-5 w-5" /> : null}
                  </span>
                </div>

                <h1 className="text-center font-display text-3xl text-ink sm:text-[2rem]">{copy.title}</h1>
                <p className="mt-3 text-center text-sm leading-6 text-muted-foreground">{copy.subtitle}</p>

                <div className="mt-8 space-y-4">
                  {activeGap === "name" ? (
                    <Input
                      autoFocus
                      autoComplete="name"
                      placeholder="Your name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void onSave();
                        }
                      }}
                    />
                  ) : null}

                  {activeGap === "email" ? (
                    <Input
                      autoFocus
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void onSave();
                        }
                      }}
                    />
                  ) : null}

                  {activeGap === "address" ? (
                    <StructuredAddressFields
                      value={address}
                      onChange={setAddress}
                      showErrors={showAddressErrors}
                    />
                  ) : null}

                  {activeGap === "photo" ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative h-28 w-28 overflow-hidden rounded-full border border-line bg-background/80">
                        {photoPreview ? (
                          <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Camera className="h-7 w-7" />
                          </div>
                        )}
                      </div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          capture="user"
                          className="sr-only"
                          onChange={(event) => void onPickPhoto(event.target.files?.[0] || null)}
                        />
                        <span className="inline-flex items-center rounded-full border border-line bg-background px-4 py-2 text-sm font-medium text-ink hover:border-primary/40">
                          {photoBusy ? "Processing…" : photoPreview ? "Choose another" : "Choose photo"}
                        </span>
                      </label>
                    </div>
                  ) : null}
                </div>

                <div className="mt-8 flex flex-col gap-3">
                  <Button
                    size="lg"
                    className="w-full"
                    isLoading={saving || photoBusy}
                    onClick={() => void onSave()}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    {copy.cta}
                  </Button>
                  <button
                    type="button"
                    className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-ink hover:underline"
                    disabled={saving}
                    onClick={() => void onSkip()}
                  >
                    {copy.optional ? "Not now" : "Skip for now"}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>

            <p className="mt-8 text-center text-xs text-muted-foreground">
              You can finish anytime in{" "}
              <Link href="/dashboard/profile" className="font-medium text-primary underline-offset-4 hover:underline">
                Profile
              </Link>
              .
            </p>
          </motion.div>
        </section>
      </div>
    </AppLayout>
  );
}
