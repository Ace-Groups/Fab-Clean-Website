/**
 * MSG91 Email Service for Fab Clean
 * Primary email dispatch engine powered by MSG91 Email API.
 * Replaces Supabase Auth emails for authentication, OTPs, payment receipts, and order updates.
 */

export interface Msg91EmailRecipient {
  name?: string;
  email: string;
}

export interface Msg91SendEmailOptions {
  to: Msg91EmailRecipient | Msg91EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  fromEmail?: string;
  templateId?: string;
  variables?: Record<string, any>;
  domain?: string;
  attachments?: Array<{
    fileName: string;
    filePath?: string;
    fileContent?: string;
  }>;
}

export interface Msg91EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  data?: any;
}

const DEFAULT_AUTH_KEY = process.env.MSG91_AUTH_KEY || "491266AqsX3mD29Cew69c118abP1";
const DEFAULT_FROM_EMAIL = process.env.MSG91_FROM_EMAIL || process.env.SMTP_FROM_EMAIL || "otp@mail.myfabclean.com";
const DEFAULT_FROM_NAME = process.env.MSG91_FROM_NAME || "Fab Clean";
const DEFAULT_DOMAIN = process.env.MSG91_EMAIL_DOMAIN || "mail.myfabclean.com";
const ACE_DIGITAL_URL = "https://www.acedigital.cc";

/**
 * Base helper to send an email via MSG91 Email API (v5)
 */
export async function sendMsg91Email(options: Msg91SendEmailOptions): Promise<Msg91EmailResult> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const validRecipients = recipients.filter((r) => r.email && r.email.includes("@"));

  if (validRecipients.length === 0) {
    return { success: false, error: "No valid recipient email address provided" };
  }

  const authKey = process.env.MSG91_AUTH_KEY || DEFAULT_AUTH_KEY;
  if (!authKey) {
    console.warn("[MSG91 Email] Missing MSG91_AUTH_KEY. Cannot dispatch email.");
    return { success: false, error: "MSG91_AUTH_KEY is not configured" };
  }

  const from = {
    name: options.fromName || DEFAULT_FROM_NAME,
    email: options.fromEmail || DEFAULT_FROM_EMAIL,
  };

  // Determine whether to use template mode or direct HTML/subject mode
  const templateId = options.templateId || (options.variables ? process.env.MSG91_EMAIL_TEMPLATE_ID : undefined);

  let payload: Record<string, any>;

  if (templateId) {
    payload = {
      recipients: validRecipients.map((r) => ({
        to: [{ name: r.name || "Customer", email: r.email }],
        variables: options.variables || {},
      })),
      from,
      domain: options.domain || DEFAULT_DOMAIN,
      template_id: templateId,
      ...(options.attachments ? { attachments: options.attachments } : {}),
    };
  } else {
    payload = {
      to: validRecipients.map((r) => ({ name: r.name || "Customer", email: r.email })),
      from,
      subject: options.subject,
      body: options.html,
      domain: options.domain || DEFAULT_DOMAIN,
      ...(options.attachments ? { attachments: options.attachments } : {}),
    };
  }

  try {
    const response = await fetch("https://control.msg91.com/api/v5/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        authkey: authKey,
      },
      body: JSON.stringify(payload),
    });

    const data: any = await response.json().catch(() => null);

    if (!response.ok) {
      if (templateId && templateId !== "global_otp") {
        console.warn(`[MSG91 Email] Template "${templateId}" failed with status ${response.status}. Retrying with global_otp...`);
        const fallbackPayload = {
          ...payload,
          template_id: "global_otp",
        };
        const fbRes = await fetch("https://control.msg91.com/api/v5/email/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            authkey: authKey,
          },
          body: JSON.stringify(fallbackPayload),
        });
        const fbData: any = await fbRes.json().catch(() => null);
        if (fbRes.ok) {
          const firstRecipient = validRecipients[0].email;
          console.log(`[MSG91 Email] ✅ Email dispatched via global_otp fallback to ${firstRecipient}`);
          return { success: true, messageId: fbData?.data?.unique_id, data: fbData };
        }
      }

      console.warn("[MSG91 Email] API returned error status:", response.status, data);
      return {
        success: false,
        error: data?.message || data?.error || `MSG91 Email API returned status ${response.status}`,
        data,
      };
    }

    const firstRecipient = validRecipients[0].email;
    console.log(`[MSG91 Email] ✅ Email successfully dispatched to ${firstRecipient} | Subject: "${options.subject}"`);
    return {
      success: true,
      messageId: data?.request_id || data?.id,
      data,
    };
  } catch (err: any) {
    console.error("[MSG91 Email] Network/API exception while dispatching email:", err);
    return { success: false, error: err.message || "Failed to connect to MSG91 Email API" };
  }
}

