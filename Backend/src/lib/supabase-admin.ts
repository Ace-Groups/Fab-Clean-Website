export type SupabaseMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function buildUrl(path: string): string {
  const baseUrl = getRequiredEnv("SUPABASE_URL").replace(/\/$/, "");
  return `${baseUrl}${path}`;
}

export async function supabaseRequest<T>(
  path: string,
  method: SupabaseMethod = "GET",
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const serviceKey = getRequiredEnv("SUPABASE_SERVICE_KEY");
  const response = await fetch(buildUrl(path), {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(parsed?.message || parsed?.error || text || `Supabase request failed: ${response.status}`);
  }

  return parsed as T;
}

async function request<T>(
  path: string,
  method: SupabaseMethod,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  return supabaseRequest<T>(path, method, body, extraHeaders);
}

export type PublicOrderRecord = {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  payment_status: string | null;
  total_amount: number | string | null;
  items: unknown[] | null;
  fulfillment_type: string | null;
  pickup_date: string | null;
  invoice_url: string | null;
  created_at: string;
  updated_at: string;
  rating?: number | null;
  feedback?: string | null;
  ai_category?: string | null;
  ai_sentiment?: string | null;
  ai_score?: number | null;
};

export type ReviewRecord = {
  id: string;
  order_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  rating: number;
  feedback: string | null;
  feedback_source: string | null;
  feedback_status: string;
  ai_category: string | null;
  ai_sentiment: string | null;
  ai_score: number | null;
  created_at: string;
};

export type PublicWebsiteReview = {
  id: string;
  customer_name: string | null;
  rating: number | string;
  feedback: string | null;
  ai_category: string | null;
  ai_sentiment: string | null;
  ai_score: number | string | null;
  created_at: string;
};

export type CustomerRecord = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  secondary_phone?: string | null;
  address: string | Record<string, unknown> | null;
  wallet_balance_cache?: number | string | null;
  credit_balance?: number | string | null;
  total_orders?: number | string | null;
  total_spent?: number | string | null;
  created_at?: string | null;
};

export type WalletSummary = {
  balance: number;
  creditBalance: number;
  totalOrders: number;
  totalSpent: number;
};

export type AppStoreRecord = {
  code: string;
  slug: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  map_href: string | null;
  is_active: boolean | null;
  sort_order: number | string | null;
};

function encodeIdentifier(value: string): string {
  return encodeURIComponent(value.trim());
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

function normalizeOrderIdentifier(value: string): string {
  return value.trim();
}

function normalizeOrderNumber(value: string): string {
  return normalizeOrderIdentifier(value).toUpperCase();
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(-10);
}

function phoneCandidates(value: string): string[] {
  const digits = value.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  return Array.from(new Set([
    value,
    digits,
    last10,
    `91${last10}`,
    `+91${last10}`,
    `+${digits}`,
  ])).filter(Boolean);
}

export async function fetchOrderByIdentifier(identifier: string): Promise<PublicOrderRecord | null> {
  const clean = normalizeOrderIdentifier(identifier);
  if (!clean) return null;

  const select =
    "id,order_number,customer_id,customer_name,customer_phone,status,payment_status,total_amount,items,fulfillment_type,pickup_date,invoice_url,created_at,updated_at,rating,feedback,ai_category,ai_sentiment,ai_score";

  if (isUuid(clean)) {
    const byId = await request<PublicOrderRecord[]>(
      `/rest/v1/orders?select=${select}&id=eq.${encodeIdentifier(clean)}&limit=1`,
      "GET",
    );
    if (byId[0]) return byId[0];
  }

  const byOrderNumber = await request<PublicOrderRecord[]>(
    `/rest/v1/orders?select=${select}&order_number=eq.${encodeIdentifier(normalizeOrderNumber(clean))}&limit=1`,
    "GET",
  );
  if (byOrderNumber[0]) return byOrderNumber[0];

  if (!isUuid(clean)) {
    return null;
  }

  const byRawOrderNumber = await request<PublicOrderRecord[]>(
    `/rest/v1/orders?select=${select}&order_number=eq.${encodeIdentifier(clean)}&limit=1`,
    "GET",
  );
  return byRawOrderNumber[0] ?? null;
}

export async function fetchCustomerByPhone(phone: string): Promise<CustomerRecord | null> {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) return null;

  const candidates = phoneCandidates(phone);

  for (const candidate of candidates) {
    const rows = await request<CustomerRecord[]>(
      `/rest/v1/customers?select=id,name,email,phone,secondary_phone,address,wallet_balance_cache,credit_balance,total_orders,total_spent,created_at&or=(phone.eq.${encodeIdentifier(candidate)},secondary_phone.eq.${encodeIdentifier(candidate)})&limit=1`,
      "GET",
    );
    if (rows[0]) return rows[0];
  }

  return null;
}

export async function updateCustomerById(customerId: string, payload: Record<string, unknown>): Promise<CustomerRecord | null> {
  const rows = await request<CustomerRecord[]>(
    `/rest/v1/customers?id=eq.${encodeIdentifier(customerId)}`,
    "PATCH",
    payload,
    {
      Prefer: "return=representation",
    },
  );

  return rows[0] ?? null;
}

