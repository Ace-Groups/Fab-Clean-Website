import { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { fetchStores } from "@/lib/public-api";
import { CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useSchedulePickup } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Button, Input, Textarea } from "@/components/ui";
import { LocationInput } from "@/components/location-input";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_STORES } from "@/lib/site-catalog";
import { BRAND, DEFAULT_PICKUP_SERVICE } from "@/lib/brand";

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
  const [savedAddresses, setSavedAddresses] = useState<string[]>([]);

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
    formState: { errors, isValid },
  } = useForm<PickupForm>({
    resolver: zodResolver(pickupSchema),
    mode: "onChange",
    defaultValues: {
      branch: "",
      timeSlot: getSmartTimeSlot(),
    },
  });

  const { data: storesResponse } = useQuery({
    queryKey: ["stores"],
    queryFn: fetchStores,
  });
  const storesData =
    storesResponse?.data && storesResponse.data.length > 0 ? storesResponse.data : DEFAULT_STORES;

  const handleLocationDetected = (lat: number, lon: number) => {
    if (!storesData.length) return;

    let nearest = storesData[0];
    let minDistance = Infinity;

    const getDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    };

    for (const store of storesData) {
      const d = getDist(lat, lon, store.latitude, store.longitude);
      if (d < minDistance) {
        minDistance = d;
        nearest = store;
      }
    }

    setValue("branch", nearest.slug, { shouldValidate: true });
  };

  const values = watch();
  const phoneVal = watch("phone");

  useEffect(() => {
    if (phoneVal?.length === 10) {
      fetch(`/api/pickups/customer-lookup?phone=${phoneVal}`)
        .then((res) => res.json())
        .then((result) => {
          if (result.success && result.data) {
            if (result.data.name) setValue("name", result.data.name, { shouldValidate: true });
            if (result.data.addresses?.length) {
              setSavedAddresses(result.data.addresses);
              if (!values.address) {
                setValue("address", result.data.addresses[0], { shouldValidate: true });
              }
            } else {
              setSavedAddresses([]);
            }
          }
        })
        .catch(() => undefined);
    }
  }, [phoneVal, setValue]);

  const { mutate: schedule, isPending } = useSchedulePickup({
    mutation: {
      onSuccess: (result) => setSuccess({ ref: result.data.bookingReference, msg: result.data.message }),
      onError: () => {
        toast({
          title: "Unable to schedule pickup",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
      },
    },
  });

  const nextStep = async () => {
    const ok = await trigger(["name", "phone", "address"]);
    if (ok) setStep(2);
  };

  const onSubmit = (formValues: PickupForm) => {
    schedule({
      data: {
        ...formValues,
        services: [DEFAULT_PICKUP_SERVICE],
      } as any,
    });
  };

  if (success) {
    return (
      <AppLayout>
        <SEO
          title="Pickup confirmed | Fab Clean"
          description="Your Fab Clean pickup request has been saved."
          canonical="https://myfabclean.com/schedule-pickup"
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
                <Link href="/login?redirect=%2Fdashboard%2Fbookings">
                  <Button>Sign in to follow along</Button>
                </Link>
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
        description="Book a free Fab Clean pickup with just name, phone, address, and a time window."
        canonical="https://myfabclean.com/schedule-pickup"
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
                1 · Contact
              </span>
              <span aria-hidden="true" className="h-px w-8 bg-line" />
              <span className={cn("rounded-full px-3 py-1", step === 2 ? "bg-primary/12 text-primary" : "bg-muted")}>
                2 · When
              </span>
            </div>

            <div className="plane-step overflow-hidden p-6 sm:p-8">
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
                          {errors.phone ? <p className="mt-2 text-sm text-red-700">{errors.phone.message}</p> : null}
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-ink">Pickup address</label>
                        <LocationInput
                          name="address"
                          placeholder="Full address with landmark"
                          register={register}
                          setValue={setValue}
                          watch={watch}
                          error={errors.address}
                          onLocationDetected={handleLocationDetected}
                        />
                        {savedAddresses.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs text-muted-foreground">Saved addresses</p>
                            <div className="flex flex-wrap gap-2">
                              {savedAddresses.map((addr, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setValue("address", addr, { shouldValidate: true })}
                                  className="rounded-xl border border-line bg-background/50 px-3 py-1.5 text-xs text-ink transition-colors hover:border-primary/40"
                                >
                                  {addr.slice(0, 36)}
                                  {addr.length > 36 ? "…" : ""}
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
                        <Controller
                          name="branch"
                          control={control}
                          render={({ field }) => (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              {storesData.map((store) => (
                                <button
                                  key={store.slug}
                                  type="button"
                                  onClick={() => field.onChange(store.slug)}
                                  className={cn(
                                    "rounded-2xl border px-4 py-3 text-sm capitalize transition-all",
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
