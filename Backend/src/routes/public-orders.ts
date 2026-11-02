import { Router, type IRouter } from "express";
import { fetchOrderByIdentifier } from "../lib/supabase-admin.js";

const router: IRouter = Router();

function buildStages(status: string) {
  const lifecycle = [
    { key: "pending", label: "Order Received" },
    { key: "processing", label: "In Cleaning Process" },
    { key: "ready_for_pickup", label: "Ready for Pickup" },
    { key: "out_for_delivery", label: "Out for Delivery" },
    { key: "delivered", label: "Delivered" },
  ];

  const orderIndexMap = new Map<string, number>([
    ["pending", 0],
    ["processing", 1],
    ["completed", 2],
    ["ready_for_pickup", 2],
    ["ready_for_delivery", 2],
    ["out_for_delivery", 3],
    ["delivered", 4],
  ]);

  const current = orderIndexMap.get(status) ?? 0;
  return lifecycle.map((item, index) => ({
    stage: item.key,
    label: item.label,
    completed: index <= current,
  }));
}

const maskName = (name?: string | null) => {
  if (!name) return undefined;
  return String(name).trim();
};

// Public tracking endpoint matching ERP structure for public-order-tracking component
router.get("/public/track/:orderNumber", async (req, res) => {
  try {
    const { orderNumber } = req.params;
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    if (!orderNumber) {
      res.status(400).json({ success: false, error: "Order number is required" });
      return;
    }

    const order = await fetchOrderByIdentifier(orderNumber);
    if (!order) {
      res.status(404).json({ success: false, error: "Order not found" });
      return;
    }

    const items = Array.isArray(order.items)
      ? order.items.map((item: any) => ({
          serviceName: item.serviceName || item.service_name || item.name || item.productName || "Service",
          quantity: item.quantity ?? 1,
          price: item.price ?? item.unitPrice ?? item.unit_price ?? 0,
        }))
      : [];

    const trackingData = {
      id: order.id,
      orderNumber: order.order_number,
      customerName: maskName(order.customer_name),
      status: order.status,
      paymentStatus: order.payment_status || "pending",
      totalAmount: Number(order.total_amount ?? 0),
      items,
      fulfillmentType: order.fulfillment_type || "pickup",
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      pickupDate: order.pickup_date,
      invoiceUrl: order.invoice_url || null,
      lastWhatsappStatus: (order as any).last_whatsapp_status || null,
      lastWhatsappSentAt: (order as any).last_whatsapp_sent_at || null,
    };

    res.json({ success: true, data: trackingData });
  } catch (err) {
    req.log.error(err, "Failed to track order via public tracking API");
    res.status(500).json({ success: false, error: "Failed to fetch order details" });
  }
});

// Existing route for website portal track order
router.get("/orders/track/by-id/:identifier", async (req, res) => {
  try {
    const identifier = req.params.identifier;
    if (!identifier) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Order ID is required" },
      });
      return;
    }

    const order = await fetchOrderByIdentifier(identifier);
    if (!order) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Order not found" },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: order.id,
        reference: order.order_number,
        orderId: order.id,
        customerName: order.customer_name,
        status: order.status,
        paymentStatus: order.payment_status,
        totalAmount: Number(order.total_amount ?? 0),
        branch: "fabclean",
        services: Array.isArray(order.items)
          ? order.items.map((item: any) => item.serviceName || item.name || "Service")
          : [],
        scheduledDate: order.pickup_date,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        invoiceUrl: order.invoice_url,
        stages: buildStages(order.status),
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to track order by identifier");
    const message = err instanceof Error ? err.message : "Failed to fetch order status";
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch order status",
        details: process.env["NODE_ENV"] === "production" ? undefined : message,
      },
    });
  }
});

export default router;
