import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { pickupsTable, storesTable, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { fetchAppStores } from "../lib/supabase-admin.js";

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
    const {
      name,
      phone,
      address,
      addressLat,
      addressLng,
      services,
      specialInstructions,
      preferredDate,
      timeSlot,
      branch,
    } = req.body;

    const resolvedServices = Array.isArray(services) && services.length > 0
      ? services
      : ["Pickup — details at door"];

    if (!name || !phone || !address || !preferredDate || !timeSlot || !branch) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Missing required fields" },
      });
      return;
    }

    const store = await db.query.storesTable.findFirst({
      where: and(eq(storesTable.slug, String(branch)), eq(storesTable.isActive, true)),
    });

    const appStores = store ? [] : await fetchAppStores();
    const sharedStore = store ?? appStores.find((item) => item.slug === String(branch) && item.is_active !== false);

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
        preferredSlot: String(timeSlot),
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
      timeSlot,
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

    res.status(201).json({
      success: true,
      data: {
        bookingReference,
        erpBookingId: erpBooking?.bookingId ?? null,
        erpBookingInternalId: erpBooking?.id ?? null,
        erpStatus: erpBooking?.status ?? null,
        message: `Your pickup has been scheduled! Reference: ${bookingReference}. We'll contact you at ${phone} to confirm.`,
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
