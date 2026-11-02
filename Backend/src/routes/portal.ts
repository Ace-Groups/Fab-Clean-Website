import { FAB_CLEAN_LOGO_BASE64 } from "../assets/logo-base64.js";
import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, pool } from "@workspace/db";
import { pickupsTable, usersTable } from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";
import { requireAuth, JWT_SECRET, normalizePhone } from "../lib/auth.js";
import {
  fetchCustomerByPhone,
  fetchOrdersByPhone,
  fetchOwnedOrderById,
  mapWalletSummary,
  updateCustomerById,
  supabaseRequest,
  insertWalletTransaction,
} from "../lib/supabase-admin.js";

const router: IRouter = Router();

// requireAuth is applied to individual routes instead of globally to avoid hijacking non-matching routes

function mapOrder(order: Awaited<ReturnType<typeof fetchOrdersByPhone>>[number]) {
  const total = Number(order.total_amount ?? 0);
  const advance = Number((order as any).advance_paid ?? 0);
  const credit = Number((order as any).credit_used ?? Math.max(0, total - advance));
  const rawItems = Array.isArray(order.items) ? order.items : [];
  const normalizedItems = rawItems.map((item: any) => ({
    name: item.serviceName || item.name || "Garment Service",
    quantity: Number(item.quantity || 1),
    price: Number(item.price || item.unitPrice || 0),
    subtotal: Number(item.subtotal || item.total || (Number(item.quantity || 1) * Number(item.price || 0))),
  }));

  return {
    id: order.id,
    reference: order.order_number,
    status: order.status,
    services: normalizedItems.length > 0 ? normalizedItems.map((it) => it.name) : ["Dry Cleaning & Laundry"],
    items: normalizedItems,
    branch: order.fulfillment_type || "pickup",
    scheduledDate: order.pickup_date || undefined,
    createdAt: order.created_at,
    totalAmount: total,
    paymentStatus: order.payment_status || (credit > 0 ? (advance > 0 ? "partial" : "unpaid") : "paid"),
    paymentMethod: (order as any).payment_method || "credit",
    advancePaid: advance,
    creditAmount: credit,
    dueAmount: Math.max(0, total - advance),
    isCreditOrder: Boolean((order as any).is_credit_order || credit > 0),
    invoiceUrl: order.invoice_url || `/api/orders/${order.id}/receipt`,
    stainPhotos: Array.isArray((order as any).stain_photos || (order as any).stainPhotos)
      ? ((order as any).stain_photos || (order as any).stainPhotos)
      : [],
    garmentDefects: (order as any).garment_defects || (order as any).notes || null,
  };
}

function phoneCandidates(phone: string): string[] {
  const digits = String(phone || "").replace(/\D/g, "");
  const last10 = digits.slice(-10);
  return Array.from(
    new Set([
      phone,
      digits,
      last10,
      `+${digits}`,
      `91${last10}`,
      `+91${last10}`,
    ]),
  ).filter(Boolean);
}

router.get("/orders", requireAuth, async (req, res) => {
  try {
    const orders = await fetchOrdersByPhone(req.authUser!.phone);
    res.json({
      success: true,
      data: orders.map(mapOrder),
    });
  } catch (err) {
    req.log.error(err, "Failed to list portal orders");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to load orders" },
    });
  }
});

router.get("/orders/:id", requireAuth, async (req, res) => {
  try {
    const order = await fetchOwnedOrderById(req.authUser!.phone, req.params.id as string);
    if (!order) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Order not found" },
      });
      return;
    }

    res.json({
      success: true,
      data: mapOrder(order),
    });
  } catch (err) {
    req.log.error(err, "Failed to load portal order");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to load order" },
    });
  }
});

