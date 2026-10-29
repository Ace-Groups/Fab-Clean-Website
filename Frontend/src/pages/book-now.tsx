import { useState, useEffect } from "react";
import { Link } from "wouter";
import { 
  Sparkles, 
  Phone, 
  User, 
  MapPin, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  Percent, 
  ArrowRight,
  Flame,
  Check,
  Building2,
  MessageCircle,
  HelpCircle
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  lookupCustomer, 
  submitWebsitePickup, 
  fetchStores, 
  type Store, 
  type CustomerLookupResult 
} from "@/lib/public-api";
import { DEFAULT_STORES } from "@/lib/site-catalog";
import { BRAND } from "@/lib/brand";

interface ServiceOption {
  id: string;
  name: string;
  category: "dry_clean" | "laundry" | "press";
  icon: string;
  badge: string;
  isOfferEligible: boolean;
  samplePrice: string;
  discountedPrice: string;
}

const DIWALI_SERVICES: ServiceOption[] = [
  {
    id: "dc-ethnic",
    name: "Silk Sarees & Festive Lehengas",
    category: "dry_clean",
    icon: "🥻",
    badge: "50% OFF",
    isOfferEligible: true,
    samplePrice: "₹250",
    discountedPrice: "₹125",
  },
  {
    id: "dc-suits",
    name: "Suits, Blazers & Sherwanis",
    category: "dry_clean",
    icon: "👔",
    badge: "50% OFF",
    isOfferEligible: true,
    samplePrice: "₹350",
    discountedPrice: "₹175",
  },
  {
    id: "dc-shirts",
    name: "Shirts, Kurtas & Trousers",
    category: "dry_clean",
    icon: "👕",
    badge: "50% OFF",
    isOfferEligible: true,
    samplePrice: "₹120",
    discountedPrice: "₹60",
  },
  {
    id: "dc-bedding",
    name: "Blankets, Quilts & Curtains",
    category: "dry_clean",
    icon: "🛏️",
    badge: "50% OFF",
    isOfferEligible: true,
    samplePrice: "₹400",
    discountedPrice: "₹200",
  },
  {
    id: "steam-press",
    name: "Express Steam Pressing",
    category: "press",
    icon: "♨️",
    badge: "Same Day",
    isOfferEligible: false,
    samplePrice: "₹25",
    discountedPrice: "₹25",
  },
  {
    id: "wash-fold",
    name: "Everyday Wash & Fold",
    category: "laundry",
    icon: "🧺",
    badge: "Excluded from 50% Off",
    isOfferEligible: false,
    samplePrice: "₹69/kg",
    discountedPrice: "₹69/kg",
  },
];

