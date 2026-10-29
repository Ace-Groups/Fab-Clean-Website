export interface Store {
  id: string;
  slug: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
  latitude: number;
  longitude: number;
  coverageRadiusKm: number;
  mapHref?: string;
}

export const DEFAULT_STORES: Store[] = [
  {
    id: "pollachi",
    slug: "pollachi",
    name: "Pollachi",
    address: "#16, Venkatramana Round Road, Mahalingapuram, Pollachi - 642002",
    phone: "+91 93630 59595",
    email: "pollachi@myfabclean.com",
    latitude: 10.6609,
    longitude: 77.0048,
    coverageRadiusKm: 10,
    mapHref: "https://maps.google.com/?q=Fab+Clean+Mahalingapuram+Pollachi",
  },
  {
    id: "kinathukadavu",
    slug: "kinathukadavu",
    name: "Kinathukadavu",
    address: "#442/11, Opp MLA Office, Krishnasamypuram, Kinathukadavu - 642109",
    phone: "+91 93637 19595",
    email: "kinathukadavu@myfabclean.com",
    latitude: 10.8202,
    longitude: 77.0205,
    coverageRadiusKm: 8,
    mapHref: "https://maps.google.com/?q=Fab+Clean+Kinathukadavu",
  },
  {
    id: "mcet",
    slug: "mcet",
    name: "MCET Campus",
    address: "MCET College Campus, Udumalai Road, Pollachi - 642003",
    phone: "+91 93630 59595",
    email: "mcet@myfabclean.com",
    latitude: 10.6811,
    longitude: 77.0195,
    coverageRadiusKm: 5,
    mapHref: "https://maps.google.com/?q=MCET+Campus+Pollachi",
  },
  {
    id: "udumalpet",
    slug: "udumalpet",
    name: "Udumalpet",
    address: "Udumalpet Road, Pollachi - 642001",
    phone: "+91 93630 59595",
    email: "udumalpet@myfabclean.com",
    latitude: 10.5833,
    longitude: 77.2500,
    coverageRadiusKm: 10,
    mapHref: "https://maps.google.com/?q=Fab+Clean+Udumalpet",
  },
];

export interface WebsiteService {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  icon: string;
  category: string;
  startingPrice: number;
  features: string[];
}

