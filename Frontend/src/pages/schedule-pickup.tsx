import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { fetchStores } from "@/lib/public-api";
import { CheckCircle2, ChevronLeft, ChevronRight, Sparkles, Scale, Footprints, Briefcase, Home, Shirt, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useListServices, useSchedulePickup } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Button, Input, Textarea } from "@/components/ui";
import { FormPanel } from "@/components/site";
import { LocationInput } from "@/components/location-input";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_SERVICES, DEFAULT_STORES } from "@/lib/site-catalog";

const pickupSchema = z.object({
  name: z.string().min(2, "Enter your name"),
  phone: z.string().length(10, "Enter a 10-digit phone number"),
  address: z.string().min(10, "Enter the full pickup address"),
  services: z.array(z.string()).min(1, "Select at least one service"),
  preferredDate: z.string().min(1, "Pick a date"),
  timeSlot: z.enum(["morning", "afternoon", "evening"]),
  branch: z.string().min(1, "Select a branch"),
  specialInstructions: z.string().optional(),
});

type PickupForm = z.infer<typeof pickupSchema>;

const steps = [
  { label: "Contact", title: "Customer details and pickup location." },
  { label: "Services", title: "Select the categories in the order." },
  { label: "Schedule", title: "Choose branch, slot, and date." },
];

