import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, pool } from "@workspace/db";
import { pickupsTable, storesTable, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  fetchAppStores,
  fetchCustomerByPhone,
  fetchOrdersByPhone,
  insertWalletTransaction,
} from "../lib/supabase-admin.js";
import { JWT_SECRET } from "../lib/auth.js";

const router: IRouter = Router();

function generateBookingRef(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `FC-PU-${year}-${rand}`;
}

const ERP_PUBLIC_BOOKING_URL = process.env.ERP_PUBLIC_BOOKING_URL || "";

async function createErpBooking(payload: Record<string, unknown>) {
  const url = ERP_PUBLIC_BOOKING_URL.trim();
  if (!url) return null;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const failurePayload = await response.text().catch(() => "");
    throw new Error(`ERP booking intake failed (${response.status}): ${failurePayload || response.statusText}`);
  }

  const body = (await response.json().catch(() => ({}))) as {
    data?: { booking?: Record<string, unknown> } & Record<string, unknown>;
    booking?: Record<string, unknown>;
  };
  const booking = (body?.data?.booking || body?.booking || body?.data || null) as Record<string, unknown> | null;
  if (!booking) return null;

  return {
    id: (booking.id as string | null | undefined) ?? null,
    bookingId:
      (booking.bookingId as string | null | undefined) ??
      (booking.booking_id as string | null | undefined) ??
      (booking.requestNumber as string | null | undefined) ??
      (booking.request_number as string | null | undefined) ??
      null,
    status: (booking.status as string | undefined) ?? "new",
  };
}

