import { useEffect, useState, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link } from "wouter";
import { CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight, MapPin, Navigation, User } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useGetProfile, useSchedulePickup } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Button, Input, Textarea } from "@/components/ui";
import { StructuredAddressFields } from "@/components/structured-address-fields";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_STORES } from "@/lib/site-catalog";
import { BRAND, DEFAULT_PICKUP_SERVICE } from "@/lib/brand";
import { findNearestStore } from "@/lib/geo";
import { useNearestStore } from "@/hooks/use-nearest-store";
import { useAuth } from "@/hooks/use-auth";
import { lookupCustomer } from "@/lib/public-api";
import {
  EMPTY_STRUCTURED_ADDRESS,
  formatStructuredAddress,
  isStructuredAddressComplete,
  parseAddressString,
  type StructuredAddress,
} from "@/lib/address";
import { track, trackPageView } from "@/lib/analytics";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const pickupSchema = z.object({
  name: z.string().min(2, "Enter your name"),
  phone: z.string().length(10, "Enter a 10-digit phone number"),
  address: z.string().min(10, "Enter the full pickup address"),
  preferredDate: z.string().min(1, "Pick a date"),
  timeSlot: z.enum(["morning", "afternoon", "evening"]),
  branch: z.string().min(1, "Select a branch"),
  specialInstructions: z.string().optional(),
});

type PickupForm = z.infer<typeof pickupSchema>;

