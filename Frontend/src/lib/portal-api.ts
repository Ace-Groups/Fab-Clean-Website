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

export async function fetchWalletTransactions(token: string) {
  return request<{ success: boolean; data: any[] }>("/api/wallet/transactions", token);
}

export async function createWalletRechargeOrder(token: string, amount: number) {
  return request<{
    success: boolean;
    data: {
      orderId: string;
      amount: number;
      currency: string;
      keyId: string;
      customer: { name: string; email: string; phone: string };
    };
  }>("/api/wallet/create-recharge-order", token, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

export async function verifyWalletRecharge(
  token: string,
  params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    amount: number;
  }
) {
  return request<{ success: boolean; message: string; data: any }>("/api/wallet/verify-recharge", token, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function createOrderPayOrder(token: string, orderId: string) {
  return request<{
    success: boolean;
    data: {
      orderId: string;
      amount: number;
      currency: string;
      keyId: string;
      orderNumber: string;
      totalAmount: number;
      customer: { name: string; email: string; phone: string };
    };
  }>(`/api/orders/${orderId}/create-pay-order`, token, {
    method: "POST",
  });
}

export async function verifyOrderPayment(
  token: string,
  orderId: string,
  params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }
) {
  return request<{ success: boolean; message: string; data: any }>(`/api/orders/${orderId}/verify-pay`, token, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function payOrderWithWallet(token: string, orderId: string) {
  return request<{ success: boolean; message: string; data: any }>(`/api/orders/${orderId}/pay-with-wallet`, token, {
    method: "POST",
  });
}