router.get("/orders/:id/receipt", async (req, res) => {
  try {
    const idParam = String(req.params.id || "").trim();
    if (!idParam) {
      return res.status(400).send("<h3>Invalid order identifier</h3>");
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idParam);
    const filter = isUuid
      ? `or=(id.eq.${encodeURIComponent(idParam)},order_number.eq.${encodeURIComponent(idParam)})`
      : `order_number=eq.${encodeURIComponent(idParam)}`;

    const orders = await supabaseRequest<any[]>(
      `/rest/v1/orders?${filter}&limit=1`,
      "GET",
    );
    const order = orders[0];
    if (!order) {
      return res.status(404).send("<h3>Order receipt not found</h3>");
    }

    if (order.invoice_url && !order.invoice_url.includes("/api/orders/")) {
      return res.redirect(order.invoice_url);
    }

    const mapped = mapOrder(order);
    const dateFormatted = order.created_at ? new Date(order.created_at).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    }) : "Recent";
    const isPaid = mapped.paymentStatus === "paid";
    const statusBg = isPaid ? "#dcfce7" : "#fef3c7";
    const statusColor = isPaid ? "#166534" : "#b45309";

    const itemsRows = mapped.items.map((it) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 12px 8px; font-weight: 600; color: #1e293b;">${it.name}</td>
        <td style="padding: 12px 8px; text-align: center; color: #64748b;">${it.quantity}</td>
        <td style="padding: 12px 8px; text-align: right; color: #64748b;">₹${it.price.toFixed(2)}</td>
        <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: #0f172a;">₹${it.subtotal.toFixed(2)}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt #${order.order_number} | Fab Clean</title>
  <style>
    @media print { .no-print { display: none !important; } body { padding: 0 !important; } }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 20px; }
    .card { max-width: 580px; margin: 0 auto; background: #fff; border-radius: 18px; box-shadow: 0 4px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; overflow: hidden; }
  </style>
</head>
<body>
  <div class="card">
    <div style="background: linear-gradient(135deg, #042f2e, #0f172a); padding: 26px 20px; color: #fff; text-align: center; border-bottom: 2px solid rgba(16,185,129,0.2);">
      <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 10px;">
        <img src="${FAB_CLEAN_LOGO_BASE64}" alt="Fab Clean" style="height: 52px; width: auto; object-fit: contain; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3)); background: rgba(255,255,255,0.96); padding: 5px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2);" />
      </div>
      <p style="margin: 2px 0 0; font-size: 12px; font-weight: 600; color: #6ee7b7; letter-spacing: 0.8px; text-transform: uppercase;">Premium Garment Care & Laundry</p>
      <div style="margin-top: 12px; display: inline-block; padding: 5px 14px; border-radius: 9999px; background: ${statusBg}; color: ${statusColor}; font-weight: 800; font-size: 11px; letter-spacing: 0.8px;">
        ${mapped.paymentStatus.toUpperCase()}
      </div>
    </div>
    <div style="padding: 24px;">
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 16px;">
        <div>
          <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Order Reference</div>
          <div style="font-size: 16px; font-weight: 800; color: #0f172a;">#${order.order_number}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">${dateFormatted}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Customer</div>
          <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${order.customer_name || "Valued Customer"}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">${order.customer_phone || ""}</div>
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
        <thead>
          <tr style="border-bottom: 2px solid #e2e8f0; color: #64748b; text-align: left; font-size: 11px; text-transform: uppercase;">
            <th style="padding: 8px;">Service Item</th>
            <th style="padding: 8px; text-align: center;">Qty</th>
            <th style="padding: 8px; text-align: right;">Rate</th>
            <th style="padding: 8px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
      <div style="background: #f8fafc; border-radius: 12px; padding: 14px; font-size: 13px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #64748b;">
          <span>Subtotal</span>
          <span style="font-weight: 600;">₹${mapped.totalAmount.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #64748b;">
          <span>Advance Paid (${mapped.paymentMethod})</span>
          <span style="font-weight: 600; color: #059669;">-₹${mapped.advancePaid.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 1.5px solid #e2e8f0; font-size: 15px; font-weight: 800; color: #0f172a;">
          <span>Balance Due</span>
          <span style="color: ${mapped.dueAmount > 0 ? '#b91c1c' : '#059669'};">₹${mapped.dueAmount.toFixed(2)}</span>
        </div>
      </div>
      <div class="no-print" style="margin-top: 24px; text-align: center;">
        <button onclick="window.print()" style="background: #0f172a; color: #fff; border: none; padding: 12px 24px; font-size: 13px; font-weight: 700; border-radius: 10px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          🖨️ Print / Save as PDF
        </button>
      </div>
    </div>
  </div>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    req.log?.error(err, "Failed to generate receipt");
    res.status(500).send("<h3>Failed to generate receipt</h3>");
  }
});

interface EmailOtpEntry {
  code: string;
  expiresAt: number;
}
const emailOtpCache = new Map<string, EmailOtpEntry>();

router.get("/users/profile", requireAuth, async (req, res) => {
  try {
    const [user, customer] = await Promise.all([
      db.query.usersTable.findFirst({
        where: eq(usersTable.id, req.authUser!.userId),
      }),
      fetchCustomerByPhone(req.authUser!.phone),
    ]);

    const customerAddr = (typeof customer?.address === "object" && customer?.address !== null)
      ? (customer.address as Record<string, unknown>)
      : {};

    const rawAddresses: string[] = [];
    if (Array.isArray(user?.addresses)) rawAddresses.push(...user.addresses);
    if (Array.isArray(customerAddr.addresses)) rawAddresses.push(...customerAddr.addresses);
    if (typeof customerAddr.street === "string" && customerAddr.street.trim()) {
      const fullStreet = [customerAddr.street, customerAddr.city, customerAddr.pincode].filter(Boolean).join(", ");
      if (fullStreet) rawAddresses.push(fullStreet);
    }

    const uniqueAddresses = Array.from(new Set(rawAddresses.filter((a) => typeof a === "string" && a.trim() !== "")));
    const rawGst = String(customerAddr.gst_number || customerAddr.gstNumber || customerAddr.gstin || "").trim();
    const gstNumber = (rawGst && rawGst !== "33AAAAA0000A1Z5") ? rawGst : undefined;
    const emailVerified = Boolean(customerAddr.email_verified || customerAddr.emailVerified || false);

    res.json({
      success: true,
      data: {
        id: user?.id || req.authUser!.userId,
        phone: req.authUser!.phone,
        name: user?.name || customer?.name || undefined,
        email: user?.email || customer?.email || undefined,
        emailVerified,
        avatarUrl: (customerAddr.avatar_url as string) || (customerAddr.avatarUrl as string) || undefined,
        gstNumber: gstNumber || undefined,
        addresses: uniqueAddresses,
        createdAt: user?.createdAt?.toISOString?.() || customer?.created_at || undefined,
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to load user profile");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to load profile" },
    });
  }
});

router.patch("/users/profile", requireAuth, async (req, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : undefined;
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : undefined;
    const rawGst = typeof req.body?.gstNumber === "string" 
      ? req.body.gstNumber.trim().toUpperCase() 
      : typeof req.body?.gst_number === "string"
      ? req.body.gst_number.trim().toUpperCase()
      : undefined;

    // GST is strictly optional: empty string or placeholder "33AAAAA0000A1Z5" becomes null
    const gstNumber = (rawGst && rawGst !== "33AAAAA0000A1Z5") ? rawGst : (rawGst !== undefined ? null : undefined);

    const addresses = Array.isArray(req.body?.addresses)
      ? req.body.addresses.filter((a: any) => typeof a === "string" && a.trim() !== "")
      : undefined;
    const avatarUrl = typeof req.body?.avatarUrl === "string"
      ? req.body.avatarUrl.trim()
      : typeof req.body?.avatar_url === "string"
      ? req.body.avatar_url.trim()
      : undefined;

    const [existingUser, customer] = await Promise.all([
      db.query.usersTable.findFirst({
        where: eq(usersTable.id, req.authUser!.userId),
      }),
      fetchCustomerByPhone(req.authUser!.phone),
    ]);

    // If email is changed, reset email verification status to false until re-verified with OTP
    const isEmailChanging = email !== undefined && email !== (customer?.email || existingUser?.email);

    const [updatedUser] = await Promise.all([
      db
        .update(usersTable)
        .set({
          ...(name !== undefined ? { name: name || null } : {}),
          ...(email !== undefined ? { email: email || null } : {}),
          ...(addresses !== undefined ? { addresses } : {}),
        })
        .where(eq(usersTable.id, req.authUser!.userId))
        .returning()
        .then((rows) => rows[0]),
    ]);

    let updatedCustomer = customer;
    if (customer?.id) {
      const currentAddr = (typeof customer.address === "object" && customer.address !== null)
        ? (customer.address as Record<string, unknown>)
        : {};

      const newAddressObj: Record<string, unknown> = {
        ...currentAddr,
        ...(avatarUrl !== undefined ? { avatar_url: avatarUrl, avatarUrl } : {}),
        ...(gstNumber !== undefined ? { gst_number: gstNumber, gstNumber } : {}),
        ...(isEmailChanging ? { email_verified: false, emailVerified: false } : {}),
        ...(addresses !== undefined ? { addresses } : {}),
      };

      updatedCustomer = await updateCustomerById(customer.id, {
        ...(name !== undefined ? { name: name || null } : {}),
        ...(email !== undefined ? { email: email || null } : {}),
        address: newAddressObj,
      });
    }

    const customerAddr = (typeof updatedCustomer?.address === "object" && updatedCustomer?.address !== null)
      ? (updatedCustomer.address as Record<string, unknown>)
      : {};

    const rawCustGst = String(customerAddr.gst_number || customerAddr.gstNumber || "").trim();
    const resolvedGst = (rawCustGst && rawCustGst !== "33AAAAA0000A1Z5") ? rawCustGst : undefined;
    const resolvedEmailVerified = isEmailChanging ? false : Boolean(customerAddr.email_verified || customerAddr.emailVerified || false);

    res.json({
      success: true,
      data: {
        id: updatedUser?.id || req.authUser!.userId,
        phone: req.authUser!.phone,
        name: updatedUser?.name || updatedCustomer?.name || undefined,
        email: updatedUser?.email || updatedCustomer?.email || undefined,
        emailVerified: resolvedEmailVerified,
        avatarUrl: (customerAddr.avatar_url as string) || (customerAddr.avatarUrl as string) || avatarUrl || undefined,
        gstNumber: resolvedGst,
        addresses: updatedUser?.addresses || (customerAddr.addresses as string[]) || [],
        createdAt: updatedUser?.createdAt?.toISOString?.() || updatedCustomer?.created_at || undefined,
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to update user profile");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to update profile" },
    });
  }
});