/**
 * Sends Email Verification Code / OTP via MSG91
 * Replaces Supabase Auth OTP.
 */
export async function sendMsg91EmailOtp(params: {
  email: string;
  otp: string;
  customerName?: string;
}): Promise<Msg91EmailResult> {
  const customerName = params.customerName || "Valued Customer";
  const authKey = process.env.MSG91_AUTH_KEY || DEFAULT_AUTH_KEY;
  const otpTemplateId = process.env.MSG91_EMAIL_OTP_TEMPLATE_ID;

  // 1. If an explicit MSG91 OTP template ID is configured, call MSG91 OTP route
  if (otpTemplateId && authKey) {
    try {
      const otpRes = await fetch("https://control.msg91.com/api/v5/otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authkey: authKey,
        },
        body: JSON.stringify({
          email: params.email,
          otp: params.otp,
          template_id: otpTemplateId,
        }),
      });
      const data = await otpRes.json().catch(() => null);
      if (otpRes.ok) {
        console.log(`[MSG91 Email OTP] ✅ OTP dispatched via MSG91 OTP API to ${params.email}`);
        return { success: true, data };
      }
    } catch (err) {
      console.warn("[MSG91 Email OTP] OTP endpoint fallback to Email API:", err);
    }
  }

  // 2. Dispatch high-fidelity Fab Clean branded HTML email via MSG91 Email API
  const subject = `${params.otp} is your Fab Clean verification code`;
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Fab Clean Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 15px; background-color: #f3f4f6;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 18px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
          <!-- Top Accent Bar -->
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #059669 0%, #10b981 100%);"></td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="padding: 32px 36px 20px; border-bottom: 1px solid #f3f4f6;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size: 22px; font-weight: 800; color: #064e3b; letter-spacing: -0.5px;">🧺 FAB CLEAN</div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">Premium Garment &amp; Laundry Care</div>
                  </td>
                  <td align="right" style="font-size: 11px; color: #9ca3af;">
                    Official Verification
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 36px;">
              <h2 style="font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 12px;">Hello ${escapeHtml(customerName)},</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0 0 24px;">
                We received a request to verify your email address on Fab Clean. Please use the verification code below to complete your action:
              </p>
              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background-color: #ecfdf5; border: 1px dashed #059669; border-radius: 10px; padding: 20px;">
                    <span style="font-family: 'Courier New', monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #064e3b;">
                      ${escapeHtml(params.otp)}
                    </span>
                    <div style="font-size: 12px; color: #059669; margin-top: 6px; font-weight: 600;">Valid for 15 minutes</div>
                  </td>
                </tr>
              </table>
              <p style="font-size: 13px; line-height: 1.5; color: #6b7280; margin: 0 0 16px;">
                If you did not request this verification code, please ignore this email or contact our support team.
              </p>
              <div style="padding: 14px; background-color: #f8fafc; border-radius: 8px; font-size: 12px; color: #64748b; line-height: 1.5;">
                <strong>Support Contact:</strong> +91 93630 59595 | support@myfabclean.com<br>
                Yadvik Traaders, #16, Venketaramana Round Rd, Mahalingapuram, Pollachi – 642 002
              </div>
            </td>
          </tr>
          <!-- Footer with Clickable Ace Digital Link -->
          <tr>
            <td style="background-color: #064e3b; color: #ffffff; padding: 18px 36px; font-size: 12px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color: #d1fae5;">
                    Fab Clean • Automated Verification
                  </td>
                  <td align="right">
                    <a href="${ACE_DIGITAL_URL}" target="_blank" rel="noopener noreferrer" style="color: #6ee7b7; text-decoration: none; font-weight: 700;">
                      Powered by Ace Digital ↗
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendMsg91Email({
    to: { name: customerName, email: params.email },
    subject,
    html,
    templateId: process.env.MSG91_EMAIL_OTP_TEMPLATE_ID || "global_otp",
    variables: {
      otp: params.otp,
      company_name: "FAB CLEAN",
      app_name: "FAB CLEAN",
      name: customerName,
    },
    domain: process.env.MSG91_EMAIL_DOMAIN || DEFAULT_DOMAIN,
    fromEmail: process.env.MSG91_FROM_EMAIL || DEFAULT_FROM_EMAIL,
    fromName: "FAB CLEAN",
  });
}

