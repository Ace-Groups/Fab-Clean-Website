import crypto from "crypto";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_TubLxLl9x0nDNN";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "1gnPFz2z53xjd4pipXxSPNeY";

export type RazorpayOrderResponse = {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  created_at: number;
};

/**
 * Creates an order directly via Razorpay REST API without requiring external SDK dependency.
 */
export async function createRazorpayOrder(params: {
  amountInPaisa: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrderResponse> {
  const authHeader = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(params.amountInPaisa),
      currency: "INR",
      receipt: params.receipt,
      notes: params.notes || {},
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error?.description || body?.message || "Failed to create Razorpay order");
  }

  return body as RazorpayOrderResponse;
}

/**
 * Verifies Razorpay HMAC SHA256 Signature.
 */
export function verifyRazorpaySignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");

  return expectedSignature === params.signature;
}

/**
 * Verifies Razorpay Webhook Signature using Webhook Secret.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return expectedSignature === signature;
}

export function getRazorpayPublicConfig() {
  return {
    keyId: RAZORPAY_KEY_ID,
    currency: "INR",
    method: {
      upi: true,
      card: false,
      netbanking: false,
      wallet: false,
      emi: false,
      paylater: false,
    },
  };
}