function CustomDatePicker({ value, onChange, minDate }: { value: string; onChange: (val: string) => void; minDate?: Date }) {
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
          !value && "text-muted-foreground/80"
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
                  // Keep timezone exact by using the date object and formatting it properly
                  const d = new Date(date);
                  // Adjust for timezone offset if necessary to avoid previous day bugs
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
  const { data: servicesData } = useListServices();
  const rawServices = ((Array.isArray(servicesData) ? (servicesData as any) : servicesData?.data) || []);
  const availableServices = rawServices.length > 0 ? rawServices : DEFAULT_SERVICES;
  const { toast } = useToast();

  const getSmartTimeSlot = () => {
    const hour = new Date().getHours();
    if (hour < 11) return "afternoon";
    if (hour < 15) return "evening";
    return "morning"; // Usually next day
  };

  const [savedAddresses, setSavedAddresses] = useState<string[]>([]);

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
      services: [],
      branch: "",
      timeSlot: getSmartTimeSlot(),
    },
  });

  const { data: storesResponse } = useQuery({
    queryKey: ["stores"],
    queryFn: fetchStores,
  });
  const storesData = (storesResponse?.data && storesResponse.data.length > 0) ? storesResponse.data : DEFAULT_STORES;

  const handleLocationDetected = (lat: number, lon: number) => {
    if (!storesData.length) return;
    
    // Find nearest store
    let nearest = storesData[0];
    let minDistance = Infinity;

    const getDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
      return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
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
        .catch((err) => console.error("Customer lookup failed:", err));
    }
  }, [phoneVal, setValue]);

  const { mutate: schedule, isPending } = useSchedulePickup({
    mutation: {
      onSuccess: (result) => setSuccess({ ref: result.data.bookingReference, msg: result.data.message }),
      onError: () => {
        toast({ title: "Unable to schedule pickup", description: "Please try again in a moment.", variant: "destructive" });
      },
    },
  });

  const nextStep = async () => {
    if (step === 1) {
      const ok = await trigger(["name", "phone", "address"]);
      if (ok) setStep(2);
      return;
    }
    if (step === 2) {
      const ok = await trigger(["services"]);
      if (ok) setStep(3);
    }
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
            <div className="visual-card p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h1 className="mt-6 font-display text-5xl text-ink">Pickup request saved</h1>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">{success.msg}</p>
              <div className="mt-8 rounded-[1.75rem] border border-line bg-background/70 p-5">
                <p className="eyebrow justify-center">Booking reference</p>
                <p className="mt-4 text-2xl font-semibold text-ink">{success.ref}</p>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link href="/dashboard/orders">
                  <Button>Open dashboard</Button>
                </Link>
                <Link href="/track-order">
                  <Button variant="outline">Track an order</Button>
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
        description="Book a Fab Clean pickup in a shorter, cleaner, mobile-first flow."
        canonical="https://myfabclean.com/schedule-pickup"
      />

      <div className="page-shell">
        <section className="container-tight section-padding flex flex-col items-center justify-center min-h-[50vh]">
          <div className="w-full max-w-2xl">
            <div className="visual-card p-8 lg:p-10">
              <div className="text-center mb-10">
                <p className="eyebrow">Schedule pickup</p>
                <h1 className="mt-4 font-display text-3xl text-ink">Book your service</h1>
              </div>
            <form onSubmit={handleSubmit((formValues) => schedule({ data: formValues as any }))}>
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div key="pickup-step-1" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Input placeholder="Full name" {...register("name")} />
                        {errors.name ? <p className="mt-2 text-sm text-red-700">{errors.name.message}</p> : null}
                      </div>
                      <div>
                        <Input
                          placeholder="10-digit phone number"
                          maxLength={10}
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
                      <LocationInput
                        name="address"
                        placeholder="Pickup address with landmark."
                        register={register}
                        setValue={setValue}
                        watch={watch}
                        error={errors.address}
                        onLocationDetected={handleLocationDetected}
                      />
                      {savedAddresses.length > 0 && (
                        <div className="mt-2 space-y-2">
                          <p className="text-xs text-muted-foreground">Saved addresses:</p>
                          <div className="flex flex-wrap gap-2">
                            {savedAddresses.map((addr, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setValue("address", addr, { shouldValidate: true })}
                                className="rounded-xl border border-line bg-background/50 px-3 py-1.5 text-xs text-ink hover:border-primary/40 transition-colors"
                              >
                                {addr.slice(0, 30)}{addr.length > 30 ? "..." : ""}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : null}

                {step === 2 ? (
                  <motion.div key="pickup-step-2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
                    <Controller
                      name="services"
                      control={control}
                      render={({ field }) => (
                        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
                          {availableServices.map((service: any) => {
                            const selected = field.value.includes(service.id);
                            
                            // Map service names to icons dynamically
                            const getIcon = () => {
                              const n = service.name.toLowerCase();
                              if (n.includes("dry")) return <Sparkles className="h-6 w-6" />;
                              if (n.includes("kilogram") || n.includes("kilo")) return <Scale className="h-6 w-6" />;
                              if (n.includes("shoe")) return <Footprints className="h-6 w-6" />;
                              if (n.includes("bag")) return <Briefcase className="h-6 w-6" />;
                              if (n.includes("curtain")) return <Home className="h-6 w-6" />;
                              return <Shirt className="h-6 w-6" />;
                            };

                            return (
                              <button
                                key={service.id}
                                type="button"
                                onClick={() => field.onChange(selected ? field.value.filter((value) => value !== service.id) : [...field.value, service.id])}
                                className={cn(
                                  "relative flex flex-col items-center justify-center gap-3 rounded-[1.25rem] border p-5 text-center transition-all duration-200",
                                  selected
                                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20"
                                    : "border-line bg-background/50 hover:border-primary/40 hover:bg-background/80"
                                )}
                              >
                                {selected && (
                                  <div className="absolute right-3 top-3">
                                    <CheckCircle2 className="h-4 w-4 fill-primary text-background" />
                                  </div>
                                )}
                                <div className={cn(
                                  "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
                                  selected ? "bg-primary text-background" : "bg-panel border border-line text-muted-foreground"
                                )}>
                                  {getIcon()}
                                </div>
                                <p className={cn("text-sm font-medium leading-tight", selected ? "text-primary" : "text-ink")}>
                                  {service.name}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    />
                    {errors.services ? <p className="text-sm text-red-700">{errors.services.message}</p> : null}
                  </motion.div>
                ) : null}

                {step === 3 ? (
                  <motion.div key="pickup-step-3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
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
                        {errors.preferredDate ? <p className="mt-2 text-sm text-red-700">{errors.preferredDate.message}</p> : null}
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-ink">Branch</label>
                        <Controller
                          name="branch"
                          control={control}
                          render={({ field }) => (
                            <div className="grid grid-cols-2 gap-3">
                              {storesData.map((store) => (
                                <button
                                  key={store.slug}
                                  type="button"
                                  onClick={() => field.onChange(store.slug)}
                                  className={cn(
                                    "relative flex items-center justify-center rounded-[1.2rem] border px-4 py-3 text-sm capitalize transition-all duration-200",
                                    field.value === store.slug
                                      ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20 font-semibold"
                                      : "border-line bg-background/70 text-ink hover:border-primary/40"
                                  )}
                                >
                                  {store.name}
                                </button>
                              ))}
                            </div>
                          )}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-ink">Time slot</label>
                      <Controller
                        name="timeSlot"
                        control={control}
                        render={({ field }) => (
                          <div className="grid gap-3 sm:grid-cols-3">
                            {[
                              { id: "morning", label: "Morning", meta: "10 AM to 1 PM" },
                              { id: "afternoon", label: "Afternoon", meta: "1 PM to 4 PM" },
                              { id: "evening", label: "Evening", meta: "4 PM to 8 PM" },
                            ].map((slot) => (
                              <button
                                key={slot.id}
                                type="button"
                                onClick={() => field.onChange(slot.id)}
                                className={cn(
                                  "relative rounded-[1.4rem] border px-4 py-4 text-left transition-all duration-200",
                                  field.value === slot.id
                                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20"
                                    : "border-line bg-background/70 hover:border-primary/40"
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className={cn("font-medium transition-colors", field.value === slot.id ? "text-primary font-semibold" : "text-ink")}>{slot.label}</p>
                                    <p className="mt-2 text-sm text-muted-foreground">{slot.meta}</p>
                                  </div>
                                  {field.value === slot.id && <CheckCircle2 className="h-5 w-5 fill-primary text-background" />}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      />
                    </div>

                    <Textarea placeholder="Special instructions for the pickup team." {...register("specialInstructions")} />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="rounded-[1.5rem] border border-line bg-background/70 p-5 text-sm text-muted-foreground">
                  <p className="font-medium text-ink">Pickup summary</p>
                  <p className="mt-2">Branch: {storesData.find(s => s.slug === values.branch)?.name || values.branch || "Not selected"} • Slot: {values.timeSlot || "morning"}</p>
                  <p className="mt-1">Selected services: {values.services?.length || 0}</p>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  {step > 1 ? (
                    <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setStep((value) => Math.max(1, value - 1))}>
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                  ) : null}
                  {step < 3 ? (
                    <Button type="button" className="w-full sm:w-auto" onClick={() => void nextStep()}>
                      Next step
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" className="w-full sm:w-auto shadow-lg shadow-primary/20 ring-2 ring-primary/20" isLoading={isPending} disabled={!isValid}>
                      Confirm pickup
                    </Button>
                  )}
                </div>
              </div>
            </form>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
