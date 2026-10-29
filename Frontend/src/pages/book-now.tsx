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
  ArrowLeft,
  Flame, 
  Check, 
  Building2, 
  MessageCircle, 
  Navigation,
  Loader2,
  Heart,
  Tag,
  Gift,
  CheckCircle,
  HelpCircle
} from "lucide-react";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  lookupCustomer, 
  submitWebsitePickup, 
  fetchStores, 
  type Store, 
  type CustomerLookupResult 
} from "@/lib/public-api";
import { DEFAULT_STORES } from "@/lib/site-catalog";

// CUSTOM SVG ICONS FOR POSTER SERVICES (SHARP AT ANY RESOLUTION)
function SuitIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l5 2 3-3 3 3 5-2v16l-8 2-8-2V4z" />
      <path d="M9 6v6l3 2 3-2V6" />
      <path d="M12 9v5" />
      <circle cx="12" cy="16" r="0.8" fill="currentColor" />
      <circle cx="12" cy="18.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

function SareeIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3c2 3 5 4 8 2l2 4c-3 1-5 4-4 8l-7 4-2-8c2-2 1-6-1-8l4-2z" />
      <path d="M13 7l2 11" strokeDasharray="1.5 2" />
      <path d="M9 11l4 2" />
      <path d="M8 15l4 2" />
    </svg>
  );
}

function LehengaIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6l1 4H8l1-4z" />
      <path d="M10 7L6 21h12l-4-14" />
      <path d="M6 21c3-2 9-2 12 0" />
      <path d="M8 14c2-1 6-1 8 0" strokeDasharray="1.5 1.5" />
      <circle cx="12" cy="11" r="0.75" fill="currentColor" />
    </svg>
  );
}

function ShirtIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 001 .84H6v11a2 2 0 002 2h8a2 2 0 002-2V10h2.14a1 1 0 001-.84l.58-3.47a2 2 0 00-1.34-2.23z" />
      <path d="M9.5 2a2.5 2.5 0 005 0" />
      <path d="M12 7v10" />
    </svg>
  );
}

function JacketIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5l4 2 4-4 4 4 4-2v15l-8 2-8-2V5z" />
      <path d="M8 7v13" />
      <path d="M16 7v13" />
      <path d="M12 3v17" strokeDasharray="1 2" />
    </svg>
  );
}

function ShoeIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l4-9 5 2 7-1a3 3 0 013 3v2a3 3 0 01-3 3H3z" />
      <path d="M3 17h18v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" />
      <path d="M8 10l2 1" />
      <path d="M11 11l2 1" />
      <circle cx="18" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

function BlanketIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 11c3 1 6-1 9 0s6 1 9 0" />
      <path d="M3 15c3 1 6-1 9 0s6 1 9 0" />
      <path d="M7 6v13" strokeDasharray="1 2" />
    </svg>
  );
}

// SERVICES MATCHING POSTER (ZERO PRICES MENTIONED)
interface PosterServiceItem {
  id: string;
  name: string;
  badge: string;
  description: string;
  renderIcon: (color: string) => React.ReactNode;
  isPosterHighlight: boolean;
}

const POSTER_SERVICES: PosterServiceItem[] = [
  {
    id: "suits-blazers",
    name: "Suits & Blazers",
    badge: "50% OFF",
    description: "Tuxedos, 2-piece, 3-piece, blazers & wedding sherwanis",
    renderIcon: (c) => <SuitIcon className={c} />,
    isPosterHighlight: true,
  },
  {
    id: "sarees-designer",
    name: "Sarees & Designer Wear",
    badge: "50% OFF",
    description: "Pure Kanjivaram silk, Banarasi, zari border & wedding sarees",
    renderIcon: (c) => <SareeIcon className={c} />,
    isPosterHighlight: true,
  },
  {
    id: "lehengas-ethnic",
    name: "Lehengas & Ethnic Wear",
    badge: "50% OFF",
    description: "Embroidered lehengas, anarkalis, bridal sets & dhotis",
    renderIcon: (c) => <LehengaIcon className={c} />,
    isPosterHighlight: true,
  },
  {
    id: "shirts-trousers",
    name: "Shirts & Trousers",
    badge: "50% OFF",
    description: "Silk shirts, festive formals, trousers & kurtas",
    renderIcon: (c) => <ShirtIcon className={c} />,
    isPosterHighlight: true,
  },
  {
    id: "jackets-delicates",
    name: "Jackets & Delicate Garments",
    badge: "50% OFF",
    description: "Leather jackets, woolen coats, delicate gowns & cardigans",
    renderIcon: (c) => <JacketIcon className={c} />,
    isPosterHighlight: true,
  },
  {
    id: "shoe-clean",
    name: "Shoe Clean & Sneaker Spa",
    badge: "Sneaker Spa",
    description: "Deep sole scrub, whitening, deodorization & suede care",
    renderIcon: (c) => <ShoeIcon className={c} />,
    isPosterHighlight: false,
  },
  {
    id: "blankets-curtains",
    name: "Blankets, Quilts & Curtains",
    badge: "50% OFF",
    description: "Festive home refresh • heavy double quilts, comforters & drapes",
    renderIcon: (c) => <BlanketIcon className={c} />,
    isPosterHighlight: true,
  },
];

