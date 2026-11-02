import {
  CheckCircle2,
  Clock3,
  Footprints,
  MapPin,
  ShieldCheck,
  Sparkles,
  Truck,
  WashingMachine,
  type LucideIcon,
} from "lucide-react";

export const BRAND = {
  name: "Fab Clean",
  legalName: "Yadvik Traders",
  phoneMain: "93630 59595",
  phoneSecondary: "93637 19595",
  phoneHref: "tel:+919363059595",
  whatsappHref:
    "https://wa.me/919363059595?text=Hi%2C%20I%27d%20like%20to%20book%20a%20Fab%20Clean%20pickup.",
  email: "info@myfabclean.in",
  emailAlt: "myfabclean@gmail.com",
  hours: "Mon to Sat, 10:00 AM to 8:00 PM",
  heroTitle: "Bespoke Garment Care Delivered to Your Doorstep.",
  heroLead:
    "Schedule a complimentary pickup in seconds. Master dry cleaning, precision steam pressing, and fabric restoration — handled with white-glove care.",
  shortBlurb:
    "Laundry and dry cleaning with free pickup. Book in a minute; we handle the rest at your door.",
  bookingPromise:
    "No packages to pick online. Tell us when and where — our agent notes garments at pickup, and we confirm before service.",
};

export const TRUST_STATS = [
  { value: "2023", label: "Established" },
  { value: "3", label: "Service towns" },
  { value: "48h", label: "Typical turnaround" },
  { value: "Free", label: "Pickup in radius" },
];

export const SERVICE_HIGHLIGHTS: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Everyday laundry",
    description: "Wash, steam, fold, and hand-finish for clothes you wear every week.",
    icon: WashingMachine,
  },
  {
    title: "Dry cleaning",
    description: "Careful handling for sarees, suits, lehengas, and structured pieces.",
    icon: Sparkles,
  },
  {
    title: "Shoes and bags",
    description: "Restoration for sneakers, leather shoes, handbags, and accessories.",
    icon: Footprints,
  },
];

export const OPERATING_PILLARS: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Clear status",
    description: "Signed-in tracking shows where your order sits — received, cleaning, ready, out, delivered.",
    icon: ShieldCheck,
  },
  {
    title: "Honest timing",
    description: "Realistic intake-to-finish rhythm so delivery promises stay believable.",
    icon: Clock3,
  },
  {
    title: "Doorstep ease",
    description: "Free pickup and delivery in our radius — less friction for people who come back.",
    icon: Truck,
  },
];

export const PROCESS_STEPS: Array<{
  step: string;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    step: "1",
    title: "Schedule Doorstep Pickup",
    description: "Choose your convenient date and time window online or via WhatsApp. Our concierge arrives right at your door.",
    icon: MapPin,
  },
  {
    step: "2",
    title: "Expert Fabric Inspection",
    description: "Every garment is tagged, weighed, and examined for delicate fibers with an instant itemized inventory confirmed before processing.",
    icon: Sparkles,
  },
  {
    step: "3",
    title: "Artisan Care & Pristine Return",
    description: "Treated with eco-friendly solvents, precision steam pressing, and delivered back to your wardrobe in immaculate condition.",
    icon: CheckCircle2,
  },
];

export const LEGAL_NAV = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Refund", href: "/refund" },
  { label: "Cookies", href: "/cookies" },
];

/** Default service label when the customer skips online itemization. */
export const DEFAULT_PICKUP_SERVICE = "Pickup — details at door";