export default function BookNowPage() {
  const { toast } = useToast();

  // Form State
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("POL");
  const [selectedServices, setSelectedServices] = useState<string[]>([
    "Silk Sarees & Festive Lehengas",
  ]);
  const [pickupDate, setPickupDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [timeSlot, setTimeSlot] = useState("morning");
  const [specialNote, setSpecialNote] = useState("");

  // UI / Logic State
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);
  const [customerLookup, setCustomerLookup] = useState<CustomerLookupResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<{
    reference: string;
    message: string;
  } | null>(null);

  // Available Branches
  const [stores, setStores] = useState<Store[]>(DEFAULT_STORES);

  useEffect(() => {
    fetchStores().then((res) => {
      if (res?.data?.length) setStores(res.data);
    });
  }, []);

  // Format phone input
  const handlePhoneChange = (val: string) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 10);
    setPhone(cleaned);

    if (cleaned.length === 10) {
      triggerLookup(cleaned);
    } else if (cleaned.length < 10 && hasSearched) {
      setHasSearched(false);
      setCustomerLookup(null);
    }
  };

  const triggerLookup = async (phoneNum: string) => {
    setIsSearchingPhone(true);
    try {
      const result = await lookupCustomer(phoneNum);
      setHasSearched(true);
      setCustomerLookup(result);

      if (result?.isExisting) {
        if (result.name) setName(result.name);
        if (result.address) setAddress(result.address);
        if (result.branch) {
          const upper = result.branch.toUpperCase();
          if (["POL", "KIN", "MCET", "UDM"].includes(upper)) {
            setSelectedBranch(upper);
          }
        }
      }
    } catch {
      setHasSearched(true);
      setCustomerLookup(null);
    } finally {
      setIsSearchingPhone(false);
    }
  };

  const toggleService = (serviceName: string) => {
    if (selectedServices.includes(serviceName)) {
      if (selectedServices.length === 1) {
        toast({
          title: "Select at least 1 service",
          description: "Please keep at least one service selected for pickup.",
        });
        return;
      }
      setSelectedServices(selectedServices.filter((s) => s !== serviceName));
    } else {
      setSelectedServices([...selectedServices, serviceName]);
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone || phone.length !== 10) {
      toast({
        title: "Valid phone number required",
        description: "Please enter your 10-digit mobile number.",
        variant: "destructive",
      });
      return;
    }

    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please tell us your name so we know who to pick up from.",
        variant: "destructive",
      });
      return;
    }

    if (!address.trim()) {
      toast({
        title: "Address required",
        description: "Please enter your pickup street address or apartment details.",
        variant: "destructive",
      });
      return;
    }

    if (selectedServices.length === 0) {
      toast({
        title: "Select a service",
        description: "Please select at least one garment or dry cleaning category.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await submitWebsitePickup({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        services: selectedServices,
        branch: selectedBranch,
        preferredDate: pickupDate,
        timeSlot: timeSlot,
        couponCode: "FABDIWALI",
        specialInstructions: `🪔 DIWALI OFFER BOOKING [Coupon: FABDIWALI - 50% Off Dry Cleaning] ${specialNote}`.trim(),
      });

      if (res.success && res.data) {
        setBookingSuccess({
          reference: res.data.bookingReference,
          message: res.data.message || "Your pickup request is confirmed!",
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        throw new Error("Booking response was unsuccessful");
      }
    } catch (err: any) {
      toast({
        title: "Booking error",
        description: err?.message || "Could not schedule pickup right now. Please try again or WhatsApp us.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preset Date Helpers
  const setDatePreset = (daysOffset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    setPickupDate(d.toISOString().split("T")[0]);
  };

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split("T")[0];
    return dateStr === today;
  };

  const isTomorrow = (dateStr: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return dateStr === tomorrow.toISOString().split("T")[0];
  };

  return (
    <AppLayout>
      <SEO
        title="Diwali Mega Offer | 50% Flat Off Dry Cleaning - Book Now"
        description="Book your Diwali dry cleaning pickup in 30 seconds. Flat 50% OFF on suits, sarees, blazers & blankets with coupon FABDIWALI. Doorstep pickup across Pollachi, Kinathukadavu, MCET & Udumalpet."
        canonical="https://myfabclean.com/book-now"
      />

      <div className="min-h-screen bg-gradient-to-b from-amber-500/10 via-background to-background pb-20 pt-6 sm:pt-10">
        <div className="mx-auto max-w-xl px-4 sm:px-6">

          {/* SUCCESS CONFIRMATION VIEW */}
          {bookingSuccess ? (
            <div className="rounded-3xl border border-amber-300/60 bg-panel/95 p-6 sm:p-8 text-center shadow-xl backdrop-blur">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-white shadow-lg shadow-amber-500/30">
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <span>🪔</span> FABDIWALI OFFER ACTIVATED
              </div>

              <h1 className="mt-4 font-display text-2xl sm:text-3xl font-bold text-ink">
                Pickup Scheduled Successfully!
              </h1>
              
              <p className="mt-2 text-sm text-muted-foreground">
                Your clothes will receive premium gentle care at our modern facility.
              </p>

              <div className="mt-6 rounded-2xl border border-line bg-background/80 p-4 text-left">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Booking Reference</span>
                  <span className="font-mono text-base font-bold text-primary">{bookingSuccess.reference}</span>
                </div>

                <div className="space-y-2 pt-3 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span className="font-medium text-ink">{name} ({phone})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Branch:</span>
                    <span className="font-medium text-ink">
                      {selectedBranch === "POL" ? "Pollachi Main" : selectedBranch === "KIN" ? "Kinathukadavu" : selectedBranch === "MCET" ? "MCET Campus" : "Udumalpet"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Scheduled Date:</span>
                    <span className="font-medium text-ink">{pickupDate} ({timeSlot})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Diwali Discount:</span>
                    <span className="font-bold text-emerald-600">50% OFF Dry Cleaning</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <a
                  href={`https://wa.me/919488963233?text=Hi%20Fab%20Clean%2C%20I%20just%20booked%20my%20pickup%20(${bookingSuccess.reference})%20with%20coupon%20FABDIWALI.`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 font-medium text-white shadow-md transition hover:bg-emerald-700"
                >
                  <MessageCircle className="h-5 w-5" />
                  WhatsApp Us Your Location
                </a>

                <Link href={`/track-order/${bookingSuccess.reference}`}>
                  <Button variant="outline" className="h-12 w-full rounded-2xl border-line">
                    Track Pickup Status
                  </Button>
                </Link>

                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setBookingSuccess(null);
                    setPhone("");
                    setName("");
                    setAddress("");
                  }} 
                  className="text-xs text-muted-foreground"
                >
                  Book Another Pickup
                </Button>
              </div>
            </div>
          ) : (
            /* BOOKING FLOW FORM */
            <div>
              {/* TOP DIWALI HERO CARD */}
              <div className="relative overflow-hidden rounded-3xl border border-amber-300/70 bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900 p-6 text-white shadow-xl shadow-amber-900/20">
                {/* Decorative glow circles */}
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-yellow-400/20 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-amber-500/20 blur-2xl" />

                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 rounded-full bg-yellow-400/25 px-3 py-1 text-xs font-bold tracking-wide text-yellow-200 border border-yellow-300/40">
                    <Flame className="h-3.5 w-3.5 text-yellow-300 animate-pulse" />
                    FESTIVAL OF LIGHTS SPECIAL
                  </div>

                  <h1 className="mt-3 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    Flat 50% OFF Dry Cleaning
                  </h1>

                  <p className="mt-2 text-xs sm:text-sm text-amber-100/90 leading-relaxed">
                    Look radiant this Diwali! Get your silk sarees, ethnic lehengas, suits, and blazers professionally dry-cleaned at half price.
                  </p>

                  {/* Promo Code Chip */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-black/30 p-3 border border-yellow-400/30">
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4 text-yellow-300" />
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-yellow-200/80">Active Coupon</p>
                        <p className="font-mono text-sm font-bold text-yellow-300">FABDIWALI</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-amber-200/70">Offer Validity</p>
                      <p className="text-xs font-semibold text-white">Till 05 Nov, 8:00 PM</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* BOOKING CONTAINER */}
              <form onSubmit={handleBookingSubmit} className="mt-6 space-y-6">

                {/* STEP 1: PHONE NUMBER & AUTO-FETCH */}
                <div className="rounded-3xl border border-line bg-panel p-5 sm:p-6 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                    <Phone className="h-4 w-4" />
                    <span>Step 1: Mobile Number</span>
                  </div>

                  <h2 className="mt-1 text-base font-bold text-ink">
                    Enter your phone number
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    We auto-fetch your saved name & address from our system.
                  </p>

                  <div className="mt-4">
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 font-semibold text-muted-foreground text-sm">
                        +91
                      </div>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="10-digit mobile number"
                        value={phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        className="h-13 pl-14 text-base font-medium rounded-2xl border-line focus:border-amber-500 focus:ring-amber-500/20"
                        maxLength={10}
                        required
                      />
                      {isSearchingPhone && (
                        <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AUTO-FETCH STATUS BANNER */}
                  {hasSearched && (
                    <div className="mt-3">
                      {customerLookup?.isExisting ? (
                        customerLookup.isDiwaliEligible ? (
                          <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-300/50 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                            <Sparkles className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                            <div>
                              <p className="font-bold">Welcome back, {customerLookup.name || "Customer"}!</p>
                              <p className="text-[11px] opacity-90">
                                You qualify for the <strong>50% FABDIWALI</strong> discount! We've pre-filled your details.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300/50 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                            <div>
                              <p className="font-bold">Welcome back, {customerLookup.name}!</p>
                              <p className="text-[11px] opacity-90">
                                Profile found! Note: FABDIWALI is for first-time dry cleaning. Your order will receive priority processing.
                              </p>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-400/50 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                          <Sparkles className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                          <div>
                            <p className="font-bold">✨ Welcome New Customer!</p>
                            <p className="text-[11px] opacity-90">
                              Your <strong>50% Flat Off</strong> coupon (FABDIWALI) is ready! Just enter your name & address below.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* NAME & ADDRESS FIELDS */}
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-ink">Full Name</label>
                      <div className="relative mt-1">
                        <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Your full name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="h-11 pl-10 rounded-xl border-line text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-ink">Pickup Address / Landmark</label>
                      <div className="relative mt-1">
                        <MapPin className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                        <textarea
                          placeholder="Door No, Street Name, Area / Landmark in Pollachi, Kinathukadavu or Udumalpet"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          rows={2}
                          className="w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-line bg-background text-ink placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* STEP 2: SELECT SERVICES */}
                <div className="rounded-3xl border border-line bg-panel p-5 sm:p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                      <Zap className="h-4 w-4" />
                      <span>Step 2: Choose Garments / Services</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">Tap to select</span>
                  </div>

                  <h2 className="mt-1 text-base font-bold text-ink">
                    What would you like dry cleaned?
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Dry cleaning items get an instant 50% discount with FABDIWALI.
                  </p>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {DIWALI_SERVICES.map((srv) => {
                      const isSelected = selectedServices.includes(srv.name);
                      return (
                        <div
                          key={srv.id}
                          onClick={() => toggleService(srv.name)}
                          className={`relative cursor-pointer select-none rounded-2xl border p-3.5 transition-all flex items-start gap-3 ${
                            isSelected
                              ? "border-amber-500 bg-amber-500/10 shadow-sm"
                              : "border-line bg-background/60 hover:border-line hover:bg-background"
                          }`}
                        >
                          <div className="text-2xl mt-0.5">{srv.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-semibold text-ink truncate">{srv.name}</p>
                              {isSelected ? (
                                <div className="h-4 w-4 rounded-full bg-amber-500 flex items-center justify-center text-white shrink-0">
                                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                                </div>
                              ) : (
                                <div className="h-4 w-4 rounded-full border border-line shrink-0" />
                              )}
                            </div>

                            <div className="mt-1 flex items-center gap-2">
                              {srv.isOfferEligible ? (
                                <>
                                  <span className="text-[11px] text-muted-foreground line-through">{srv.samplePrice}</span>
                                  <span className="text-xs font-bold text-emerald-600">{srv.discountedPrice}</span>
                                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                                    50% OFF
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">{srv.samplePrice}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* STEP 3: BRANCH & PICKUP DATE/SLOT */}
                <div className="rounded-3xl border border-line bg-panel p-5 sm:p-6 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                    <Building2 className="h-4 w-4" />
                    <span>Step 3: Branch & Slot</span>
                  </div>

                  <h2 className="mt-1 text-base font-bold text-ink">
                    Nearest store & preferred time
                  </h2>

                  {/* Branch Selection Pills */}
                  <div className="mt-3">
                    <label className="text-xs font-semibold text-muted-foreground">Select Store Location</label>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      {[
                        { code: "POL", label: "Pollachi Main" },
                        { code: "KIN", label: "Kinathukadavu" },
                        { code: "MCET", label: "MCET Campus" },
                        { code: "UDM", label: "Udumalpet" },
                      ].map((b) => (
                        <button
                          key={b.code}
                          type="button"
                          onClick={() => setSelectedBranch(b.code)}
                          className={`h-11 rounded-xl text-xs font-medium border transition-colors ${
                            selectedBranch === b.code
                              ? "border-primary bg-primary/10 text-primary font-bold"
                              : "border-line bg-background text-muted-foreground hover:bg-panel"
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Selection */}
                  <div className="mt-4">
                    <label className="text-xs font-semibold text-muted-foreground">Pickup Date</label>
                    <div className="mt-1.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDatePreset(0)}
                        className={`flex-1 h-10 rounded-xl text-xs font-medium border transition-colors ${
                          isToday(pickupDate)
                            ? "border-primary bg-primary/10 text-primary font-bold"
                            : "border-line bg-background text-muted-foreground"
                        }`}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setDatePreset(1)}
                        className={`flex-1 h-10 rounded-xl text-xs font-medium border transition-colors ${
                          isTomorrow(pickupDate)
                            ? "border-primary bg-primary/10 text-primary font-bold"
                            : "border-line bg-background text-muted-foreground"
                        }`}
                      >
                        Tomorrow
                      </button>
                      <input
                        type="date"
                        value={pickupDate}
                        onChange={(e) => setPickupDate(e.target.value)}
                        className="flex-1 h-10 px-2 rounded-xl text-xs border border-line bg-background text-ink font-medium"
                      />
                    </div>
                  </div>

                  {/* Slot Selection */}
                  <div className="mt-4">
                    <label className="text-xs font-semibold text-muted-foreground">Preferred Time Slot</label>
                    <div className="mt-1.5 grid grid-cols-3 gap-2">
                      {[
                        { id: "morning", label: "Morning", time: "9 AM - 12 PM" },
                        { id: "afternoon", label: "Afternoon", time: "12 PM - 4 PM" },
                        { id: "evening", label: "Evening", time: "4 PM - 8 PM" },
                      ].map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setTimeSlot(slot.id)}
                          className={`p-2 rounded-xl border text-center transition-colors ${
                            timeSlot === slot.id
                              ? "border-primary bg-primary/10 text-primary font-bold"
                              : "border-line bg-background text-muted-foreground"
                          }`}
                        >
                          <p className="text-xs font-medium">{slot.label}</p>
                          <p className="text-[10px] opacity-75">{slot.time}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Special Note */}
                  <div className="mt-4">
                    <label className="text-xs font-semibold text-muted-foreground">Special Instructions (Optional)</label>
                    <Input
                      placeholder="e.g. Call before coming, handle wedding saree delicately"
                      value={specialNote}
                      onChange={(e) => setSpecialNote(e.target.value)}
                      className="mt-1 h-10 text-xs rounded-xl border-line"
                    />
                  </div>
                </div>

                {/* SUMMARY & SUBMIT CTA */}
                <div className="rounded-3xl border border-amber-400/40 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-background p-5 shadow-sm">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Applied Offer:</span>
                    <span className="font-bold text-amber-700 dark:text-amber-300">🪔 FABDIWALI (50% Off Dry Cleaning)</span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Selected Services:</span>
                    <span className="font-medium text-ink">{selectedServices.length} categories</span>
                  </div>

                  <div className="mt-4">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="h-14 w-full rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-base shadow-lg shadow-amber-600/25 flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>Scheduling Pickup...</span>
                        </>
                      ) : (
                        <>
                          <span>Claim 50% Off & Book Pickup</span>
                          <ArrowRight className="h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </div>

                  <p className="mt-3 text-center text-[11px] text-muted-foreground">
                    Doorstep pickup & delivery • Pay after inspection & delivery
                  </p>
                </div>

                {/* TRUST BADGES */}
                <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                  <div className="rounded-2xl border border-line bg-panel p-3">
                    <ShieldCheck className="mx-auto h-5 w-5 text-emerald-600" />
                    <p className="mt-1 text-[11px] font-bold text-ink">Zero Damage</p>
                    <p className="text-[10px] text-muted-foreground">Hydrocarbon safe</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-panel p-3">
                    <Zap className="mx-auto h-5 w-5 text-amber-600" />
                    <p className="mt-1 text-[11px] font-bold text-ink">48-Hr Delivery</p>
                    <p className="text-[10px] text-muted-foreground">Express available</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-panel p-3">
                    <CheckCircle2 className="mx-auto h-5 w-5 text-primary" />
                    <p className="mt-1 text-[11px] font-bold text-ink">Free Pickup</p>
                    <p className="text-[10px] text-muted-foreground">4 Store hubs</p>
                  </div>
                </div>

              </form>
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
}
