/**
 * MSG91 WhatsApp Integration for Payment Notifications
 * Configured for the exact customer payment update template:
 *
 * 🎉 *Payment {{1}}!*
 *
 * Dear {{2}},
 *
 * Here is an update regarding your recent payment with Fab Clean.
 *
 * 💳 *Payment Details*
 * - Amount Paid: ₹{{3}}
 * - Transaction ID: {{4}}
 * - Payment Status: {{5}}
 * - Date: {{6}}
 *
 * Thank you for choosing us!
 */

export interface WhatsAppPaymentUpdateParams {
  phoneNumber: string;
  customerName: string;
  amount: number | string;
  transactionId: string;
  paymentStatus?: 'Successful' | 'Completed' | 'Received' | 'Failed' | string;
  date?: string | Date;
  receiptPdfUrl?: string;
  templateName?: string;
}

const DEFAULT_AUTH_KEY = process.env.MSG91_AUTH_KEY || "491266AqsX3mD29Cew69c118abP1";
const DEFAULT_NUMBER = process.env.MSG91_WHATSAPP_NUMBER || process.env.MSG91_INTEGRATED_NUMBER || "15559458542";
const DEFAULT_NAMESPACE = process.env.MSG91_WHATSAPP_NAMESPACE || "5b9c340a_3221_42e3_9b9f_98b402c0c8ac";

function formatRecipientPhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

function formatDateDisplay(d?: string | Date): string {
  const dateObj = d ? new Date(d) : new Date();
  if (Number.isNaN(dateObj.getTime())) return new Date().toLocaleDateString('en-GB');
  return dateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatAmountNum(val: number | string): string {
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
  return num.toFixed(2);
}

/**
 * Sends the WhatsApp Payment Status Template (for both Successful and Failed payments)
 */
export async function sendWhatsAppPaymentUpdate(
  params: WhatsAppPaymentUpdateParams
): Promise<{ success: boolean; data?: any; error?: string }> {
  const cleanPhone = formatRecipientPhone(params.phoneNumber);
  const isFailed = String(params.paymentStatus || '').toLowerCase().includes('fail');

  // {{1}}: Status title (e.g. "Received", "Successful" or "Failed")
  const statusTitle = isFailed ? "Failed" : (params.paymentStatus || "Received");
  // {{2}}: Customer name
  const customerName = params.customerName || "Customer";
  // {{3}}: Amount Paid
  const amountStr = formatAmountNum(params.amount);
  // {{4}}: Transaction ID
  const transactionId = String(params.transactionId || Date.now());
  // {{5}}: Payment Status
  const paymentStatus = isFailed ? "Failed" : (params.paymentStatus || "Completed");
  // {{6}}: Date
  const dateStr = formatDateDisplay(params.date);

  const templateName = params.templateName || (isFailed
    ? (process.env.MSG91_TEMPLATE_NAME_PAYMENT_FAILED || "payment_update")
    : (process.env.MSG91_TEMPLATE_NAME_PAYMENT_CONFIRMED || "payment_update"));

  const components: Record<string, any> = {
    ...(params.receiptPdfUrl
      ? {
          header_1: {
            filename: `Receipt_${transactionId}.pdf`,
            type: "document",
            value: params.receiptPdfUrl,
          },
        }
      : {}),
    body_1: {
      type: "text",
      value: statusTitle,
    },
    body_2: {
      type: "text",
      value: customerName,
    },
    body_3: {
      type: "text",
      value: amountStr,
    },
    body_4: {
      type: "text",
      value: transactionId,
    },
    body_5: {
      type: "text",
      value: paymentStatus,
    },
    body_6: {
      type: "text",
      value: dateStr,
    },
  };

  const payload = {
    integrated_number: DEFAULT_NUMBER,
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: templateName,
        language: {
          code: "en",
          policy: "deterministic",
        },
        namespace: DEFAULT_NAMESPACE,
        to_and_components: [
          {
            to: [cleanPhone],
            components,
          },
        ],
      },
    },
  };

  try {
    const response = await fetch("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: DEFAULT_AUTH_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      console.warn(`[WhatsApp MSG91] Payment update template returned error:`, data);
      return { success: false, data, error: data?.message || "Failed to send WhatsApp message" };
    }

    console.log(`[WhatsApp MSG91] ✅ Payment ${statusTitle} sent to ${cleanPhone} (Tx: ${transactionId})`);
    return { success: true, data };
  } catch (err: any) {
    console.error(`[WhatsApp MSG91] Exception while sending payment update:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Legacy alias for order invoice dispatch
 */
export async function sendPaidInvoiceWhatsApp(params: {
  phoneNumber: string;
  customerName: string;
  orderNumber: string;
  amount: number | string;
  invoiceUrl: string;
  itemsSummary?: string;
}): Promise<{ success: boolean; error?: string }> {
  return sendWhatsAppPaymentUpdate({
    phoneNumber: params.phoneNumber,
    customerName: params.customerName,
    amount: params.amount,
    transactionId: params.orderNumber.replace(/#/g, ''),
    paymentStatus: 'Successful',
    receiptPdfUrl: params.invoiceUrl,
  });
}