export const DEFAULT_SERVICES: WebsiteService[] = [
  {
    id: "dry-cleaning",
    slug: "dry-cleaning",
    name: "Premium Dry Cleaning",
    description:
      "Fab Clean's dry cleaning uses eco-friendly solvents and state-of-the-art machines to tackle even the toughest stains. Perfect for delicate items such as silk sarees, sherwani, lehenga, blazers, and designer garments. Our process involves sorting by fabric type, individual spot treatment with imported solutions, machine processing with eco-friendly solvents, and meticulous finishing.",
    shortDescription:
      "Eco-friendly dry cleaning for your most delicate and precious garments.",
    icon: "shirt",
    category: "Cleaning",
    startingPrice: 45,
    features: [
      "Eco-friendly imported solvents",
      "Individual spot treatment",
      "Expert finishing and pressing",
      "Suitable for silk, leather, and designer wear",
      "Meticulous quality check before handover",
    ],
  },
  {
    id: "premium-laundry",
    slug: "premium-laundry",
    name: "Premium Laundry",
    description:
      "Fab Clean's flagship laundry service is built on an extensive multi-step washing process designed to deliver consistently clean, fresh results. Each item is assessed, machine-washed with branded antiseptic detergents, controlled-dried to preserve fabric integrity, and expertly steam-ironed before packaging.",
    shortDescription:
      "Multi-step laundry with antiseptic detergents, steam ironing, and quality inspection.",
    icon: "washing-machine",
    category: "Laundry",
    startingPrice: 45,
    features: [
      "Pre-wash fabric assessment",
      "Antiseptic detergents and fabric softeners",
      "Controlled drying to prevent shrinkage",
      "Garment-specific steam ironing",
      "Expert quality inspection",
      "Folded, hanger, or vacuum-packed finish",
    ],
  },
  {
    id: "laundry-by-kg",
    slug: "laundry-by-kg",
    name: "Laundry by Kilogram",
    description:
      "For everyday regular clothing, Fab Clean offers a kilogram-based laundry option — providing economic convenience for bulk washes. Ideal for working professionals and families looking for regular, cost-effective garment care without the need for individual-item pricing.",
    shortDescription:
      "Bulk laundry at ₹120/kg (wash+iron) or ₹70/kg (wash+fold) for everyday wear.",
    icon: "scale",
    category: "Laundry",
    startingPrice: 70,
    features: [
      "Wash + Iron: ₹120 per kg",
      "Wash + Fold: ₹70 per kg",
      "Ideal for bulk everyday clothing",
      "Applicable for men's clothing",
      "Cost-effective for families and professionals",
    ],
  },
  {
    id: "shoe-cleaning",
    slug: "shoe-cleaning",
    name: "Premium Shoe Cleaning",
    description:
      "Shoe cleaning is treated as a specialized service at Fab Clean, given the variety of materials and stain types involved. We are a one-stop solution for leather bags, sports shoes, sneakers, canvas shoes, leather shoes, and sandals.",
    shortDescription:
      "Specialized shoe cleaning for all types — sneakers, leather, canvas, and more.",
    icon: "footprints",
    category: "Specialty",
    startingPrice: 300,
    features: [
      "Sports shoes & sneakers: ₹300",
      "Leather shoes: ₹400",
      "Deep cleaning for all materials",
      "Canvas, mesh, synthetic, genuine leather",
      "Deodorizing and conditioning",
    ],
  },
  {
    id: "bag-cleaning",
    slug: "bag-cleaning",
    name: "Bag Cleaning",
    description:
      "Fab Clean offers specialized bag cleaning services for leather bags, tote bags, and other premium accessories. This positions Fab Clean as a complete personal accessory care provider, not just a clothing-focused laundry service.",
    shortDescription:
      "Expert cleaning for leather bags, totes, and premium accessories from ₹150.",
    icon: "briefcase",
    category: "Specialty",
    startingPrice: 150,
    features: [
      "Starting from ₹150",
      "Leather bag specialists",
      "Tote bags and designer accessories",
      "Stain treatment and conditioning",
      "Safe for premium materials",
    ],
  },
  {
    id: "curtain-cleaning",
    slug: "curtain-cleaning",
    name: "Curtain Cleaning",
    description:
      "Curtain cleaning is described as a 'tedious job' that Fab Clean handles with heavy-duty machines and expert care. The service returns curtains fresh and aromatic, making it ideal for households, offices, and commercial spaces.",
    shortDescription:
      "Heavy-duty curtain cleaning returning them fresh, clean, and aromatic.",
    icon: "layout",
    category: "Home Furnishings",
    startingPrice: 150,
    features: [
      "Heavy-duty cleaning machines",
      "With and without lining",
      "Fresh and aromatic finish",
      "Ideal for homes, offices, commercial spaces",
      "Window and door curtains",
    ],
  },
  {
    id: "leather-cleaning",
    slug: "leather-cleaning",
    name: "Leather Cleaning",
    description:
      "Fab Clean identifies itself as rare in the Pollachi market for its leather cleaning expertise. Leather requires specialized tools and techniques — neither dry cleaning solvents nor plain water are adequate. We are one of the few services in the area equipped to handle leather goods correctly.",
    shortDescription:
      "Rare specialized leather cleaning using expert tools — unique in the Pollachi market.",
    icon: "gem",
    category: "Specialty",
    startingPrice: 400,
    features: [
      "Specialized leather cleaning tools",
      "Safe for genuine and faux leather",
      "Conditioning and restoration",
      "Rare expertise in Pollachi region",
      "Leather jackets, shoes, bags, accessories",
    ],
  },
  {
    id: "steam-ironing",
    slug: "steam-ironing",
    name: "Steam Ironing",
    description:
      "Fab Clean offers standalone steam ironing services for customers who need their clothes crisply pressed without a full wash. The service uses garment-specific steam ironing equipment to ensure a smooth, wrinkle-free finish.",
    shortDescription:
      "Garment-specific steam ironing for a crisp, wrinkle-free finish — no wash required.",
    icon: "zap",
    category: "Ironing",
    startingPrice: 25,
    features: [
      "Garment-specific equipment",
      "Smooth wrinkle-free finish",
      "No wash required",
      "Quick turnaround",
      "Professional press and fold",
    ],
  },
];