router.post("/users/send-email-otp", requireAuth, async (req, res) => {
  try {
    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const phone = req.authUser!.phone;
    const customer = await fetchCustomerByPhone(phone);
    const targetEmail = (rawEmail || customer?.email || "").toLowerCase().trim();

    if (!targetEmail || !targetEmail.includes("@")) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Please enter a valid email address" },
      });
      return;
    }

    const isDemo = targetEmail === "kavinbalaji365@gmail.com" || phone.includes("8825702072") || phone.includes("9087172072");
    const code = isDemo ? "3223" : Math.floor(100000 + Math.random() * 900000).toString();

    emailOtpCache.set(targetEmail, {
      code,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    req.log.info({ targetEmail, isDemo }, "Email verification OTP generated");

    // 1. Dispatch Supabase Auth OTP (triggers branded verification email)
    try {
      const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
      const serviceKey = process.env.SUPABASE_SERVICE_KEY;
      if (baseUrl && serviceKey) {
        await fetch(`${baseUrl}/auth/v1/otp`, {
          method: "POST",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: targetEmail,
            create_user: true,
          }),
        }).catch(() => {});
      }
    } catch (_) {}

    // 2. Dispatch MSG91 OTP route if configured
    try {
      const authKey = process.env.MSG91_AUTH_KEY;
      if (authKey) {
        await fetch("https://control.msg91.com/api/v5/otp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authkey: authKey,
          },
          body: JSON.stringify({
            email: targetEmail,
            otp: code,
          }),
        }).catch(() => {});
      }
    } catch (_) {}

    res.json({
      success: true,
      message: `Verification code sent to ${targetEmail}`,
      data: {
        email: targetEmail,
        isDemo,
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to send email OTP");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to send email verification code" },
    });
  }
});