router.post("/pickups", async (req, res) => {
  try {
    let authUserPhone = "";
    let authUserName = "";
    let authUserId: string | null = null;
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace(/^Bearer\s+/i, "").trim();
        const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as any;
        if (decoded?.phone) authUserPhone = String(decoded.phone);
        if (decoded?.name) authUserName = String(decoded.name);
        if (decoded?.userId || decoded?.id) authUserId = String(decoded.userId || decoded.id);
      } catch (_) {}
    }

    const name = String(req.body.name || req.body.customerName || req.body.customer_name || authUserName || "Valued Customer").trim();
    let phone = String(req.body.phone || req.body.customerPhone || req.body.customer_phone || authUserPhone || "").trim();
    let address = String(req.body.address || "").trim();

    // Fallback: If phone missing but authUserId is known, lookup user phone
    if (!phone && authUserId) {
      try {
        const dbUser = await db.query.usersTable.findFirst({
          where: eq(usersTable.id, authUserId),
        });
        if (dbUser?.phone) {
          phone = dbUser.phone;
        }
      } catch (_) {}
    }

    // Fallback: If address missing, retrieve primary address from customer record
    if (!address && phone) {
      try {
        const cust = await fetchCustomerByPhone(phone);
        const cAddr = (typeof cust?.address === "object" && cust?.address !== null)
          ? (cust.address as Record<string, unknown>)
          : {};
        if (Array.isArray(cAddr.addresses) && cAddr.addresses.length > 0) {
          address = String(cAddr.addresses[0]).trim();
        } else if (typeof cAddr.street === "string" && cAddr.street.trim()) {
          address = [cAddr.street, cAddr.city, cAddr.pincode].filter(Boolean).join(", ");
        }
      } catch (_) {}
    }
    const addressLat = req.body.addressLat;
    const addressLng = req.body.addressLng;
    const services = req.body.services;
    const specialInstructions = req.body.specialInstructions || req.body.notes;
    const preferredDate = String(req.body.preferredDate || req.body.date || req.body.scheduledDate || "Tomorrow").trim();
    const rawTimeSlot = String(req.body.timeSlot || req.body.time_slot || req.body.slot || "Morning").trim();
    
    // Normalize timeSlot to database enum: 'morning' | 'afternoon' | 'evening'
    const s = rawTimeSlot.toLowerCase();
    const normalizedTimeSlot: "morning" | "afternoon" | "evening" = 
      s.includes("morn") || s.includes("09:") || s.includes("9")
        ? "morning"
        : s.includes("after") || s.includes("01:") || s.includes("1:") || s.includes("12:")
        ? "afternoon"
        : s.includes("even") || s.includes("04:") || s.includes("4:") || s.includes("night")
        ? "evening"
        : "morning";

    const rawBranch = String(req.body.branch || req.body.store || "suleeshwaranpatti").toLowerCase();
    const branch = rawBranch.includes("pollachi") ? "pollachi" : "suleeshwaranpatti";

    const resolvedServices = Array.isArray(services) && services.length > 0
      ? services
      : ["Pickup — details at door"];

    if (!phone || !address) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Missing required fields: phone and address are required" },
      });
      return;
    }

    const store = await db.query.storesTable.findFirst({
      where: and(eq(storesTable.slug, branch), eq(storesTable.isActive, true)),
    });

    const appStores = store ? [] : await fetchAppStores();
    const sharedStore = store ?? appStores.find((item) => (item.slug === branch || item.id === branch) && item.is_active !== false) ?? appStores[0];

    if (!sharedStore) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Select a valid store" },
      });
      return;
    }

    let erpBooking: { id: string | null; bookingId: string | null; status: string } | null = null;
    try {
      erpBooking = await createErpBooking({
        customerName: String(name),
        customerPhone: String(phone),
        source: "website",
        channel: "web",
        storeCode: String(("code" in sharedStore ? (sharedStore as { code?: string }).code : "") || "").toUpperCase() || null,
        preferredDate: String(preferredDate),
        preferredSlot: String(rawTimeSlot),
        notes: specialInstructions ?? null,
        pickupAddress: {
          line1: String(address),
          latitude: addressLat ?? null,
          longitude: addressLng ?? null,
        },
        items: resolvedServices.map((serviceName: string) => ({
              serviceName: String(serviceName),
              quantity: 1,
            })),
      });
    } catch (erpError) {
      req.log.error(erpError, "ERP booking creation failed, proceeding with local pickup record");
    }

    const bookingReference = erpBooking?.bookingId || generateBookingRef();

    await db.insert(pickupsTable).values({
      bookingReference,
      customerName: name,
      customerPhone: phone,
      address,
      addressLat: addressLat ?? null,
      addressLng: addressLng ?? null,
      services: resolvedServices,
      specialInstructions: specialInstructions ?? null,
      preferredDate,
      timeSlot: normalizedTimeSlot,
      branch: sharedStore.slug,
    });

    try {
      const existingUser = await db.query.usersTable.findFirst({
        where: eq(usersTable.phone, String(phone)),
      });
      if (!existingUser) {
        await db.insert(usersTable).values({
          phone: String(phone),
          name: String(name),
          addresses: [String(address)],
        });
      } else {
        const updatedAddresses = new Set(existingUser.addresses || []);
        updatedAddresses.add(String(address));
        await db.update(usersTable)
          .set({ name: String(name), addresses: Array.from(updatedAddresses) })
          .where(eq(usersTable.phone, String(phone)));
      }
    } catch (e) {
      req.log.error(e, "Failed to sync user profile during pickup booking");
    }

    // -----------------------------------------------------------------
    // REFERRAL & 50/50 BONUS PROCESSING
    // -----------------------------------------------------------------
    let referralBonusResult: { applied: boolean; refereeReward: number; message: string } | null = null;
    const rawRefCode = String(req.body.referralCode || req.body.ref || "").trim();

    if (rawRefCode) {
      try {
        const refCode = rawRefCode.toUpperCase();
        const cleanCustomerPhone = String(phone).replace(/\D/g, "").slice(-10);

        // Check if referee already got referral reward or has prior orders
        const priorReferral = await pool.query(
          "SELECT id FROM portal_referrals WHERE referee_phone = $1 LIMIT 1",
          [cleanCustomerPhone]
        ).catch(() => ({ rows: [] }));
        const priorOrders = await fetchOrdersByPhone(cleanCustomerPhone).catch(() => []);

        if (priorReferral.rows.length === 0 && (!priorOrders || priorOrders.length <= 1)) {
          // Identify referrer
          let referrerUserId: string | null = null;
          let referrerPhone: string | null = null;
          let referrerCustomerId: string | null = null;
          const refereeReward = refCode === "FAB25" ? 25 : 50; // default ₹50 for 50/50 promo
          const referrerReward = 50;

          const isPromo = ["FAB50", "WELCOME50", "DIWALI50", "5050", "FAB25"].includes(refCode);

          if (!isPromo) {
            const cleanPrefix = refCode.replace(/^FAB/i, "").toLowerCase();
            const userMatch = await pool.query(
              `SELECT id, name, phone, customer_id FROM website_users 
               WHERE REPLACE(id::text, '-', '') ILIKE $1 
                  OR phone = $2 
               LIMIT 1`,
              [`${cleanPrefix}%`, refCode]
            ).catch(() => ({ rows: [] }));

            if (userMatch.rows.length > 0) {
              referrerUserId = userMatch.rows[0].id;
              referrerPhone = userMatch.rows[0].phone;
              referrerCustomerId = userMatch.rows[0].customer_id;
            } else {
              const mappMatch = await pool.query(
                `SELECT id, name, phone, erp_customer_id FROM mapp_users 
                 WHERE referral_code ILIKE $1 
                    OR REPLACE(id::text, '-', '') ILIKE $2 
                    OR phone = $3 
                 LIMIT 1`,
                [refCode, `${cleanPrefix}%`, refCode]
              ).catch(() => ({ rows: [] }));
              if (mappMatch.rows.length > 0) {
                referrerUserId = mappMatch.rows[0].id;
                referrerPhone = mappMatch.rows[0].phone;
                referrerCustomerId = mappMatch.rows[0].erp_customer_id;
              }
            }
          }

          // Cannot refer oneself
          const isSelf = referrerPhone && String(referrerPhone).replace(/\D/g, "").slice(-10) === cleanCustomerPhone;
          if (!isSelf && (isPromo || referrerPhone)) {
            // Ensure referee customer record in ERP/customers table
            let refereeCustomer = await fetchCustomerByPhone(cleanCustomerPhone);
            let refereeCustId = refereeCustomer?.id;
            if (!refereeCustId) {
              const newCust = await pool.query(
                "INSERT INTO customers (name, phone) VALUES ($1, $2) RETURNING id",
                [String(name || "Customer"), cleanCustomerPhone]
              ).catch(() => ({ rows: [] }));
              refereeCustId = newCust.rows[0]?.id;
            }

            // Ensure referrer customer record in ERP/customers table (if known)
            let finalReferrerCustId = referrerCustomerId;
            if (!finalReferrerCustId && referrerPhone) {
              const rCust = await fetchCustomerByPhone(referrerPhone);
              if (rCust?.id) {
                finalReferrerCustId = rCust.id;
              } else {
                const newRefCust = await pool.query(
                  "INSERT INTO customers (name, phone) VALUES ($1, $2) RETURNING id",
                  ["Customer", referrerPhone]
                ).catch(() => ({ rows: [] }));
                finalReferrerCustId = newRefCust.rows[0]?.id;
              }
            }

            // 1. Credit Referee Wallet
            if (refereeCustId) {
              await insertWalletTransaction({
                customer_id: refereeCustId,
                type: "credit",
                transaction_type: "CREDIT",
                amount: refereeReward,
                payment_method: "OTHER",
                reference_type: "MANUAL",
                reference_id: bookingReference,
                note: `[REFERRAL] 1st booking welcome cash: ₹${refereeReward} (Code: ${refCode})`,
              }).catch((e: any) => req.log.error(e, "Referee wallet credit error"));
            }

            // 2. Credit Referrer Wallet
            if (finalReferrerCustId) {
              await insertWalletTransaction({
                customer_id: finalReferrerCustId,
                type: "credit",
                transaction_type: "CREDIT",
                amount: referrerReward,
                payment_method: "OTHER",
                reference_type: "MANUAL",
                reference_id: bookingReference,
                note: `[REFERRAL] Reward: ₹${referrerReward} (${name} booked pickup #${bookingReference})`,
              }).catch((e: any) => req.log.error(e, "Referrer wallet credit error"));
            }

            // 3. Record in portal_referrals
            await pool.query(
              `INSERT INTO portal_referrals (
                referrer_user_id, referrer_phone, referrer_customer_id,
                referee_phone, referee_customer_id, referral_code,
                booking_reference, referrer_reward, referee_reward, status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'credited')`,
              [
                referrerUserId,
                referrerPhone || "PROMO",
                finalReferrerCustId,
                cleanCustomerPhone,
                refereeCustId,
                refCode,
                bookingReference,
                referrerReward,
                refereeReward,
              ]
            ).catch((e: any) => req.log.error(e, "Error recording portal_referrals"));

            referralBonusResult = {
              applied: true,
              refereeReward,
              message: `🎉 ₹${refereeReward} referral welcome cash credited to your Fab Clean wallet!`,
            };
            req.log.info({ refCode, refereePhone: cleanCustomerPhone, referrerPhone }, "Referral rewards successfully credited!");
          }
        }
      } catch (refErr) {
        req.log.error(refErr, "Error processing referral credit during pickup booking");
      }
    }

    res.status(201).json({
      success: true,
      data: {
        bookingReference,
        erpBookingId: erpBooking?.bookingId ?? null,
        erpBookingInternalId: erpBooking?.id ?? null,
        erpStatus: erpBooking?.status ?? null,
        referralBonus: referralBonusResult,
        message: referralBonusResult 
          ? `Your pickup has been scheduled! Reference: ${bookingReference}. ${referralBonusResult.message}`
          : `Your pickup has been scheduled! Reference: ${bookingReference}. We'll contact you at ${phone} to confirm.`,
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to schedule pickup");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to schedule pickup" },
    });
  }
});