// Branch Store Coordinates
const BRANCH_COORDINATES: Record<string, { lat: number; lng: number; name: string }> = {
  POL: { lat: 10.6609, lng: 77.0048, name: "Pollachi Main Hub" },
  KIN: { lat: 10.8228, lng: 77.0189, name: "Kinathukadavu Branch" },
  MCET: { lat: 10.6811, lng: 77.0195, name: "MCET Campus Hub" },
  UDM: { lat: 10.5873, lng: 77.2476, name: "Udumalaipettai Hub" },
};

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function BookNowPage() {
  const { toast } = useToast();

  // Wizard Step: 1 = Contact & Address, 2 = Select Garments, 3 = Pickup Schedule & Confirm
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("POL");
  const [selectedServices, setSelectedServices] = useState<string[]>([
    "Suits & Blazers",
    "Sarees & Designer Wear",
  ]);
  const [pickupDate, setPickupDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [timeSlot, setTimeSlot] = useState("morning");
  const [specialNote, setSpecialNote] = useState("");

  // UI / Async State
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);
  const [customerLookup, setCustomerLookup] = useState<CustomerLookupResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<{
    reference: string;
    message: string;
  } | null>(null);

  // Format phone input & auto-trigger lookup on 10 digits
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname === "/book-now") {
      window.history.replaceState(null, "", "/book_now" + window.location.search);
    }
  }, []);

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

  // Location Fetcher (GPS Geolocation + OpenStreetMap Reverse Geocoding)
  const handleFetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "GPS not supported",
        description: "Your browser does not support GPS location lookup.",
        variant: "destructive",
      });
      return;
    }

    setIsLocating(true);
    setLocationStatus("Detecting your GPS coordinates...");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          setLocationStatus("Finding nearest address & store hub...");

          // Calculate closest store
          let closestBranch = "POL";
          let minDistance = Infinity;

          Object.entries(BRANCH_COORDINATES).forEach(([code, coord]) => {
            const dist = calculateDistanceKm(latitude, longitude, coord.lat, coord.lng);
            if (dist < minDistance) {
              minDistance = dist;
              closestBranch = code;
            }
          });

          setSelectedBranch(closestBranch);

          // Reverse geocode via Nominatim
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          if (res.ok) {
            const data = await res.json();
            const addrObj = data.address || {};
            const cleanParts = [
              addrObj.road || addrObj.suburb || addrObj.neighbourhood,
              addrObj.city || addrObj.town || addrObj.village || addrObj.county,
              addrObj.postcode ? `PIN ${addrObj.postcode}` : null,
            ].filter(Boolean);

            const resolvedAddress = cleanParts.length > 0 ? cleanParts.join(", ") : data.display_name;
            setAddress(resolvedAddress);
            setLocationStatus(
              `📍 Nearest Hub: ${BRANCH_COORDINATES[closestBranch]?.name} (~${minDistance.toFixed(1)} km away)`
            );
            toast({
              title: "Address auto-detected!",
              description: `Assigned nearest store: ${BRANCH_COORDINATES[closestBranch]?.name}`,
            });
          } else {
            throw new Error("Unable to parse address");
          }
        } catch {
          setLocationStatus("Location found, please verify your street name.");
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        setLocationStatus(null);
        let msg = "Could not fetch location. Please enter manually.";
        if (err.code === 1) msg = "Location permission denied. Please enter address manually.";
        toast({
          title: "Location error",
          description: msg,
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Toggle Services
  const toggleService = (serviceName: string) => {
    if (selectedServices.includes(serviceName)) {
      if (selectedServices.length === 1) {
        toast({
          title: "Select at least 1 service",
          description: "Please keep at least one category selected for pickup.",
        });
        return;
      }
      setSelectedServices(selectedServices.filter((s) => s !== serviceName));
    } else {
      setSelectedServices([...selectedServices, serviceName]);
    }
  };

  const selectAllDryClean = () => {
    const allDryClean = POSTER_SERVICES.filter((s) => s.isPosterHighlight).map((s) => s.name);
    setSelectedServices(allDryClean);
  };

  // Step Validation & Navigation
  const goToStep2 = () => {
    if (!phone || phone.length !== 10) {
      toast({
        title: "10-digit mobile number required",
        description: "Please enter your 10-digit mobile number to proceed.",
        variant: "destructive",
      });
      return;
    }
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name.",
        variant: "destructive",
      });
      return;
    }
    if (!address.trim()) {
      toast({
        title: "Pickup address required",
        description: "Please enter your street address or tap 'Use Current Location'.",
        variant: "destructive",
      });
      return;
    }
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToStep3 = () => {
    if (selectedServices.length === 0) {
      toast({
        title: "Select at least one garment",
        description: "Please choose at least one item category for pickup.",
        variant: "destructive",
      });
      return;
    }
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Submit Final Booking
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
    <div className="relative min-h-screen bg-[#02130C] text-slate-100 selection:bg-amber-500 selection:text-black">
      <SEO
        title="Diwali Mega Offer | 50% Flat Off Dry Cleaning - Book Now"
        description="Book your Diwali dry cleaning pickup in 30 seconds. Flat 50% OFF on suits, sarees, blazers & blankets with coupon FABDIWALI. Doorstep pickup across Pollachi, Kinathukadavu, MCET & Udumalpet."
        canonical="https://myfabclean.com/book_now"
      />

      {/* RICH DECORATIVE FESTIVE BACKGROUND PATTERN */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Subtle Rangoli / Mandala Watermark SVG Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(#D4AF37 1.5px, transparent 1.5px), radial-gradient(#D4AF37 1.5px, #02130C 1.5px)`,
            backgroundSize: `48px 48px`,
            backgroundPosition: `0 0, 24px 24px`
          }}
        />

        {/* Top Central Golden Diya Aura */}
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-400/25 via-yellow-600/10 to-transparent blur-3xl" />
        
        {/* Emerald Ambient Corner Glows */}
        <div className="absolute top-1/4 -left-20 h-80 w-80 rounded-full bg-emerald-600/15 blur-3xl" />
        <div className="absolute top-2/3 -right-20 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      {/* DEDICATED DISTRACTION-FREE BRAND HEADER (NO GLOBAL NAVBAR / NO DUPLICATE BUTTONS) */}
      <header className="sticky top-0 z-40 border-b border-amber-500/25 bg-[#031A12]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/">
            <div className="flex cursor-pointer items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/30 to-yellow-600/20 text-xl shadow-inner shadow-amber-400/20">
                🪔
              </div>
              <div>
                <span className="font-display text-xl font-black tracking-tight text-white sm:text-2xl">
                  fab<span className="text-amber-400">clean</span>
                </span>
                <span className="block text-[8px] font-bold tracking-widest text-amber-200/80 uppercase">
                  Dry Clean • Laundry
                </span>
              </div>
            </div>
          </Link>

          {/* Quick Support Pill */}
          <div className="flex items-center gap-2">
            <a
              href="https://wa.me/919363059595?text=Hi%20Fab%20Clean%2C%20I%20have%20a%20question%20about%20the%20Diwali%2050%25%20off%20offer."
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/70 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/60"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>

            <a
              href="tel:+919363059595"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/25"
            >
              <Phone className="h-3.5 w-3.5 text-amber-400" />
              <span>93630 59595</span>
            </a>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="relative z-10 mx-auto max-w-xl px-4 py-5 sm:px-6 pb-28 sm:pb-12">

        {/* BOOKING SUCCESS VIEW */}
        {bookingSuccess ? (
          <div className="rounded-3xl border border-amber-400/40 bg-gradient-to-b from-[#083628] to-[#041D15] p-6 text-center shadow-2xl backdrop-blur sm:p-8">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-white shadow-lg shadow-amber-500/30">
              <CheckCircle2 className="h-10 w-10 text-emerald-950" />
            </div>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/20 px-4 py-1.5 text-xs font-bold text-amber-300">
              <span>🪔</span> FABDIWALI OFFER ACTIVATED
            </div>

            <h1 className="mt-4 font-display text-2xl font-bold text-white sm:text-3xl">
              Pickup Scheduled Successfully!
            </h1>
            
            <p className="mt-2 text-xs sm:text-sm text-emerald-100/80">
              Our executive will arrive with clean sanitized bags at your doorstep on the selected date.
            </p>

            <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-[#02130e]/90 p-4 text-left">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                <span className="text-[11px] uppercase tracking-wider text-emerald-300/70 font-semibold">Booking Reference</span>
                <span className="font-mono text-base font-black text-amber-400">{bookingSuccess.reference}</span>
              </div>

              <div className="space-y-2 pt-3 text-xs text-emerald-100/90">
                <div className="flex justify-between">
                  <span className="text-emerald-300/60">Customer:</span>
                  <span className="font-semibold text-white">{name} ({phone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-300/60">Pickup Address:</span>
                  <span className="font-medium text-white max-w-[200px] truncate">{address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-300/60">Nearest Hub:</span>
                  <span className="font-semibold text-white">
                    {BRANCH_COORDINATES[selectedBranch]?.name || "Pollachi Main"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-300/60">Pickup Slot:</span>
                  <span className="font-semibold text-white">{pickupDate} ({timeSlot})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-300/60">Diwali Discount:</span>
                  <span className="font-bold text-amber-300">Flat 50% OFF Dry Cleaning</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <a
                href={`https://wa.me/919363059595?text=Hi%20Fab%20Clean%2C%20I%20just%20scheduled%20my%20Diwali%20pickup%20(${bookingSuccess.reference})%20with%20coupon%20FABDIWALI.%20Here%20is%20my%20location.`}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500"
              >
                <MessageCircle className="h-5 w-5" />
                Share Exact Location on WhatsApp
              </a>

              <a
                href="tel:+919363059595"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
              >
                <Phone className="h-4 w-4 text-amber-400" />
                Call Store for Immediate Assistance (93630 59595)
              </a>

              <Button 
                variant="ghost" 
                onClick={() => {
                  setBookingSuccess(null);
                  setCurrentStep(1);
                  setPhone("");
                  setName("");
                  setAddress("");
                  setCustomerLookup(null);
                  setHasSearched(false);
                }} 
                className="text-xs text-emerald-200/60 hover:text-white"
              >
                Schedule Another Pickup
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {/* HERO PROMOTIONAL BANNER MATCHING OFFICIAL DIWALI POSTER */}
            <div className="relative overflow-hidden rounded-3xl border border-amber-400/40 bg-gradient-to-br from-[#063022] via-[#042419] to-[#02140D] p-5 shadow-2xl shadow-emerald-950/60 sm:p-6">
              {/* Radial festive ambient glows */}
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl" />

              <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-400/15 px-3 py-1 text-[11px] font-black text-amber-300">
                  <Flame className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                  DIWALI SPECIAL • 28 OCT – 5 NOV 2026
                </div>

                <h1 className="mt-2.5 font-display text-2xl font-black tracking-tight text-white sm:text-3xl">
                  Relax this Diwali...
                </h1>
                <p className="font-display text-lg sm:text-xl font-bold text-amber-300 mt-0.5">
                  Let us take care of your special garments!
                </p>

                <p className="mt-2 text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
                  Flat <strong className="text-amber-300 font-black">50% OFF</strong> on all dry cleaning services. Get your festive silks, suits, blazers & lehengas radiantly cleaned at half price!
                </p>

                {/* Promo Code Badge Card */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-amber-400/35 bg-[#02160F]/90 p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
                      <Percent className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-amber-200/70 font-bold">Coupon Code</p>
                      <p className="font-mono text-sm font-black text-amber-300">FABDIWALI</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-emerald-200/70 font-medium">Valid Till</p>
                    <p className="text-xs font-bold text-white">05 Nov, 8:00 PM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* INTERACTIVE 3-STEP FLOW PROGRESS BAR */}
            <div className="mt-5 rounded-2xl border border-amber-500/20 bg-[#041D15] p-2.5 shadow-md">
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className={`flex flex-col items-center gap-1 rounded-xl py-1.5 transition ${
                    currentStep === 1
                      ? "bg-amber-500/20 text-amber-300 font-black border border-amber-400/30"
                      : currentStep > 1
                      ? "text-emerald-400 hover:text-white"
                      : "text-emerald-200/40"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold border border-current">
                    {currentStep > 1 ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : "1"}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-bold">1. Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => (name && phone.length === 10 && address ? setCurrentStep(2) : goToStep2())}
                  className={`flex flex-col items-center gap-1 rounded-xl py-1.5 transition ${
                    currentStep === 2
                      ? "bg-amber-500/20 text-amber-300 font-black border border-amber-400/30"
                      : currentStep > 2
                      ? "text-emerald-400 hover:text-white"
                      : "text-emerald-200/40"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold border border-current">
                    {currentStep > 2 ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : "2"}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-bold">2. Garments</span>
                </button>

                <button
                  type="button"
                  onClick={() => (currentStep === 2 ? goToStep3() : null)}
                  className={`flex flex-col items-center gap-1 rounded-xl py-1.5 transition ${
                    currentStep === 3
                      ? "bg-amber-500/20 text-amber-300 font-black border border-amber-400/30"
                      : "text-emerald-200/40"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold border border-current">
                    3
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-bold">3. Schedule</span>
                </button>
              </div>
            </div>

            {/* FLOW STEP 1: CONTACT DETAILS & LOCATION FETCH */}
            {currentStep === 1 && (
              <div className="mt-5 space-y-4">
                <div className="rounded-3xl border border-amber-500/30 bg-[#042419]/90 p-5 shadow-xl sm:p-6 backdrop-blur">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
                    <Phone className="h-4 w-4" />
                    <span>Step 1: Your Phone & Address</span>
                  </div>

                  <h2 className="mt-1 text-lg font-bold text-white">
                    Enter your mobile number
                  </h2>
                  <p className="text-xs text-emerald-100/70">
                    Enter your 10-digit number to unlock your Diwali offer. Saved profiles auto-fill instantly!
                  </p>

                  <div className="mt-4">
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 font-bold text-amber-400 text-sm">
                        +91
                      </div>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="10-digit mobile number"
                        value={phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        className="h-13 pl-14 text-base font-bold tracking-wider rounded-2xl border-amber-500/40 bg-[#02140D] text-white placeholder:text-emerald-200/40 focus:border-amber-400 focus:ring-amber-400/20"
                        maxLength={10}
                        autoFocus
                      />
                      {isSearchingPhone && (
                        <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                          <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* HIGH-VISIBILITY, CRYSTAL-CLEAR AUTO-FETCH MESSAGE */}
                  {hasSearched && (
                    <div className="mt-4">
                      {customerLookup?.isExisting ? (
                        <div className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-950/80 via-[#063323] to-emerald-950/80 p-4 text-emerald-100 shadow-xl shadow-emerald-950/40 backdrop-blur">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/30 text-emerald-300 border border-emerald-400/50">
                              <CheckCircle2 className="h-6 w-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-extrabold text-sm sm:text-base text-white">
                                  Welcome back, {customerLookup.name || "Customer"}!
                                </h4>
                                <span className="rounded-full bg-emerald-500/30 px-2 py-0.5 text-[10px] font-black text-emerald-300 border border-emerald-400/40">
                                  PROFILE VERIFIED
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-emerald-200/90 leading-relaxed">
                                We've auto-filled your saved name and address. You qualify for <strong className="text-white">Flat 50% OFF</strong> dry cleaning with coupon <strong className="text-amber-300">FABDIWALI</strong>!
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-950/80 via-[#362208] to-amber-950/80 p-4 text-amber-100 shadow-xl shadow-amber-950/40 backdrop-blur">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/30 text-amber-300 border border-amber-400/50">
                              <Sparkles className="h-6 w-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-extrabold text-sm sm:text-base text-white">
                                  ✨ Welcome New Customer!
                                </h4>
                                <span className="rounded-full bg-amber-500/30 px-2 py-0.5 text-[10px] font-black text-amber-300 border border-amber-400/40">
                                  OFFER UNLOCKED
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-amber-200/90 leading-relaxed">
                                You qualify for <strong className="text-white">Flat 50% OFF</strong> your first dry cleaning order! Coupon <strong className="text-amber-300">FABDIWALI</strong> applied. Please confirm your name & address below.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* NAME INPUT */}
                  <div className="mt-4">
                    <label className="text-xs font-bold text-emerald-200/90">Your Full Name</label>
                    <div className="relative mt-1">
                      <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400/70" />
                      <Input
                        placeholder="e.g. Anand Kumar"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-11 pl-10 rounded-xl border-amber-500/30 bg-[#02140D] text-sm text-white placeholder:text-emerald-200/40 focus:border-amber-400"
                        required
                      />
                    </div>
                  </div>

                  {/* ADDRESS WITH PROMINENT GPS FETCH BUTTON */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-emerald-200/90">
                        Pickup Address & Location
                      </label>
                      <button
                        type="button"
                        onClick={handleFetchCurrentLocation}
                        disabled={isLocating}
                        className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-500/20 px-3 py-1 text-[11px] font-black text-amber-300 shadow-sm transition hover:bg-amber-500/30 active:scale-95 disabled:opacity-60"
                      >
                        {isLocating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Navigation className="h-3.5 w-3.5 text-amber-300" />
                        )}
                        <span>{isLocating ? "Detecting GPS..." : "📍 Use Current Location"}</span>
                      </button>
                    </div>

                    <div className="relative mt-1.5">
                      <MapPin className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-amber-400/70" />
                      <textarea
                        placeholder="Door / Flat No, Street, Area / Landmark in Pollachi, Kinathukadavu or Udumalpet"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        rows={2}
                        className="w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-amber-500/30 bg-[#02140D] text-white placeholder:text-emerald-200/40 focus:outline-none focus:border-amber-400"
                        required
                      />
                    </div>

                    {locationStatus && (
                      <p className="mt-1.5 text-[11px] font-bold text-amber-300 animate-pulse">
                        {locationStatus}
                      </p>
                    )}
                  </div>

                  {/* STORE HUB SELECTION */}
                  <div className="mt-4">
                    <label className="text-xs font-bold text-emerald-200/80">Nearest Store Hub</label>
                    <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                          className={`h-10 rounded-xl text-xs font-bold border transition-all ${
                            selectedBranch === b.code
                              ? "border-amber-400 bg-amber-500/25 text-amber-300 shadow-md shadow-amber-500/10"
                              : "border-emerald-500/20 bg-[#02140D] text-emerald-200/70 hover:border-emerald-500/40"
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* PROCEED TO STEP 2 BUTTON */}
                  <div className="mt-6">
                    <Button
                      type="button"
                      onClick={goToStep2}
                      className="h-13 w-full rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-amber-600/30 flex items-center justify-center gap-2"
                    >
                      <span>Continue to Select Garments</span>
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* FLOW STEP 2: CHOOSE GARMENTS (SERVICES FROM POSTER - NO PRICES!) */}
            {currentStep === 2 && (
              <div className="mt-5 space-y-4">
                <div className="rounded-3xl border border-amber-500/30 bg-[#042419]/90 p-5 shadow-xl sm:p-6 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
                      <Sparkles className="h-4 w-4" />
                      <span>Step 2: Choose Garments / Services</span>
                    </div>
                    <button
                      type="button"
                      onClick={selectAllDryClean}
                      className="text-[11px] font-black text-amber-300 hover:underline"
                    >
                      Select All Dry Clean
                    </button>
                  </div>

                  <h2 className="mt-1 text-lg font-bold text-white">
                    What would you like dry cleaned?
                  </h2>
                  <p className="text-xs text-emerald-100/70">
                    Select your garments below. All dry cleaning receives an instant <strong className="text-amber-300 font-bold">50% discount</strong> with code FABDIWALI!
                  </p>

                  {/* CARDS LIST - SERVICES FROM THE OFFICIAL POSTER WITH CUSTOM ICONS */}
                  <div className="mt-4 space-y-2.5">
                    {POSTER_SERVICES.map((srv) => {
                      const isSelected = selectedServices.includes(srv.name);
                      return (
                        <div
                          key={srv.id}
                          onClick={() => toggleService(srv.name)}
                          className={`relative cursor-pointer select-none rounded-2xl border p-3.5 transition-all flex items-center justify-between gap-3 ${
                            isSelected
                              ? "border-amber-400 bg-amber-500/20 shadow-lg shadow-amber-500/15"
                              : "border-emerald-500/25 bg-[#02140D] hover:border-emerald-500/40 hover:bg-[#031c13]"
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            {/* POLISHED CIRCULAR BADGE ICON */}
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-inner transition-colors ${
                              isSelected 
                                ? "border-amber-400 bg-gradient-to-br from-amber-500/30 to-amber-700/20 text-amber-300" 
                                : "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                            }`}>
                              {srv.renderIcon("w-6 h-6")}
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-bold text-white truncate">{srv.name}</p>
                                <span className={`rounded-full px-2 py-0.5 text-[9px] font-black border ${
                                  srv.isPosterHighlight
                                    ? "bg-amber-500/25 text-amber-300 border-amber-400/40"
                                    : "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                                }`}>
                                  {srv.badge}
                                </span>
                              </div>
                              <p className="text-xs text-emerald-200/70 truncate">{srv.description}</p>
                            </div>
                          </div>

                          <div className="shrink-0 pl-2">
                            {isSelected ? (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-slate-950 font-black shadow-md">
                                <Check className="h-4 w-4 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="h-6 w-6 rounded-full border-2 border-emerald-500/40" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* SELECTED COUNT BADGE */}
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-500/25 bg-[#02140D] px-4 py-2.5 text-xs">
                    <span className="text-emerald-200/80">Selected Garments:</span>
                    <span className="font-black text-amber-300">
                      {selectedServices.length} {selectedServices.length === 1 ? "category" : "categories"} selected
                    </span>
                  </div>

                  {/* NAVIGATION BUTTONS */}
                  <div className="mt-5 flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      className="h-12 flex-1 rounded-2xl border-emerald-500/30 bg-[#02140D] text-emerald-200 hover:text-white"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>

                    <Button
                      type="button"
                      onClick={goToStep3}
                      className="h-12 flex-2 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-slate-950 font-black text-sm shadow-lg shadow-amber-600/25 flex items-center justify-center gap-2"
                    >
                      <span>Continue to Schedule</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* FLOW STEP 3: SCHEDULE DATE & TIME SLOT + BOOK NOW */}
            {currentStep === 3 && (
              <form onSubmit={handleBookingSubmit} className="mt-5 space-y-4">
                <div className="rounded-3xl border border-amber-500/30 bg-[#042419]/90 p-5 shadow-xl sm:p-6 backdrop-blur">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
                    <Clock className="h-4 w-4" />
                    <span>Step 3: Pickup Date & Slot</span>
                  </div>

                  <h2 className="mt-1 text-lg font-bold text-white">
                    When should we pick up?
                  </h2>
                  <p className="text-xs text-emerald-100/70">
                    Our verified executive will arrive at your address with safe packing hampers.
                  </p>

                  {/* DATE SELECTION PRESETS */}
                  <div className="mt-4">
                    <label className="text-xs font-bold text-emerald-200/80">Select Pickup Date</label>
                    <div className="mt-1.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDatePreset(0)}
                        className={`flex-1 h-11 rounded-xl text-xs font-black border transition-all ${
                          isToday(pickupDate)
                            ? "border-amber-400 bg-amber-500/25 text-amber-300"
                            : "border-emerald-500/20 bg-[#02140D] text-emerald-200/70"
                        }`}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setDatePreset(1)}
                        className={`flex-1 h-11 rounded-xl text-xs font-black border transition-all ${
                          isTomorrow(pickupDate)
                            ? "border-amber-400 bg-amber-500/25 text-amber-300"
                            : "border-emerald-500/20 bg-[#02140D] text-emerald-200/70"
                        }`}
                      >
                        Tomorrow
                      </button>
                      <input
                        type="date"
                        value={pickupDate}
                        onChange={(e) => setPickupDate(e.target.value)}
                        className="flex-1 h-11 px-2 rounded-xl text-xs border border-emerald-500/20 bg-[#02140D] text-white font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* TIME SLOT SELECTION */}
                  <div className="mt-4">
                    <label className="text-xs font-bold text-emerald-200/80">Preferred Time Slot</label>
                    <div className="mt-1.5 grid grid-cols-3 gap-2">
                      {[
                        { id: "morning", label: "Morning", time: "9 AM - 12 PM" },
                        { id: "afternoon", label: "Afternoon", time: "1 PM - 4 PM" },
                        { id: "evening", label: "Evening", time: "5 PM - 8 PM" },
                      ].map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setTimeSlot(slot.id)}
                          className={`p-2.5 rounded-xl border text-center transition-all ${
                            timeSlot === slot.id
                              ? "border-amber-400 bg-amber-500/25 text-amber-300 shadow-md shadow-amber-500/10"
                              : "border-emerald-500/20 bg-[#02140D] text-emerald-200/70"
                          }`}
                        >
                          <p className="text-xs font-black">{slot.label}</p>
                          <p className="text-[10px] opacity-75">{slot.time}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SPECIAL INSTRUCTIONS (OPTIONAL) */}
                  <div className="mt-4">
                    <label className="text-xs font-bold text-emerald-200/80">
                      Garment Notes / Gate Code (Optional)
                    </label>
                    <Input
                      placeholder="e.g. Wedding silk saree with zari, call before coming"
                      value={specialNote}
                      onChange={(e) => setSpecialNote(e.target.value)}
                      className="mt-1 h-10 text-xs rounded-xl border-emerald-500/25 bg-[#02140D] text-white placeholder:text-emerald-200/40"
                    />
                  </div>

                  {/* COMPLETE SUMMARY CARD */}
                  <div className="mt-5 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-[#063022] via-[#031C13] to-[#02130E] p-4 text-xs space-y-2 shadow-inner">
                    <div className="flex items-center justify-between border-b border-amber-500/25 pb-2">
                      <span className="font-bold text-white">Pickup Summary</span>
                      <span className="font-black text-amber-300">🪔 FABDIWALI (50% OFF)</span>
                    </div>

                    <div className="flex justify-between text-emerald-200/80">
                      <span>Customer:</span>
                      <span className="font-semibold text-white">{name} ({phone})</span>
                    </div>

                    <div className="flex justify-between text-emerald-200/80">
                      <span>Address:</span>
                      <span className="font-medium text-white max-w-[220px] truncate">{address}</span>
                    </div>

                    <div className="flex justify-between text-emerald-200/80">
                      <span>Assigned Hub:</span>
                      <span className="font-semibold text-white">
                        {BRANCH_COORDINATES[selectedBranch]?.name || "Pollachi Main"}
                      </span>
                    </div>

                    <div className="flex justify-between text-emerald-200/80">
                      <span>Garments:</span>
                      <span className="font-black text-amber-300">
                        {selectedServices.length} Categories Selected
                      </span>
                    </div>

                    <div className="pt-2 text-[11px] text-emerald-300/80 border-t border-emerald-500/20">
                      ✨ Pay after inspection upon safe delivery. Zero pre-payment required.
                    </div>
                  </div>

                  {/* SUBMIT BUTTON */}
                  <div className="mt-5 flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(2)}
                      className="h-14 flex-1 rounded-2xl border-emerald-500/30 bg-[#02140D] text-emerald-200 hover:text-white"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="h-14 flex-2 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-amber-600/35 flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Scheduling Pickup...</span>
                        </>
                      ) : (
                        <>
                          <span>Claim 50% Off & Book Now</span>
                          <Sparkles className="h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* FESTIVE TRUST PILLARS FROM THE DIWALI POSTER */}
            <div className="mt-8 rounded-3xl border border-amber-500/20 bg-[#031C13]/90 p-5 shadow-lg backdrop-blur">
              <div className="text-center">
                <p className="font-display text-base font-bold text-amber-300">
                  🪔 A cleaner wardrobe for a brighter you!
                </p>
                <p className="mt-1 text-xs text-emerald-100/70">
                  More time for what matters this festive season
                </p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
                <div className="rounded-2xl border border-emerald-500/25 bg-[#02140D] p-3 text-center">
                  <span className="text-xl">🌿</span>
                  <p className="mt-1 text-xs font-bold text-white">Premium Care</p>
                  <p className="text-[10px] text-emerald-200/60">For Every Fabric</p>
                </div>

                <div className="rounded-2xl border border-emerald-500/25 bg-[#02140D] p-3 text-center">
                  <span className="text-xl">🛡️</span>
                  <p className="mt-1 text-xs font-bold text-white">Trusted & Reliable</p>
                  <p className="text-[10px] text-emerald-200/60">Hydrocarbon Safe</p>
                </div>

                <div className="rounded-2xl border border-emerald-500/25 bg-[#02140D] p-3 text-center">
                  <span className="text-xl">❤️</span>
                  <p className="mt-1 text-xs font-bold text-white">Your Clothes</p>
                  <p className="text-[10px] text-emerald-200/60">Our Priority</p>
                </div>

                <div className="rounded-2xl border border-emerald-500/25 bg-[#02140D] p-3 text-center">
                  <span className="text-xl">🚚</span>
                  <p className="mt-1 text-xs font-bold text-white">Free Doorstep</p>
                  <p className="text-[10px] text-emerald-200/60">Pickup & Delivery</p>
                </div>
              </div>

              {/* HELPLINE & DISCLAIMER */}
              <div className="mt-5 border-t border-emerald-500/20 pt-4 text-center">
                <p className="text-xs text-emerald-100/80">
                  Direct Helpline: <a href="tel:+919363059595" className="font-bold text-amber-300 hover:underline">93630 59595</a> • <a href="tel:+919886788858" className="font-bold text-amber-300 hover:underline">98867 88858</a>
                </p>
                <p className="mt-1 text-[10px] text-emerald-200/50">
                  *T&C Apply. Flat 50% discount applies on dry cleaning services with coupon code FABDIWALI from 28 Oct to 5 Nov 2026.
                </p>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* MOBILE STICKY FLOATING ACTION BAR FOR ONE-HANDED THUMB NAVIGATION */}
      {!bookingSuccess && (
        <div className="fixed bottom-0 inset-x-0 z-50 border-t border-amber-500/30 bg-[#031A12]/95 backdrop-blur-lg px-4 py-3 sm:hidden shadow-[0_-10px_25px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">
                {currentStep === 1 ? "Step 1 of 3: Details" : currentStep === 2 ? "Step 2 of 3: Garments" : "Step 3 of 3: Schedule"}
              </p>
              <p className="text-xs font-black text-white truncate">
                {currentStep === 1
                  ? "Enter Phone & Address"
                  : currentStep === 2
                  ? `${selectedServices.length} Selected • 50% Off`
                  : "Confirm Your Pickup"}
              </p>
            </div>

            <Button
              type="button"
              onClick={currentStep === 1 ? goToStep2 : currentStep === 2 ? goToStep3 : handleBookingSubmit}
              disabled={isSubmitting}
              className="h-11 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/30 shrink-0"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : currentStep === 1 ? (
                "Next: Garments →"
              ) : currentStep === 2 ? (
                "Next: Time Slot →"
              ) : (
                "Claim 50% Off 🪔"
              )}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