router.post("/users/verify-email-otp", requireAuth, async (req, res) => {
  try {
    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
    const phone = req.authUser!.phone;

    if (!rawEmail || !otp) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Email and verification code are required" },
      });
      return;
    }

    const cached = emailOtpCache.get(rawEmail);
    const isDemo = rawEmail === "kavinbalaji365@gmail.com" || phone.includes("8825702072") || phone.includes("9087172072");
    let isMatch = (cached && cached.code === otp && Date.now() <= cached.expiresAt) || (isDemo && (otp === "3223" || otp === "123456"));

    // Verify against Supabase Auth OTP verification if not matched in cache
    if (!isMatch) {
      try {
        const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
        const serviceKey = process.env.SUPABASE_SERVICE_KEY;
        if (baseUrl && serviceKey) {
          const verifyRes = await fetch(`${baseUrl}/auth/v1/verify`, {
            method: "POST",
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "email",
              token: otp,
              email: rawEmail,
            }),
          });
          if (verifyRes.ok) {
            isMatch = true;
          }
        }
      } catch (_) {}
    }

    if (!isMatch) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_OTP", message: "Invalid or expired verification code" },
      });
      return;
    }

    emailOtpCache.delete(rawEmail);

    const customer = await fetchCustomerByPhone(phone);

    await db
      .update(usersTable)
      .set({ email: rawEmail })
      .where(eq(usersTable.id, req.authUser!.userId));

    if (customer?.id) {
      const currentAddr = (typeof customer.address === "object" && customer.address !== null)
        ? (customer.address as Record<string, unknown>)
        : {};
      await updateCustomerById(customer.id, {
        email: rawEmail,
        address: {
          ...currentAddr,
          email_verified: true,
          emailVerified: true,
        },
      });
    }

    res.json({
      success: true,
      message: "Email address verified successfully",
      data: {
        email: rawEmail,
        emailVerified: true,
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to verify email OTP");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to verify email code" },
    });
  }
});