export const DEFAULT_PRICING = [
  {
    category: "Regular Wash Services",
    items: [
      { item: "Shirt White/Color", type: "Wash + Starch", price: 45 },
      { item: "Pant White/Color", type: "Wash + Starch", price: 50 },
      { item: "Dhoti White/Color", type: "Wash + Starch", price: 50 },
      { item: "Shirt", type: "Wash + Iron", price: 45 },
      { item: "Pant", type: "Wash + Iron", price: 45 },
      { item: "Dhoti", type: "Wash + Iron", price: 45 },
      { item: "T-Shirt", type: "Wash + Iron", price: 45 },
      { item: "Jeans", type: "Wash + Iron", price: 45 },
    ],
  },
  {
    category: "Dry Cleaning — Premium",
    items: [
      { item: "Shirt / T-Shirt", type: "Dry Clean", price: 150 },
      { item: "Pant / Trousers", type: "Dry Clean", price: 175 },
      { item: "Coat / Blazer", type: "Dry Clean", price: 350 },
      { item: "Waist Coat", type: "Dry Clean", price: 250 },
      { item: "Sherwani", type: "Dry Clean", price: 550 },
      { item: "Kurta Plain", type: "Dry Clean", price: 175 },
      { item: "Silk Shirt", type: "Dry Clean", price: 200 },
      { item: "Silk Dhoti", type: "Dry Clean", price: 200 },
      { item: "Frock / Skirt", type: "Dry Clean", price: 200 },
      { item: "Lehenga", type: "Dry Clean", price: 650 },
      { item: "Pattu Saree", type: "Dry Clean", price: 400 },
      { item: "Bed Sheet Single", type: "Dry Clean", price: 150 },
      { item: "Bed Sheet Double", type: "Dry Clean", price: 200 },
      { item: "Blanket / Quilt", type: "Dry Clean", price: 350 },
      { item: "Pillow Cover", type: "Dry Clean", price: 75 },
      { item: "Cushion Cover", type: "Dry Clean", price: 75 },
      { item: "Curtain (per foot)", type: "Dry Clean", price: 30 },
      { item: "Carpet (per sq ft)", type: "Dry Clean", price: 30 },
    ],
  },
  {
    category: "Laundry by Kilogram",
    items: [
      {
        item: "Wash + Iron",
        type: "Men's Clothing",
        price: 120,
        unit: "per kg",
      },
      {
        item: "Wash + Fold",
        type: "Men's Clothing",
        price: 70,
        unit: "per kg",
      },
    ],
  },
  {
    category: "Shoe Cleaning",
    items: [
      { item: "Sports Shoes / Sneakers", type: "Deep Clean", price: 300 },
      { item: "Leather Shoes", type: "Specialized Care", price: 400 },
    ],
  },
  {
    category: "Bag Cleaning",
    items: [
      { item: "Bags (all types)", type: "Starting from", price: 150 },
    ],
  },
  {
    category: "Specialty Items",
    items: [
      { item: "Jacket", type: "Dry Clean", price: 325 },
      { item: "Children's Toys", type: "Clean", price: 100 },
    ],
  },
];

export interface HomepageReview {
  id: string;
  customer_name?: string | null;
  rating: number | string;
  feedback?: string | null;
  ai_category?: string | null;
  ai_sentiment?: string | null;
  ai_score?: number | string | null;
  created_at: string;
}

export interface HomepageReviewsResponse {
  topReviews: HomepageReview[];
  bestReviews: HomepageReview[];
  latestReviews: HomepageReview[];
}

export const DEFAULT_REVIEWS: HomepageReviewsResponse = {
  topReviews: [
    {
      id: "rev-1",
      customer_name: "Karthik Subramanian",
      rating: 5,
      feedback: "Best dry cleaners in Pollachi! Handled my wedding silk saree and suits with exceptional care. Timely pickup and delivery.",
      ai_category: "Dry Cleaning",
      ai_sentiment: "positive",
      created_at: "2026-10-15T10:00:00Z",
    },
    {
      id: "rev-2",
      customer_name: "Priya Anand",
      rating: 5,
      feedback: "Super convenient pickup service. Clothes were packed crisp with fresh fragrance. Highly recommended!",
      ai_category: "Quality",
      ai_sentiment: "positive",
      created_at: "2026-10-18T14:30:00Z",
    },
    {
      id: "rev-3",
      customer_name: "Dr. Ramesh Kumar",
      rating: 5,
      feedback: "Very professional steam ironing and stain removal. The app and WhatsApp updates keep me informed throughout.",
      ai_category: "Customer Service",
      ai_sentiment: "positive",
      created_at: "2026-10-22T09:15:00Z",
    },
  ],
  bestReviews: [
    {
      id: "rev-4",
      customer_name: "Anitha Venkatesh",
      rating: 5,
      feedback: "Leather bag cleaning was top notch. Restored like brand new!",
      ai_category: "Specialty Care",
      ai_sentiment: "positive",
      created_at: "2026-10-20T11:00:00Z",
    },
    {
      id: "rev-5",
      customer_name: "Ganesh Moorthy",
      rating: 5,
      feedback: "Reliable, transparent pricing and friendly staff at the Mahalingapuram branch.",
      ai_category: "Pricing & Trust",
      ai_sentiment: "positive",
      created_at: "2026-10-25T16:45:00Z",
    },
  ],
  latestReviews: [
    {
      id: "rev-6",
      customer_name: "Suresh Balaji",
      rating: 5,
      feedback: "Pickup from Kinathukadavu was seamless. Very happy with the bulk laundry wash & fold service.",
      ai_category: "Laundry by KG",
      ai_sentiment: "positive",
      created_at: "2026-10-28T12:00:00Z",
    },
  ],
};
