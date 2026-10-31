import { getApiBaseUrl } from "@/lib/api-base";

const API_BASE = getApiBaseUrl();

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || "Request failed");
  }

  return payload as T;
}

export type WalletSummary = {
  balance: number;
  creditBalance: number;
  totalOrders: number;
  totalSpent: number;
  currency: string;
  available: boolean;
};

export type PortalPickup = {
  id: string;
  bookingReference: string;
  customerName: string;
  customerPhone: string;
  status: string;
  preferredDate: string;
  timeSlot: string;
  branch: string;
  services: string[];
  address: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export async function fetchWalletSummary(token: string) {
  return request<{ success: boolean; data: WalletSummary }>("/api/wallet/summary", token);
}

export async function fetchPortalPickups(token: string, since?: string) {
  const suffix = since ? `?since=${encodeURIComponent(since)}` : "";
  return request<{ success: boolean; data: PortalPickup[]; meta: { total: number } }>(`/api/pickups${suffix}`, token);
}

export type PortalProfile = {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  addresses?: string[];
  createdAt?: string;
};

export type PortalProfilePatch = {
  name?: string;
  email?: string;
  avatarUrl?: string;
  addresses?: string[];
};

export async function fetchPortalProfile(token: string) {
  return request<{ success: boolean; data: PortalProfile }>("/api/users/profile", token);
}

export async function patchPortalProfile(token: string, data: PortalProfilePatch) {
  return request<{ success: boolean; data: PortalProfile }>("/api/users/profile", token, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