function CustomDatePicker({
  value,
  onChange,
  minDate,
}: {
  value: string;
  onChange: (val: string) => void;
  minDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-12 w-full items-center justify-between rounded-[1.1rem] border border-line bg-background/80 px-4 text-sm text-ink outline-none transition focus:border-primary/45 focus:ring-4 focus:ring-primary/10 hover:border-primary/30 hover:bg-background",
          !value && "text-muted-foreground/80",
        )}
      >
        {value ? format(new Date(value), "PPP") : <span>Pick a date</span>}
        <CalendarIcon className="h-4 w-4 opacity-50" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 p-0"
          >
            <Calendar
              mode="single"
              selected={value ? new Date(value) : undefined}
              onSelect={(date) => {
                if (date) {
                  const d = new Date(date);
                  const tzOffset = d.getTimezoneOffset() * 60000;
                  const localDate = new Date(d.getTime() - tzOffset);
                  onChange(localDate.toISOString().split("T")[0]);
                  setOpen(false);
                }
              }}
              disabled={minDate ? (date) => date < minDate : undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SchedulePickup() {
  const [step, setStep] = useState(1);
  const [success, setSuccess] = useState<{ ref: string; msg: string } | null>(null);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { data: profileResponse } = useGetProfile({
    query: { enabled: isAuthenticated, retry: false } as never,
  });
  const profile = profileResponse?.data as
    | { name?: string; phone?: string; addresses?: string[] }
    | undefined;

  const [structuredAddress, setStructuredAddress] = useState<StructuredAddress>({
    ...EMPTY_STRUCTURED_ADDRESS,
  });
  const [showAddressErrors, setShowAddressErrors] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const branchManualOverride = useRef(false);
  const [autoBranchSlug, setAutoBranchSlug] = useState<string | null>(null);
  const [showGeoPrompt, setShowGeoPrompt] = useState(false);
  const geoPromptDismissed = useRef(false);
  const profilePrefillDone = useRef(false);

  const {
    stores: storesData,
    persistCoords,
    requestBrowserLocation,
    isLocating,
    visitorGeo,
  } = useNearestStore({ requestOnMount: true });

  const getSmartTimeSlot = () => {
    const hour = new Date().getHours();
    if (hour < 11) return "afternoon" as const;
    if (hour < 15) return "evening" as const;
    return "morning" as const;
  };

  const {
    control,
    register,
    handleSubmit,
    watch,
    trigger,
    setValue,
    getValues,
    formState: { errors, isValid },
  } = useForm<PickupForm>({
    resolver: zodResolver(pickupSchema),
    mode: "onChange",
    defaultValues: {
      branch: "",
      timeSlot: getSmartTimeSlot(),
      name: "",
      phone: "",
      address: "",
    },
  });

  const applyNearestBranch = useCallback(
    (lat: number, lon: number, opts?: { force?: boolean }) => {
      const list = storesData.length ? storesData : DEFAULT_STORES;
      const nearest = findNearestStore(list, lat, lon);
      if (!nearest) return;
      setAutoBranchSlug(nearest.slug);
      if (!branchManualOverride.current || opts?.force) {
        setValue("branch", nearest.slug, { shouldValidate: true });
      }
    },
    [setValue, storesData],
  );

  const handleCoords = useCallback(
    (lat: number, lon: number) => {
      setCoords({ lat, lng: lon });
      persistCoords(lat, lon, "address");
      applyNearestBranch(lat, lon);
    },
    [applyNearestBranch, persistCoords],
  );

  const values = watch();
  const phoneVal = watch("phone");

  useEffect(() => {
    trackPageView("/schedule-pickup", "Schedule Pickup | Fab Clean");
  }, []);

  useEffect(() => {
    if (visitorGeo && !branchManualOverride.current) {
      applyNearestBranch(visitorGeo.lat, visitorGeo.lng);
    }
  }, [visitorGeo, applyNearestBranch]);

  useEffect(() => {
    if (visitorGeo || geoPromptDismissed.current) return;
    const timer = window.setTimeout(() => setShowGeoPrompt(true), 600);
    return () => window.clearTimeout(timer);
  }, [visitorGeo]);

  // Logged-in: skip re-asking name/phone; prefill identity + saved addresses.
  useEffect(() => {
    if (!isAuthenticated || !profile || profilePrefillDone.current) return;
    profilePrefillDone.current = true;

    const phone = String(profile.phone || "").replace(/\D/g, "").slice(-10);
    const name = String(profile.name || "").trim();
    if (name) setValue("name", name, { shouldValidate: true });
    if (phone.length === 10) setValue("phone", phone, { shouldValidate: true });

    const addresses = Array.isArray(profile.addresses) ? profile.addresses.filter(Boolean) : [];
    setSavedAddresses(addresses);
    if (addresses[0]) {
      const parsed = parseAddressString(addresses[0]);
      setStructuredAddress(parsed);
      setValue("address", formatStructuredAddress(parsed) || addresses[0], { shouldValidate: true });
    }
    track("pickup_authed_prefill", { has_address: addresses.length > 0 });
  }, [isAuthenticated, profile, setValue]);

  useEffect(() => {
    const composed = formatStructuredAddress(structuredAddress);
    if (composed.length >= 10) {
      setValue("address", composed, { shouldValidate: true });
    } else if (!composed) {
      setValue("address", "", { shouldValidate: true });
    }
  }, [structuredAddress, setValue]);

  useEffect(() => {
    if (isAuthenticated) return;
    if (phoneVal?.length !== 10) return;

    let cancelled = false;
    void lookupCustomer(phoneVal).then((data) => {
      if (cancelled || !data) return;
      if (data.name) setValue("name", data.name, { shouldValidate: true });
      if (data.addresses?.length) {
        setSavedAddresses(data.addresses);
        if (!getValues("address") && data.addresses[0]) {
          const parsed = parseAddressString(data.addresses[0]);
          setStructuredAddress(parsed);
          setValue("address", formatStructuredAddress(parsed) || data.addresses[0], {
            shouldValidate: true,
          });
        }
      } else {
        setSavedAddresses([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [phoneVal, isAuthenticated, setValue, getValues]);

  const { mutate: schedule, isPending } = useSchedulePickup({
    mutation: {
      onSuccess: (result) => {
        track("pickup_booked", { branch: getValues("branch") });
        setSuccess({ ref: result.data.bookingReference, msg: result.data.message });
      },
      onError: () => {
        track("pickup_book_failed");
        toast({
          title: "Unable to schedule pickup",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
      },
    },
  });

  const nextStep = async () => {
    setShowAddressErrors(true);
    if (!isStructuredAddressComplete(structuredAddress)) {
      toast({
        title: "Complete the address",
        description: "House/street, pincode, city, and state are required.",
        variant: "destructive",
      });
      return;
    }

    const composed = formatStructuredAddress(structuredAddress);
    setValue("address", composed, { shouldValidate: true });

    const fields = isAuthenticated ? (["address"] as const) : (["name", "phone", "address"] as const);
    const ok = await trigger([...fields]);
    if (!ok) return;

    const geo = coords || visitorGeo;
    if (geo) {
      applyNearestBranch(geo.lat, geo.lng);
    }

    track("pickup_step", { step: 2, authed: isAuthenticated });
    setStep(2);
  };

  const onSubmit = (formValues: PickupForm) => {
    schedule({
      data: {
        ...formValues,
        address: formatStructuredAddress(structuredAddress) || formValues.address,
        addressLat: coords?.lat ?? visitorGeo?.lat,
        addressLng: coords?.lng ?? visitorGeo?.lng,
        services: [DEFAULT_PICKUP_SERVICE],
      } as never,
    });
  };

  if (success) {
    return (
      <AppLayout>
        <SEO
          title="Pickup confirmed | Fab Clean"
          description="Your Fab Clean pickup request has been saved."
          canonical="https://myfabclean.com/schedule-pickup"
          keywords="Fab Clean pickup confirmed, laundry booking Pollachi"
        />
        <div className="page-shell">
          <section className="container-tight section-padding">
            <div className="plane-step p-8 text-center sm:p-10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h1 className="mt-6 font-display text-4xl text-ink sm:text-5xl">You are on the list</h1>
              <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">{success.msg}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Our agent will note garments at pickup and confirm details with you before service starts.
              </p>
              <div className="mt-8 rounded-2xl border border-line bg-background/70 p-5">
                <p className="ticket-mark justify-center">Booking reference</p>
                <p className="mt-3 text-2xl font-semibold text-ink">{success.ref}</p>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                {isAuthenticated ? (
                  <Link href="/dashboard/bookings">
                    <Button>Open bookings</Button>
                  </Link>
                ) : (
                  <Link href="/login?redirect=%2Fdashboard%2Fbookings">
                    <Button>Sign in to follow along</Button>
                  </Link>
                )}
                <Link href="/">
                  <Button variant="outline">Back home</Button>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <SEO
        title="Schedule Pickup | Fab Clean"
        description="Book a free Fab Clean pickup. Signed-in customers skip name and phone — we use your profile and nearest branch."
        canonical="https://myfabclean.com/schedule-pickup"
        keywords="schedule laundry pickup Pollachi, Fab Clean free pickup, dry cleaning booking Kinathukadavu, Udumalpet laundry pickup"
        schema={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Fab Clean Pickup",
          provider: { "@type": "LocalBusiness", name: "Fab Clean", url: "https://myfabclean.com" },
          areaServed: ["Pollachi", "Kinathukadavu", "Udumalpet", "Suleeshwaranpatti"],
        }}
      />

      <div className="page-shell">
        <section className="container-tight section-padding">
          <div className="mx-auto w-full max-w-xl">
            <div className="mb-8 text-center">
              <h1 className="font-display text-4xl text-ink sm:text-5xl">Schedule pickup</h1>
              <p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted-foreground">
                {BRAND.bookingPromise}
              </p>
            </div>

            <div className="mb-6 flex items-center justify-center gap-3 text-sm text-muted-foreground">
              <span className={cn("rounded-full px-3 py-1", step === 1 ? "bg-primary/12 text-primary" : "bg-muted")}>
                1 · {isAuthenticated ? "Address" : "Contact"}
              </span>
              <span aria-hidden="true" className="h-px w-8 bg-line" />
              <span className={cn("rounded-full px-3 py-1", step === 2 ? "bg-primary/12 text-primary" : "bg-muted")}>
                2 · When
              </span>
            </div>

            <div className="plane-step overflow-hidden p-6 sm:p-8">
              <Dialog
                open={showGeoPrompt}
                onOpenChange={(open) => {
                  setShowGeoPrompt(open);
                  if (!open) geoPromptDismissed.current = true;
                }}
              >
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Navigation className="h-5 w-5 text-primary" />
                      Find your nearest branch
                    </DialogTitle>
                    <DialogDescription className="pt-2 text-base">
                      Allow location once so we can pre-select the closest Fab Clean branch for pickup. You can change
                      it on the next step.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="mt-4 flex gap-3 sm:justify-start">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        geoPromptDismissed.current = true;
                        setShowGeoPrompt(false);
                      }}
                    >
                      Not now
                    </Button>
                    <Button
                      type="button"
                      isLoading={isLocating}
                      onClick={() => {
                        void requestBrowserLocation().then((geo) => {
                          if (geo) applyNearestBranch(geo.lat, geo.lng);
                          geoPromptDismissed.current = true;
                          setShowGeoPrompt(false);
                        });
                      }}
                    >
                      Use my location
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <form onSubmit={handleSubmit(onSubmit)}>
                <AnimatePresence mode="wait">
                  {step === 1 ? (
                    <motion.div
                      key="pickup-step-1"
                      initial={{ opacity: 0, x: 28 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -28 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="space-y-4"
                    >
                      {isAuthenticated ? (
                        <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/8 px-4 py-3">
                          <User className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <div className="min-w-0 text-sm">
                            <p className="font-medium text-ink">
                              Booking as {values.name || profile?.name || "you"}
                            </p>
                            <p className="mt-0.5 text-muted-foreground">
                              +91 {values.phone || String(profile?.phone || "").slice(-10)} · name &amp; phone from
                              your profile
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-ink">Name</label>
                            <Input placeholder="Your name" {...register("name")} autoComplete="name" />
                            {errors.name ? <p className="mt-2 text-sm text-red-700">{errors.name.message}</p> : null}
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-ink">Phone</label>
                            <Input
                              placeholder="10-digit mobile"
                              maxLength={10}
                              inputMode="numeric"
                              autoComplete="tel"
                              {...register("phone")}
                              onInput={(event) => {
                                const target = event.currentTarget as HTMLInputElement;
                                target.value = target.value.replace(/\D/g, "").slice(0, 10);
                              }}
                            />
                            {errors.phone ? (
                              <p className="mt-2 text-sm text-red-700">{errors.phone.message}</p>
                            ) : null}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="mb-2 block text-sm font-medium text-ink">Pickup address</label>
                        <StructuredAddressFields
                          value={structuredAddress}
                          onChange={setStructuredAddress}
                          onCoords={handleCoords}
                          showErrors={showAddressErrors}
                        />
                        {savedAddresses.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <p className="text-xs text-muted-foreground">Saved addresses</p>
                            <div className="flex flex-wrap gap-2">
                              {savedAddresses.map((addr, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    const parsed = parseAddressString(addr);
                                    setStructuredAddress(parsed);
                                    setValue("address", formatStructuredAddress(parsed) || addr, {
                                      shouldValidate: true,
                                    });
                                  }}
                                  className="rounded-xl border border-line bg-background/50 px-3 py-1.5 text-xs text-ink transition-colors hover:border-primary/40"
                                >
                                  {addr.slice(0, 42)}
                                  {addr.length > 42 ? "…" : ""}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="pickup-step-2"
                      initial={{ opacity: 0, x: 28 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -28 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="space-y-5"
                    >
                      <div>
                        <label className="mb-2 block text-sm font-medium text-ink">Preferred date</label>
                        <Controller
                          name="preferredDate"
                          control={control}
                          render={({ field }) => (
                            <CustomDatePicker
                              value={field.value}
                              onChange={field.onChange}
                              minDate={new Date(new Date().setHours(0, 0, 0, 0))}
                            />
                          )}
                        />
                        {errors.preferredDate ? (
                          <p className="mt-2 text-sm text-red-700">{errors.preferredDate.message}</p>
                        ) : null}
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-ink">Branch</label>
                        {autoBranchSlug && values.branch === autoBranchSlug ? (
                          <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            Nearest branch:{" "}
                            <span className="font-medium text-ink">
                              {storesData.find((s) => s.slug === autoBranchSlug)?.name ??
                                DEFAULT_STORES.find((s) => s.slug === autoBranchSlug)?.name}
                            </span>
                          </p>
                        ) : null}
                        <Controller
                          name="branch"
                          control={control}
                          render={({ field }) => (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              {(storesData.length ? storesData : DEFAULT_STORES).map((store) => (
                                <button
                                  key={store.slug}
                                  type="button"
                                  onClick={() => {
                                    branchManualOverride.current = true;
                                    field.onChange(store.slug);
                                  }}
                                  className={cn(
                                    "rounded-2xl border px-4 py-3 text-left text-sm transition-all",
                                    field.value === store.slug
                                      ? "border-primary bg-primary/10 font-semibold text-primary"
                                      : "border-line bg-background/70 text-ink hover:border-primary/40",
                                  )}
                                >
                                  {store.name}
                                </button>
                              ))}
                            </div>
                          )}
                        />
                        {errors.branch ? <p className="mt-2 text-sm text-red-700">{errors.branch.message}</p> : null}
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-ink">Time window</label>
                        <Controller
                          name="timeSlot"
                          control={control}
                          render={({ field }) => (
                            <div className="grid gap-3 sm:grid-cols-3">
                              {[
                                { id: "morning", label: "Morning", meta: "10 AM – 1 PM" },
                                { id: "afternoon", label: "Afternoon", meta: "1 – 4 PM" },
                                { id: "evening", label: "Evening", meta: "4 – 8 PM" },
                              ].map((slot) => (
                                <button
                                  key={slot.id}
                                  type="button"
                                  onClick={() => field.onChange(slot.id)}
                                  className={cn(
                                    "rounded-2xl border px-4 py-4 text-left transition-all",
                                    field.value === slot.id
                                      ? "border-primary bg-primary/10 shadow-sm"
                                      : "border-line bg-background/70 hover:border-primary/40",
                                  )}
                                >
                                  <p
                                    className={cn(
                                      "font-medium",
                                      field.value === slot.id ? "text-primary" : "text-ink",
                                    )}
                                  >
                                    {slot.label}
                                  </p>
                                  <p className="mt-1 text-sm text-muted-foreground">{slot.meta}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-ink">Note for the agent (optional)</label>
                        <Textarea
                          placeholder="Gate code, preferred contact, anything helpful"
                          {...register("specialInstructions")}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  {step > 1 ? (
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Back
                    </Button>
                  ) : (
                    <span />
                  )}
                  {step < 2 ? (
                    <Button type="button" onClick={() => void nextStep()}>
                      Continue
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" isLoading={isPending} disabled={!isValid}>
                      Confirm pickup
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