export async function fetchOrdersByPhone(phone: string): Promise<PublicOrderRecord[]> {
  const cleanPhone = normalizePhone(phone);
  const customer = await fetchCustomerByPhone(cleanPhone);
  const select =
    "id,order_number,customer_id,customer_name,customer_phone,status,payment_status,total_amount,items,fulfillment_type,pickup_date,invoice_url,created_at,updated_at,rating,feedback,ai_category,ai_sentiment,ai_score";

  const candidates = phoneCandidates(cleanPhone);
  if (customer?.phone) {
    candidates.push(...phoneCandidates(customer.phone));
  }
  if (customer?.secondary_phone) {
    candidates.push(...phoneCandidates(customer.secondary_phone));
  }
  const filterList: string[] = Array.from(new Set(candidates)).map(
    (candidate) => `customer_phone.eq.${encodeIdentifier(candidate)}`,
  );
  if (customer?.id) {
    filterList.push(`customer_id.eq.${encodeIdentifier(customer.id)}`);
  }
  if (customer?.email) {
    filterList.push(`customer_email.eq.${encodeIdentifier(customer.email)}`);
  }
  const orCondition = filterList.join(",");

  const orders = await request<PublicOrderRecord[]>(
    `/rest/v1/orders?select=${select}&or=(${orCondition})&order=created_at.desc`,
    "GET",
  );

  const seen = new Set<string>();
  return orders.filter((o) => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
}

export async function fetchOwnedOrderById(phone: string, orderId: string): Promise<PublicOrderRecord | null> {
  const orders = await fetchOrdersByPhone(phone);
  return orders.find((order) => order.id === orderId) ?? null;
}

export function mapWalletSummary(customer: CustomerRecord | null): WalletSummary {
  return {
    balance: Number(customer?.wallet_balance_cache ?? 0),
    creditBalance: Number(customer?.credit_balance ?? 0),
    totalOrders: Number(customer?.total_orders ?? 0),
    totalSpent: Number(customer?.total_spent ?? 0),
  };
}

export async function fetchReviewByOrderId(orderId: string): Promise<ReviewRecord | null> {
  const rows = await request<ReviewRecord[]>(
    `/rest/v1/reviews_table?select=id,order_id,customer_id,customer_name,customer_phone,rating,feedback,feedback_source,feedback_status,ai_category,ai_sentiment,ai_score,created_at&order_id=eq.${encodeIdentifier(orderId)}&limit=1`,
    "GET",
  );
  return rows[0] ?? null;
}

export async function upsertReview(payload: Record<string, unknown>): Promise<ReviewRecord> {
  const rows = await request<ReviewRecord[]>(
    `/rest/v1/reviews_table?on_conflict=order_id`,
    "POST",
    payload,
    {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
  );
  if (!rows[0]) {
    throw new Error("Failed to upsert review");
  }
  return rows[0];
}

export async function updateOrder(orderId: string, payload: Record<string, unknown>): Promise<void> {
  await request(
    `/rest/v1/orders?id=eq.${encodeIdentifier(orderId)}`,
    "PATCH",
    payload,
    {
      Prefer: "return=minimal",
    },
  );
}

export async function insertTransaction(payload: Record<string, unknown>): Promise<any> {
  return request(`/rest/v1/transactions`, "POST", payload, {
    Prefer: "return=representation",
  });
}

export async function insertCreditTransaction(payload: Record<string, unknown>): Promise<any> {
  return request(`/rest/v1/credit_transactions`, "POST", payload, {
    Prefer: "return=representation",
  });
}

export async function insertWalletTransaction(payload: Record<string, unknown>): Promise<any> {
  return request(`/rest/v1/wallet_transactions`, "POST", payload, {
    Prefer: "return=representation",
  });
}

export async function fetchWalletTransactions(customerId: string): Promise<any[]> {
  return request<any[]>(
    `/rest/v1/wallet_transactions?customer_id=eq.${encodeIdentifier(customerId)}&order=created_at.desc&limit=50`,
    "GET",
  );
}

export async function callRpc<T>(name: string, payload?: Record<string, unknown>): Promise<T> {
  return request<T>(`/rest/v1/rpc/${name}`, "POST", payload ?? {});
}

export async function fetchAppStores(): Promise<AppStoreRecord[]> {
  try {
    return await request<AppStoreRecord[]>(
      "/rest/v1/mapp_store_registry?select=code,slug,name,address,phone,email,latitude,longitude,map_href,is_active,sort_order&is_active=eq.true&order=sort_order.asc,name.asc",
      "GET",
    );
  } catch {
    return [];
  }
}

export async function fetchHomepageReviews() {
  const select = "id,customer_name,rating,feedback,ai_category,ai_sentiment,ai_score,created_at";

  const [topReviews, bestReviews, latestReviews] = await Promise.all([
    request<PublicWebsiteReview[]>(`/rest/v1/website_top_reviews?select=${select}&limit=6`, "GET"),
    request<PublicWebsiteReview[]>(`/rest/v1/website_best_reviews?select=${select}&limit=6`, "GET"),
    request<PublicWebsiteReview[]>(`/rest/v1/website_latest_reviews?select=${select}&limit=6`, "GET"),
  ]);

  return {
    topReviews,
    bestReviews,
    latestReviews,
  };
}