router.get("/customer-lookup", async (req, res) => {
  try {
    const phone = req.query.phone;
    if (typeof phone !== "string" || phone.length !== 10) {
      res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid phone number" } });
      return;
    }

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.phone, phone),
    });

    if (user) {
      res.json({
        success: true,
        data: { name: user.name, addresses: user.addresses || [] },
      });
      return;
    }

    const { fetchCustomerByPhone } = await import("../lib/supabase-admin.js");
    const erpCustomer = await fetchCustomerByPhone(phone);

    if (erpCustomer) {
      res.json({
        success: true,
        data: { name: erpCustomer.name, addresses: [] },
      });
      return;
    }

    res.json({ success: true, data: null });
  } catch (err) {
    req.log.error(err, "Customer lookup failed");
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Lookup failed" } });
  }
});

router.get("/orders/track", async (req, res) => {
  try {
    const { phone, ref } = req.query as { phone?: string; ref?: string };

    if (!phone || !ref) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Phone and ref are required" },
      });
      return;
    }

    const pickup = await db.query.pickupsTable.findFirst({
      where: (t: { customerPhone: unknown; bookingReference: unknown }, helpers: { and: Function; eq: Function }) =>
        helpers.and(helpers.eq(t.customerPhone, phone), helpers.eq(t.bookingReference, ref)),
    });

    if (!pickup) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Order not found" },
      });
      return;
    }

    const stages = [
      { stage: "received", label: "Order Received", completed: true },
      { stage: "sorting", label: "Sorting & Assessment", completed: ["sorting", "cleaning", "quality_check", "ready", "out_for_delivery", "delivered"].includes(pickup.status) },
      { stage: "cleaning", label: "Cleaning in Progress", completed: ["cleaning", "quality_check", "ready", "out_for_delivery", "delivered"].includes(pickup.status) },
      { stage: "quality_check", label: "Quality Check", completed: ["quality_check", "ready", "out_for_delivery", "delivered"].includes(pickup.status) },
      { stage: "ready", label: "Ready for Pickup/Delivery", completed: ["ready", "out_for_delivery", "delivered"].includes(pickup.status) },
      { stage: "out_for_delivery", label: "Out for Delivery", completed: ["out_for_delivery", "delivered"].includes(pickup.status) },
      { stage: "delivered", label: "Delivered", completed: pickup.status === "delivered" },
    ];

    res.json({
      success: true,
      data: {
        reference: pickup.bookingReference,
        status: pickup.status,
        stages,
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to track order");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to track order" },
    });
  }
});

export default router;
