const getApiBase = () => {
  const configured = import.meta.env.VITE_API_URL?.trim();

  if (import.meta.env.PROD && !configured) {
    throw new Error("VITE_API_URL is required for production builds");
  }

  const candidate = configured || "/api";

  if (!candidate.startsWith("http://") && !candidate.startsWith("https://")) {
    return candidate;
  }

  const parsed = new URL(candidate);
  if (parsed.pathname === "/" || parsed.pathname === "") {
    parsed.pathname = "/api";
  }

  return parsed.toString();
};

const API_BASE = getApiBase().replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || "Request failed");
  }
  return payload as T;
}

export type PublicTrackedOrder = {
  id: string;
  reference: string;
  orderId: string;
  customerName?: string;
  status: string;
  paymentStatus?: string;
  totalAmount?: number;
  services: string[];
  branch: string;
  scheduledDate?: string;
  createdAt: string;
  updatedAt: string;
  invoiceUrl?: string;
  stages: Array<{
    stage: string;
    label: string;
    completed: boolean;
  }>;
};

export type FeedbackLookupResponse = {
  orderId: string;
  orderNumber: string;
  customerName?: string;
  status: string;
  existingReview?: {
    id: string;
    customer_name?: string | null;
    rating: number;
    feedback: string | null;
    feedback_source?: string | null;
    feedback_status: string;
    ai_category: string | null;
    ai_sentiment: string | null;
    ai_score: number | null;
    created_at?: string;
  } | null;
};

export type FeedbackSubmitResponse = {
  orderId: string;
  orderNumber: string;
  customerName?: string | null;
  reviewId: string;
  reviewCreatedAt?: string;
  insight: {
    category: string;
    sentiment: "positive" | "neutral" | "negative";
    score: number;
    summary: string;
  };
};

export type HomepageReview = {
  id: string;
  customer_name?: string | null;
  rating: number | string;
  feedback?: string | null;
  ai_category?: string | null;
  ai_sentiment?: string | null;
  ai_score?: number | string | null;
  created_at: string;
};

export type HomepageReviewsResponse = {
  topReviews: HomepageReview[];
  bestReviews: HomepageReview[];
  latestReviews: HomepageReview[];
};

import {
  DEFAULT_STORES,
  DEFAULT_REVIEWS,
  type Store,
  type HomepageReview,
  type HomepageReviewsResponse,
} from "./site-catalog";

export type { Store, HomepageReview, HomepageReviewsResponse };

function normalizeStoreAddress(address: unknown): string {
  if (typeof address !== "string") return "";
  const trimmed = address.trim();
  if (!trimmed || trimmed === "{}" || trimmed === "null" || trimmed === "undefined") return "";
  return trimmed;
}

function sanitizeStores(stores: Store[]): Store[] {
  return stores
    .filter((store) => {
      const slug = String(store.slug || "").toLowerCase();
      const name = String(store.name || "").toLowerCase();
      // MCET was removed from customer surfaces; keep it out of selectors.
      return !name.includes("mcet") && !slug.includes("mcet");
    })
    .map((store) => ({
      ...store,
      address: normalizeStoreAddress(store.address),
    }));
}

export async function fetchStores() {
  try {
    const res = await request<{ success: boolean; data: Store[] }>("/stores");
    if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
      return { ...res, data: sanitizeStores(res.data) };
    }
    return { success: true, data: sanitizeStores(DEFAULT_STORES) };
  } catch {
    return { success: true, data: sanitizeStores(DEFAULT_STORES) };
  }
}

export async function trackOrderById(identifier: string) {
  return request<{ success: boolean; data: PublicTrackedOrder }>(
    `/orders/track/by-id/${encodeURIComponent(identifier)}`,
  );
}

export async function lookupFeedbackOrder(identifier: string) {
  return request<{ success: boolean; data: FeedbackLookupResponse }>(
    `/feedback/order/${encodeURIComponent(identifier)}`,
  );
}

export async function submitPublicFeedback(payload: {
  identifier: string;
  rating: number;
  feedback: string;
}) {
  return request<{ success: boolean; data: FeedbackSubmitResponse }>("/feedback/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchHomepageReviews() {
  try {
    const res = await request<{ success: boolean; data: HomepageReviewsResponse }>("/reviews/homepage");
    if (res?.success && res.data && (res.data.topReviews?.length || res.data.bestReviews?.length || res.data.latestReviews?.length)) {
      return res;
    }
    return { success: true, data: DEFAULT_REVIEWS };
  } catch {
    return { success: true, data: DEFAULT_REVIEWS };
  }
}

export type CustomerLookupResult = {
  id?: string;
  name?: string;
  phone?: string;
  address?: string;
  addresses?: string[];
  branch?: string | null;
  totalOrders?: number;
  isDiwaliEligible: boolean;
  isExisting: boolean;
};

export async function lookupCustomer(phone: string): Promise<CustomerLookupResult | null> {
  const cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length < 10) return null;

  try {
    const res = await request<{ success: boolean; data: CustomerLookupResult }>(
      `/pickups/customer-lookup?phone=${encodeURIComponent(cleanPhone)}`
    );
    if (res?.success && res.data) {
      return res.data;
    }
    return null;
  } catch (err) {
    console.warn("[CustomerLookup] Request error:", err);
    return null;
  }
}

export type WebsitePickupPayload = {
  name: string;
  phone: string;
  address: string;
  services: string[];
  branch: string;
  preferredDate: string;
  timeSlot: string;
  specialInstructions?: string;
  couponCode?: string;
};

export async function submitWebsitePickup(payload: WebsitePickupPayload) {
  return request<{ success: boolean; data: { id: string; bookingReference: string; message: string } }>(
    "/pickups",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}