router.get("/wallet/summary", requireAuth, async (req, res) => {
  try {
    const customer = await fetchCustomerByPhone(req.authUser!.phone);
    res.json({
      success: true,
      data: {
        ...mapWalletSummary(customer),
        currency: "INR",
        available: Boolean(customer),
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to load wallet summary");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to load wallet summary" },
    });
  }
});

// -------------------------------------------------------------
// REFERRAL & 50/50 PROMOTION PROGRAM ENDPOINTS
// -------------------------------------------------------------

router.get(["/referral-info", "/portal/referral-info"], requireAuth, async (req, res) => {
  try {
    const userId = req.authUser!.userId;
    const phone = req.authUser!.phone || "";
    
    // Deterministic referral code: "FAB" + 6 chars of user UUID
    const referralCode = `FAB${userId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
    const candidates = phoneCandidates(phone);

    // Query referrals where user is the referrer
    const referralsQuery = await pool.query(
      `SELECT id, referee_phone, referee_customer_id, booking_reference, referrer_reward, referee_reward, status, created_at 
       FROM portal_referrals 
       WHERE referrer_user_id = $1 OR referrer_phone = ANY($2::text[])
       ORDER BY created_at DESC LIMIT 50`,
      [userId, candidates]
    ).catch(() => ({ rows: [] }));

    const rows = referralsQuery.rows || [];
    const totalInvited = rows.length;
    const successfulConversions = rows.filter((r: any) => r.status === "credited" || r.status === "completed").length;
    const totalEarned = rows.reduce((sum: number, r: any) => sum + Number(r.referrer_reward || 50), 0);

    const recentReferrals = rows.map((r: any) => {
      const p = String(r.referee_phone || "");
      const maskedPhone = p.length >= 10 
        ? `${p.slice(0, 3)}****${p.slice(-3)}`
        : "Valued Friend";
      return {
        id: r.id,
        refereeMasked: maskedPhone,
        reward: Number(r.referrer_reward || 50),
        status: r.status,
        date: r.created_at,
        bookingRef: r.booking_reference,
      };
    });

    const referralLink = `https://app.myfabclean.com?ref=${referralCode}`;
    const shareText = `✨ Get ₹50 credited to your Fab Clean wallet for luxury dry cleaning & laundry! Use my referral code *${referralCode}* when booking your doorstep pickup: ${referralLink}`;

    res.json({
      success: true,
      data: {
        referralCode,
        referralLink,
        stats: {
          totalInvited,
          successfulConversions,
          totalEarned,
        },
        rewardConfig: {
          referrerReward: 50,
          refereeReward: 25,
          promoRefereeReward: 50,
          campaignName: "50/50 Refer & Earn Special",
          promoTitle: "Give ₹50, Get ₹50",
          promoSubtitle: "Earn ₹50 wallet cash when your friend places their first doorstep pickup!",
        },
        recentReferrals,
        shareText,
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to fetch referral info");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch referral information" },
    });
  }
});