/**
 * Dispatches Payment Received E-Receipt via MSG91 Email
 * Mirrors the clean IDFC First Bank 1-page layout with clickable Ace Digital footer.
 */
export async function sendMsg91PaymentSuccessEmail(params: {
  customerEmail: string;
  customerName: string;
  amount: number | string;
  transactionId: string;
  orderNumber: string;
  paymentMethod?: string;
  date?: string | Date;
  receiptPdfUrl?: string;
}): Promise<Msg91EmailResult> {
  const customerName = params.customerName || "Valued Customer";
  const amountStr = Number(params.amount || 0).toFixed(2);
  const dateStr = formatDate(params.date);
  const cleanOrder = params.orderNumber.replace(/#/g, "");

  const subject = `Payment Received: ₹${amountStr} for Order #${cleanOrder} | Fab Clean`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Payment Receipt - #${escapeHtml(cleanOrder)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 15px; background-color: #f3f4f6;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
          <!-- Top Accent -->
          <tr>
            <td style="height: 4px; background-color: #059669;"></td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px 16px;">
              <div style="font-size: 22px; font-weight: 900; color: #111827; letter-spacing: -0.5px;">🧺 FAB CLEAN</div>
              <div style="font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 2px;">Premium Garment Care</div>
              <div style="font-size: 16px; font-weight: 800; color: #111827; text-transform: uppercase; margin-top: 18px;">ALWAYS CLEAN ALWAYS FRESH</div>
              <div style="font-size: 14px; font-weight: 500; color: #4b5563; margin-top: 6px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb;">Transaction detail E-Receipt</div>
            </td>
          </tr>
          <!-- Key-Value Details (Exact IDFC Style) -->
          <tr>
            <td style="padding: 10px 40px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13.5px; line-height: 2.2;">
                <tr>
                  <td width="42%" style="color: #6b7280; font-weight: 400;">Transaction name</td>
                  <td width="58%" style="color: #111827; font-weight: 700;">${escapeHtml(customerName)}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-weight: 400;">Amount</td>
                  <td style="color: #111827; font-weight: 800; font-family: monospace; font-size: 15px;">₹${escapeHtml(amountStr)}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-weight: 400;">Category</td>
                  <td style="color: #111827; font-weight: 400;">Payments (Laundry &amp; Dry Cleaning)</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-weight: 400;">Payment date</td>
                  <td style="color: #111827; font-weight: 400;">${escapeHtml(dateStr)}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-weight: 400;">Transaction ID</td>
                  <td style="color: #111827; font-weight: 700; font-family: monospace;">${escapeHtml(params.transactionId)}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-weight: 400;">Payment type</td>
                  <td style="color: #111827; font-weight: 400;">${escapeHtml(params.paymentMethod || "Online transfer (UPI)")}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-weight: 400;">Order reference</td>
                  <td style="color: #111827; font-weight: 700;">#${escapeHtml(cleanOrder)}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-weight: 400;">Payment status</td>
                  <td style="color: #059669; font-weight: 800;">Successful</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-weight: 400; vertical-align: top;">Description</td>
                  <td style="color: #111827; font-family: monospace; font-size: 11.5px; word-break: break-all;">PAY/${escapeHtml(params.transactionId)}/${escapeHtml(cleanOrder)}</td>
                </tr>
              </table>
              ${params.receiptPdfUrl ? `
                <div style="margin-top: 24px; text-align: center;">
                  <a href="${escapeHtml(params.receiptPdfUrl)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 11px 24px; border-radius: 6px; font-weight: 700; font-size: 13px; text-decoration: none;">
                    📄 Download Official PDF Receipt
                  </a>
                </div>
              ` : ''}
            </td>
          </tr>
          <!-- Footer with Clickable Ace Digital Link -->
          <tr>
            <td style="border-top: 1px solid #e5e7eb; padding: 16px 40px; font-size: 12px; color: #9ca3af;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>Fab Clean • Automated E-Receipt</td>
                  <td align="right">
                    <a href="${ACE_DIGITAL_URL}" target="_blank" rel="noopener noreferrer" style="color: #4b5563; text-decoration: none; font-weight: 500;">
                      Powered by Ace Digital ↗
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendMsg91Email({
    to: { name: customerName, email: params.customerEmail },
    subject,
    html,
  });
}

/**
 * Dispatches Payment Failed Notice via MSG91 Email
 */
export async function sendMsg91PaymentFailedEmail(params: {
  customerEmail: string;
  customerName: string;
  amount: number | string;
  transactionId?: string;
  orderNumber: string;
  date?: string | Date;
  failureReason?: string;
  retryUrl?: string;
}): Promise<Msg91EmailResult> {
  const customerName = params.customerName || "Valued Customer";
  const amountStr = Number(params.amount || 0).toFixed(2);
  const dateStr = formatDate(params.date);
  const cleanOrder = params.orderNumber.replace(/#/g, "");
  const retryUrl = params.retryUrl || `https://myfabclean.com/pay/${cleanOrder}`;

  const subject = `Action Required: Payment Unsuccessful for Order #${cleanOrder} | Fab Clean`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Payment Failed - #${escapeHtml(cleanOrder)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 15px; background-color: #f3f4f6;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
          <!-- Top Accent (Red) -->
          <tr>
            <td style="height: 4px; background-color: #dc2626;"></td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px 16px;">
              <div style="font-size: 22px; font-weight: 900; color: #111827; letter-spacing: -0.5px;">🧺 FAB CLEAN</div>
              <div style="font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 2px;">Premium Garment Care</div>
              <div style="font-size: 16px; font-weight: 800; color: #111827; text-transform: uppercase; margin-top: 18px;">ALWAYS CLEAN ALWAYS FRESH</div>
              <div style="font-size: 14px; font-weight: 500; color: #dc2626; margin-top: 6px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb;">Payment Failed E-Notice</div>
            </td>
          </tr>
          <!-- Key-Value Details -->
          <tr>
            <td style="padding: 10px 40px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13.5px; line-height: 2.2;">
                <tr>
                  <td width="42%" style="color: #6b7280; font-weight: 400;">Transaction name</td>
                  <td width="58%" style="color: #111827; font-weight: 700;">${escapeHtml(customerName)}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-weight: 400;">Amount attempted</td>
                  <td style="color: #dc2626; font-weight: 800; font-family: monospace; font-size: 15px;">₹${escapeHtml(amountStr)}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-weight: 400;">Attempt date</td>
                  <td style="color: #111827; font-weight: 400;">${escapeHtml(dateStr)}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-weight: 400;">Order reference</td>
                  <td style="color: #111827; font-weight: 700;">#${escapeHtml(cleanOrder)}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-weight: 400;">Payment status</td>
                  <td style="color: #dc2626; font-weight: 800;">Failed</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-weight: 400; vertical-align: top;">Failure reason</td>
                  <td style="color: #dc2626; font-weight: 500;">${escapeHtml(params.failureReason || "Declined by issuing bank / session timed out")}</td>
                </tr>
              </table>

              <!-- Auto-refund reassurance -->
              <div style="margin-top: 20px; padding: 14px 16px; background-color: #fefce8; border: 1px solid #fde047; border-radius: 6px; font-size: 12px; color: #713f12; line-height: 1.5;">
                <strong>Did money get debited from your bank account?</strong><br>
                Please do not worry! In rare instances where an amount is debited from your account, your bank will automatically credit it back within <strong>3 to 5 business days</strong> per standard RBI guidelines.
              </div>

              <!-- Retry Button -->
              <div style="margin-top: 24px; text-align: center;">
                <a href="${escapeHtml(retryUrl)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 12px 28px; border-radius: 6px; font-weight: 700; font-size: 13px; text-decoration: none;">
                  🔄 Retry Payment Online Now
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer with Clickable Ace Digital Link -->
          <tr>
            <td style="border-top: 1px solid #e5e7eb; padding: 16px 40px; font-size: 12px; color: #9ca3af;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>Fab Clean Support: +91 93630 59595</td>
                  <td align="right">
                    <a href="${ACE_DIGITAL_URL}" target="_blank" rel="noopener noreferrer" style="color: #4b5563; text-decoration: none; font-weight: 500;">
                      Powered by Ace Digital ↗
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendMsg91Email({
    to: { name: customerName, email: params.customerEmail },
    subject,
    html,
  });
}

function formatDate(dateValue?: string | Date): string {
  const d = dateValue ? new Date(dateValue) : new Date();
  if (Number.isNaN(d.getTime())) return "29 Oct, 2026";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
