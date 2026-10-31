import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { pickupsTable, usersTable } from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import {
  fetchCustomerByPhone,
  fetchOrdersByPhone,
  fetchOwnedOrderById,
  mapWalletSummary,
  updateCustomerById,
} from "../lib/supabase-admin.js";

const router: IRouter = Router();

// requireAuth is applied to individual routes instead of globally to avoid hijacking non-matching routes

function mapOrder(order: Awaited<ReturnType<typeof fetchOrdersByPhone>>[number]) {
  return {
    id: order.id,
    reference: order.order_number,
    status: order.status,
    services: Array.isArray(order.items)
      ? order.items.map((item: any) => item.serviceName || item.name || "Service")
      : [],
    branch: order.fulfillment_type || "pickup",
    scheduledDate: order.pickup_date || undefined,
    createdAt: order.created_at,
    totalAmount: Number(order.total_amount ?? 0),
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

router.get("/users/profile", requireAuth, async (req, res) => {
  try {
    const [user, customer] = await Promise.all([
      db.query.usersTable.findFirst({
        where: eq(usersTable.id, req.authUser!.userId),
      }),
      fetchCustomerByPhone(req.authUser!.phone),
    ]);

    res.json({
      success: true,
      data: {
        id: user?.id || req.authUser!.userId,
        phone: req.authUser!.phone,
        name: user?.name || customer?.name || undefined,
        email: user?.email || customer?.email || undefined,
        avatarUrl: user?.avatarUrl || undefined,
        addresses: user?.addresses || [],
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
    const avatarUrl =
      typeof req.body?.avatarUrl === "string"
        ? req.body.avatarUrl.trim()
        : typeof req.body?.avatar_url === "string"
          ? req.body.avatar_url.trim()
          : undefined;
    const addresses = Array.isArray(req.body?.addresses)
      ? req.body.addresses.filter((a: any) => typeof a === "string" && a.trim() !== "")
      : undefined;

    if (avatarUrl !== undefined && avatarUrl.length > 180_000) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Photo is too large. Try a smaller image." },
      });
      return;
    }

    const [updatedUser, customer] = await Promise.all([
      db
        .update(usersTable)
        .set({
          ...(name !== undefined ? { name: name || null } : {}),
          ...(email !== undefined ? { email: email || null } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
          ...(addresses !== undefined ? { addresses } : {}),
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, req.authUser!.userId))
        .returning()
        .then((rows) => rows[0]),
      fetchCustomerByPhone(req.authUser!.phone),
    ]);

    if (customer?.id) {
      await updateCustomerById(customer.id, {
        ...(name !== undefined ? { name: name || null } : {}),
        ...(email !== undefined ? { email: email || null } : {}),
      });
    }

    res.json({
      success: true,
      data: {
        id: updatedUser?.id || req.authUser!.userId,
        phone: req.authUser!.phone,
        name: updatedUser?.name || customer?.name || undefined,
        email: updatedUser?.email || customer?.email || undefined,
        avatarUrl: updatedUser?.avatarUrl || undefined,
        addresses: updatedUser?.addresses || [],
        createdAt: updatedUser?.createdAt?.toISOString?.() || customer?.created_at || undefined,
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

export default router;