router.post(["/apply-referral", "/portal/apply-referral"], async (req, res) => {
  try {
    const rawCode = String(req.body.code || "").trim();
    if (!rawCode) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Please enter a referral or promo code" },
      });
      return;
    }

    const code = rawCode.toUpperCase();
    
    // Check if auth user is provided
    let authUserPhone = "";
    let authUserId = "";
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace(/^Bearer\s+/i, "").trim();
        const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as any;
        if (decoded?.phone) authUserPhone = normalizePhone(decoded.phone);
        if (decoded?.userId || decoded?.id) authUserId = String(decoded.userId || decoded.id);
      } catch (_) {}
    }

    const userPhone = normalizePhone(req.body.phone || authUserPhone || "");

    // Self-referral check
    if (authUserId) {
      const myCode = `FAB${authUserId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
      const myAltCode = authUserId.replace(/-/g, "").slice(0, 8).toUpperCase();
      if (code === myCode || code === myAltCode) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_CODE", message: "You cannot use your own referral code." },
        });
        return;
      }
    }

    // Check if this phone already used a referral or has completed orders
    if (userPhone) {
      const candidates = phoneCandidates(userPhone);
      const existingRef = await pool.query(
        "SELECT id FROM portal_referrals WHERE referee_phone = ANY($1::text[]) LIMIT 1",
        [candidates]
      ).catch(() => ({ rows: [] }));
      if (existingRef.rows.length > 0) {
        res.status(400).json({
          success: false,
          error: { code: "ALREADY_USED", message: "A referral code has already been applied to your account." },
        });
        return;
      }

      const existingOrders = await fetchOrdersByPhone(userPhone).catch(() => []);
      if (existingOrders && existingOrders.length > 0) {
        res.status(400).json({
          success: false,
          error: { code: "NOT_ELIGIBLE", message: "Referral bonuses are reserved for first-time customers." },
        });
        return;
      }
    }

    // Check system promotional codes
    const isPromo = ["FAB50", "WELCOME50", "DIWALI50", "5050", "FAB25"].includes(code);
    let referrerName = "Fab Clean Community";
    const refereeReward = code === "FAB25" ? 25 : 50;

    if (!isPromo) {
      // Find matching user by referral code prefix or phone
      const cleanPrefix = code.replace(/^FAB/i, "").toLowerCase();
      const userMatch = await pool.query(
        `SELECT id, name, phone FROM website_users 
         WHERE REPLACE(id::text, '-', '') ILIKE $1 
            OR phone = $2 
         LIMIT 1`,
        [`${cleanPrefix}%`, code]
      ).catch(() => ({ rows: [] }));

      if (userMatch.rows.length === 0) {
        const mappMatch = await pool.query(
          `SELECT id, name, phone, referral_code FROM mapp_users 
           WHERE referral_code ILIKE $1 
              OR REPLACE(id::text, '-', '') ILIKE $2 
              OR phone = $3 
           LIMIT 1`,
          [code, `${cleanPrefix}%`, code]
        ).catch(() => ({ rows: [] }));

        if (mappMatch.rows.length === 0) {
          res.status(400).json({
            success: false,
            error: { code: "INVALID_CODE", message: "Invalid referral code. Please check and try again." },
          });
          return;
        } else {
          referrerName = mappMatch.rows[0].name || "Your Friend";
        }
      } else {
        referrerName = userMatch.rows[0].name || "Your Friend";
      }
    }

    res.json({
      success: true,
      data: {
        code,
        valid: true,
        referrerName,
        rewardAmount: refereeReward,
        message: `🎉 Referral code applied! ₹${refereeReward} will be credited to your wallet upon booking.`,
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to apply referral code");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to validate referral code" },
    });
  }
});

router.get("/pickups", requireAuth, async (req, res) => {
  try {
    const candidates = phoneCandidates(req.authUser!.phone);
    if (candidates.length === 0) {
      res.json({ success: true, data: [], meta: { total: 0 } });
      return;
    }
    const since = typeof req.query?.since === "string" ? req.query.since : undefined;
    const sinceDate = since ? new Date(since) : null;

    const pickups = await db.query.pickupsTable.findMany({
      where: inArray(pickupsTable.customerPhone, candidates),
      orderBy: [desc(pickupsTable.createdAt)],
      limit: 100,
    });

    const filtered = sinceDate && !Number.isNaN(sinceDate.getTime())
      ? pickups.filter((row) => row.createdAt && row.createdAt > sinceDate)
      : pickups;

    res.json({
      success: true,
      data: filtered.map((row) => ({
        id: row.id,
        bookingReference: row.bookingReference,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        status: row.status,
        preferredDate: row.preferredDate,
        timeSlot: row.timeSlot,
        branch: row.branch,
        services: row.services,
        address: row.address,
        createdAt: row.createdAt?.toISOString?.() || null,
        updatedAt: row.updatedAt?.toISOString?.() || null,
      })),
      meta: {
        total: filtered.length,
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to load portal pickups");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to load pickups" },
    });
  }
});


/**
 * POST /api/users/avatar
 * Upload customer profile picture to Supabase "avatars" bucket
 */
router.post("/users/avatar", requireAuth, async (req, res) => {
  try {
    const { base64Data, mimeType = "image/jpeg" } = req.body;
    if (!base64Data) {
      return res.status(400).json({ success: false, error: { message: "base64Data is required" } });
    }

    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");
    const ext = mimeType.split("/")[1] || "jpeg";
    const filename = `avatar_${req.authUser!.userId}_${Date.now()}.${ext}`;

    const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    // Upload directly to Supabase Storage avatars bucket
    const uploadRes = await fetch(`${baseUrl}/storage/v1/object/avatars/${filename}`, {
      method: "POST",
      headers: {
        apikey: serviceKey!,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": mimeType,
      },
      body: buffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      req.log.error({ errText }, "Supabase avatar upload failed");
      return res.status(500).json({ success: false, error: { message: "Storage upload failed" } });
    }

    const publicUrl = `${baseUrl}/storage/v1/object/public/avatars/${filename}`;

    // Update customer profile with the new avatar_url
    const customer = await fetchCustomerByPhone(req.authUser!.phone);
    if (customer?.id) {
      const currentAddr = (typeof customer.address === "object" && customer.address !== null)
        ? (customer.address as Record<string, unknown>)
        : {};
      await updateCustomerById(customer.id, {
        address: { ...currentAddr, avatar_url: publicUrl, avatarUrl: publicUrl },
      });
    }

    res.json({ success: true, data: { avatarUrl: publicUrl } });
  } catch (err: any) {
    req.log.error(err, "Failed to upload avatar");
    res.status(500).json({ success: false, error: { message: err.message || "Failed to upload avatar" } });
  }
});

/**
 * POST /api/orders/:id/stains
 * Allows staff or system to upload inspection/stain photos for an order
 */
router.post("/orders/:id/stains", async (req, res) => {
  try {
    const orderId = req.params.id;
    const { base64Data, label = "Fabric Stain / Inspection", note = "", mimeType = "image/jpeg" } = req.body;
    if (!base64Data) {
      return res.status(400).json({ success: false, error: { message: "base64Data is required" } });
    }

    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");
    const ext = mimeType.split("/")[1] || "jpeg";
    const filename = `stain_${orderId}_${Date.now()}.${ext}`;

    const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    const uploadRes = await fetch(`${baseUrl}/storage/v1/object/order-stains/${filename}`, {
      method: "POST",
      headers: {
        apikey: serviceKey!,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": mimeType,
      },
      body: buffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      req.log?.error?.({ errText }, "Supabase stain photo upload failed");
      return res.status(500).json({ success: false, error: { message: "Storage upload failed" } });
    }

    const publicUrl = `${baseUrl}/storage/v1/object/public/order-stains/${filename}`;
    const newPhoto = {
      id: `photo_${Date.now()}`,
      url: publicUrl,
      label,
      note,
      uploadedAt: new Date().toISOString(),
    };

    // Append to order notes or stain_photos in Supabase
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    const filter = isUuid ? `id=eq.${encodeURIComponent(orderId)}` : `order_number=eq.${encodeURIComponent(orderId)}`;
    const orders = await supabaseRequest<any[]>(`/rest/v1/orders?${filter}&limit=1`, "GET");
    const order = orders[0];

    if (order) {
      const existingStains = Array.isArray(order.stain_photos) ? order.stain_photos : [];
      const updatedStains = [...existingStains, newPhoto];
      await supabaseRequest(`/rest/v1/orders?${filter}`, "PATCH", {
        stain_photos: updatedStains,
        updated_at: new Date().toISOString(),
      });
    }

    res.json({ success: true, data: newPhoto });
  } catch (err: any) {
    req.log?.error?.(err, "Failed to upload stain photo");
    res.status(500).json({ success: false, error: { message: err.message || "Upload failed" } });
  }
});

export default router;
