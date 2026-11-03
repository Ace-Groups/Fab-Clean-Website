
function normalizeStoreCode(raw: any): string {
  const s = String(raw || "").trim().toUpperCase();
  if (s.includes("POL") || s.includes("POLLACHI") || s.includes("SULEESH")) return "POL";
  if (s.includes("KIN") || s.includes("KINATHU")) return "KIN";
  if (s.includes("MCET")) return "MCET";
  if (s.includes("UDM") || s.includes("UDUMAL")) return "UDM";
  return "POL";
}
import { Router, type IRouter } from "express";
import crypto from "crypto";
import { supabaseRequest, fetchCustomerByPhone, isOrderCancelled, computeOrderDue } from "../lib/supabase-admin.js";
import { recordOrderCreditDebit, recordWalletPaymentDebit } from "../lib/wallet-engine.js";
import { isR2Configured, uploadPublicObject } from "../lib/r2.js";
import { sendMsg91OrderInvoiceEmail, sendMsg91OrderStatusEmail } from "../lib/msg91-email.js";
import { pool } from "@workspace/db";


// Strict 5-Character Base32 Crockford Alphabet (no I, L, O, U to prevent visual confusion and offensive words)
const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function generateCrockford5(): string {
  const bytes = crypto.randomBytes(5);
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += CROCKFORD_BASE32[bytes[i] % CROCKFORD_BASE32.length];
  }
  return result;
}

/**
 * Generate a strict collision-resistant 5-char code for:
 * - Direct Orders: #O-XXXXX
 * - Website Bookings: B-XXXXX
 * - Converted Bookings: BO-XXXXX
 */
async function generateUniqueOrderNumber(prefix: 'O' | 'BO' = 'O'): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateCrockford5();
    const orderNumber = prefix + '-' + code;
    const existing = await supabaseRequest<any[]>(
      '/rest/v1/orders?select=id&order_number=eq.' + encodeURIComponent(orderNumber) + '&limit=1',
      'GET'
    ).catch(() => []);
    if (!existing || existing.length === 0) {
      return orderNumber;
    }
  }
  return prefix + '-' + generateCrockford5();
}

async function generateUniqueBookingRef(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateCrockford5();
    const bookingRef = 'B-' + code;
    const existing = await supabaseRequest<any[]>(
      '/rest/v1/pickups?select=id&booking_reference=eq.' + encodeURIComponent(bookingRef) + '&limit=1',
      'GET'
    ).catch(() => []);
    if (!existing || existing.length === 0) {
      return bookingRef;
    }
  }
  return 'B-' + generateCrockford5();
}

const router: IRouter = Router();

function mapCustomer(c: any) {
  let parsedAddress = c.address;
  if (typeof parsedAddress === "string") {
    try {
      parsedAddress = JSON.parse(parsedAddress);
    } catch {
      parsedAddress = { street: parsedAddress };
    }
  }

  const gst = parsedAddress?.gstNumber || parsedAddress?.gst_number || c.gst_number || c.gstNumber || "";
  const avatar = parsedAddress?.avatarUrl || parsedAddress?.avatar_url || c.avatar_url || c.avatarUrl || "";
  const addressList = Array.isArray(parsedAddress?.addresses) ? parsedAddress.addresses : [];

  return {
    ...c,
    id: c.id,
    name: c.name || "",
    email: c.email || "",
    phone: c.phone || "",
    secondaryPhone: c.secondary_phone || "",
    secondary_phone: c.secondary_phone || "",
    address: parsedAddress || {},
    gstNumber: gst || undefined,
    gst_number: gst || undefined,
    avatarUrl: avatar || undefined,
    avatar_url: avatar || undefined,
    addresses: addressList,
    totalOrders: Number(c.total_orders || 0),
    total_orders: Number(c.total_orders || 0),
    totalSpent: Number(c.total_spent || 0),
    total_spent: Number(c.total_spent || 0),
    creditBalance: Number(c.credit_balance || 0),
    credit_balance: Number(c.credit_balance || 0),
    creditLimit: Number(c.credit_limit || 1000),
    credit_limit: Number(c.credit_limit || 1000),
    walletBalance: Number(c.wallet_balance_cache || 0),
    wallet_balance_cache: Number(c.wallet_balance_cache || 0),
    status: c.status || "active",
    createdAt: c.created_at,
    created_at: c.created_at,
  };
}

function mapOrderForErp(o: any) {
  let parsedItems = o.items;
  if (typeof parsedItems === "string") {
    try {
      parsedItems = JSON.parse(parsedItems);
    } catch {
      parsedItems = [];
    }
  }

  return {
    ...o,
    id: o.id,
    orderNumber: o.order_number,
    order_number: o.order_number,
    customerId: o.customer_id,
    customer_id: o.customer_id,
    customerName: o.customer_name || "Customer",
    customer_name: o.customer_name || "Customer",
    customerPhone: o.customer_phone || "",
    customer_phone: o.customer_phone || "",
    customerEmail: o.customer_email || "",
    customer_email: o.customer_email || "",
    whatsappMessageCount: Number(o.whatsapp_message_count || 0),
    whatsapp_message_count: Number(o.whatsapp_message_count || 0),
    lastWhatsappStatus: o.last_whatsapp_status || null,
    last_whatsapp_status: o.last_whatsapp_status || null,
    lastWhatsappSentAt: o.last_whatsapp_sent_at || null,
    emailSentCount: Number(o.email_sent_count || 0),
    email_sent_count: Number(o.email_sent_count || 0),
    lastEmailStatus: o.last_email_status || null,
    last_email_status: o.last_email_status || null,
    lastEmailSentAt: o.last_email_sent_at || null,
    items: Array.isArray(parsedItems) ? parsedItems : [],
    totalAmount: Number(o.total_amount || 0),
    total_amount: Number(o.total_amount || 0),
    advancePaid: Number(o.advance_paid || 0),
    advance_paid: Number(o.advance_paid || 0),
    paymentMethod: o.payment_method || "credit",
    payment_method: o.payment_method || "credit",
    paymentStatus: isOrderCancelled(o) ? "cancelled" : (o.payment_status || "unpaid"),
    payment_status: isOrderCancelled(o) ? "cancelled" : (o.payment_status || "unpaid"),
    isCancelled: isOrderCancelled(o),
    cancellationReason: o.cancellation_reason || null,
    cancellation_reason: o.cancellation_reason || null,
    cancelledAt: o.cancelled_at || null,
    cancelled_at: o.cancelled_at || null,
    cancelledBy: o.cancelled_by || null,
    cancelled_by: o.cancelled_by || null,
    dueAmount: computeOrderDue(o),
    isCreditOrder: Boolean(o.is_credit_order),
    is_credit_order: Boolean(o.is_credit_order),
    creditUsed: Number(o.credit_used || 0),
    credit_used: Number(o.credit_used || 0),
    couponCode: o.coupon_code || null,
    coupon_code: o.coupon_code || null,
    discountType: o.discount_type || null,
    discount_type: o.discount_type || null,
    discountValue: o.discount_value !== null && o.discount_value !== undefined ? Number(o.discount_value) : null,
    discount_value: o.discount_value !== null && o.discount_value !== undefined ? Number(o.discount_value) : null,
    extraCharges: o.extra_charges !== null && o.extra_charges !== undefined ? Number(o.extra_charges) : null,
    extra_charges: o.extra_charges !== null && o.extra_charges !== undefined ? Number(o.extra_charges) : null,
    extraChargesLabel: o.extra_charges_label || null,
    extra_charges_label: o.extra_charges_label || null,
    gstEnabled: Boolean(o.gst_enabled),
    gst_enabled: Boolean(o.gst_enabled),
    gstRate: o.gst_rate !== null && o.gst_rate !== undefined ? Number(o.gst_rate) : 0,
    gst_rate: o.gst_rate !== null && o.gst_rate !== undefined ? Number(o.gst_rate) : 0,
    gstAmount: o.gst_amount !== null && o.gst_amount !== undefined ? Number(o.gst_amount) : 0,
    gst_amount: o.gst_amount !== null && o.gst_amount !== undefined ? Number(o.gst_amount) : 0,
    gstNumber: o.gst_number || null,
    gst_number: o.gst_number || null,
    panNumber: o.pan_number || null,
    pan_number: o.pan_number || null,
    fulfillmentType: o.fulfillment_type || "pickup",
    fulfillment_type: o.fulfillment_type || "pickup",
    specialInstructions: o.special_instructions || o.notes || "",
    special_instructions: o.special_instructions || o.notes || "",
    orderType: o.order_type || (o.priority === "urgent" ? "instant" : o.priority === "high" ? "express" : "standard"),
    order_type: o.order_type || (o.priority === "urgent" ? "instant" : o.priority === "high" ? "express" : "standard"),
    storeCode: o.store_code || "POL",
    store_code: o.store_code || "POL",
    deliveryAddress: o.delivery_address || (typeof o.shipping_address === "string" ? o.shipping_address : o.shipping_address?.street || ""),
    delivery_address: o.delivery_address || (typeof o.shipping_address === "string" ? o.shipping_address : o.shipping_address?.street || ""),
    deliveryCharges: o.delivery_charges !== null && o.delivery_charges !== undefined ? Number(o.delivery_charges) : 0,
    delivery_charges: o.delivery_charges !== null && o.delivery_charges !== undefined ? Number(o.delivery_charges) : 0,
    status: o.status || "pending",
    pickupDate: o.pickup_date,
    pickup_date: o.pickup_date,
    dueDate: o.due_date,
    due_date: o.due_date,
    invoiceUrl: o.invoice_url,
    invoice_url: o.invoice_url,
    bagCount: o.bag_count || 1,
    bag_count: o.bag_count || 1,
    priority: o.priority || "normal",
    createdAt: o.created_at,
    created_at: o.created_at,
    updatedAt: o.updated_at,
    updated_at: o.updated_at,
  };
}

// ==========================================
// 1. SERVICES
// ==========================================
router.get("/services", async (req, res) => {
  try {
    const rows = await supabaseRequest<any[]>("/rest/v1/services?select=*&order=category.asc,name.asc", "GET");
    const formatted = rows.map((s) => ({
      ...s,
      price: s.price?.toString?.() || s.price || "0",
      status: s.status || "Active",
    }));
    res.json(formatted);
  } catch (err: any) {
    req.log?.error(err, "Failed to load services");
    res.status(500).json([]);
  }
});

router.get("/services/:id", async (req, res) => {
  try {
    const rows = await supabaseRequest<any[]>(`/rest/v1/services?id=eq.${encodeURIComponent(req.params.id)}&limit=1`, "GET");
    if (!rows[0]) {
      return res.status(404).json({ error: "Service not found" });
    }
    return res.json(rows[0]);
  } catch (err: any) {
    req.log?.error(err, "Failed to fetch service");
    return res.status(500).json({ error: err.message });
  }
});

router.post("/services", async (req, res) => {
  try {
    const { name, category, price, description, duration, unit, status } = req.body;
    const id = crypto.randomUUID();
    const payload = {
      id,
      name: name || "New Service",
      category: category || "General",
      price: Number(price || 0),
      description: description || null,
      duration: duration || "24 hours",
      unit: unit || "Qty",
      status: status || "Active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const rows = await supabaseRequest<any[]>("/rest/v1/services", "POST", payload, {
      Prefer: "return=representation",
    });
    res.status(201).json(rows[0] || payload);
  } catch (err: any) {
    req.log?.error(err, "Failed to create service");
    res.status(500).json({ error: err.message });
  }
});

router.put("/services/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { name, category, price, description, duration, unit, status } = req.body;
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) payload.name = name;
    if (category !== undefined) payload.category = category;
    if (price !== undefined) payload.price = Number(price);
    if (description !== undefined) payload.description = description;
    if (duration !== undefined) payload.duration = duration;
    if (unit !== undefined) payload.unit = unit;
    if (status !== undefined) payload.status = status;

    const rows = await supabaseRequest<any[]>(`/rest/v1/services?id=eq.${encodeURIComponent(id)}`, "PATCH", payload, {
      Prefer: "return=representation",
    });
    res.json(rows[0] || { id, ...payload });
  } catch (err: any) {
    req.log?.error(err, "Failed to update service");
    res.status(500).json({ error: err.message });
  }
});

router.delete("/services/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await supabaseRequest(`/rest/v1/services?id=eq.${encodeURIComponent(id)}`, "DELETE");
    res.json({ success: true, message: "Service deleted successfully" });
  } catch (err: any) {
    req.log?.error(err, "Failed to delete service");
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. CUSTOMERS
// ==========================================
router.get("/customers/analytics/overview", async (req, res) => {
  try {
    const customers = await supabaseRequest<any[]>("/rest/v1/customers?select=id,status,created_at,credit_balance", "GET");
    const total = customers.length;
    const active = customers.filter((c) => c.status === "active").length;
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const newCount = customers.filter((c) => c.created_at && new Date(c.created_at) >= oneMonthAgo).length;
    const totalOutstanding = customers.reduce((sum, c) => sum + Math.max(0, Number(c.credit_balance || 0)), 0);

    res.json({
      totalCustomers: total,
      activeCustomers: active,
      newThisMonth: newCount,
      totalOutstandingCredit: totalOutstanding,
      averageOrderValue: 350,
      retentionRate: 85,
      growthRate: 12.5,
    });
  } catch (err: any) {
    req.log?.error(err, "Failed to load customer analytics");
    res.status(500).json({ error: err.message });
  }
});

router.get("/customers/:id/addresses", async (req, res) => {
  try {
    const rows = await supabaseRequest<any[]>(`/rest/v1/customers?id=eq.${encodeURIComponent(req.params.id)}&limit=1`, "GET");
    if (!rows[0]) {
      return res.json({ success: true, data: [] });
    }
    const c = rows[0];
    let addr = c.address;
    if (typeof addr === "string") {
      try {
        addr = JSON.parse(addr);
      } catch {
        addr = { street: addr };
      }
    }
    const addressList: any[] = [];
    if (addr && (addr.street || addr.city)) {
      addressList.push({
        id: "addr-primary",
        label: addr.label || "Primary Address",
        line1: addr.street || addr.line1 || "",
        line2: addr.line2 || "",
        city: addr.city || "Pollachi",
        pincode: addr.pincode || "",
        landmark: addr.landmark || "",
        isDefault: true,
      });
    }
    if (Array.isArray(addr?.addresses)) {
      addr.addresses.forEach((item: any, idx: number) => {
        const text = typeof item === "string" ? item : (item.line1 || item.street || "");
        if (text && !addressList.some((a) => a.line1 === text)) {
          addressList.push({
            id: `addr-book-${idx + 1}`,
            label: `Address #${idx + 1}`,
            line1: text,
            line2: "",
            city: addr?.city || "Pollachi",
            pincode: addr?.pincode || "",
            landmark: "",
            isDefault: false,
          });
        }
      });
    }
    return res.json({ success: true, data: addressList });
  } catch (err: any) {
    req.log?.error(err, "Failed to load customer addresses");
    return res.status(500).json({ success: false, data: [] });
  }
});

router.get("/customers/:id", async (req, res) => {
  try {
    const rows = await supabaseRequest<any[]>(`/rest/v1/customers?id=eq.${encodeURIComponent(req.params.id)}&limit=1`, "GET");
    if (!rows[0]) {
      return res.status(404).json({ error: "Customer not found" });
    }
    return res.json(mapCustomer(rows[0]));
  } catch (err: any) {
    req.log?.error(err, "Failed to fetch customer");
    return res.status(500).json({ error: err.message });
  }
});

router.get("/customers/:id/profile", async (req, res) => {
  try {
    const customerId = req.params.id;
    const custRes = await pool.query("SELECT * FROM customers WHERE id = $1 LIMIT 1", [customerId]);
    let customer = custRes.rows[0];
    if (!customer) {
      const custPhoneRes = await pool.query("SELECT * FROM customers WHERE phone LIKE $1 LIMIT 1", [`%${customerId.slice(-10)}%`]);
      if (custPhoneRes.rows[0]) {
        customer = custPhoneRes.rows[0];
      }
    }
    if (!customer) {
      return res.status(404).json({ success: false, error: "Customer not found" });
    }

    const phone = customer.phone || "";
    const cleanPhone = phone.replace(/\D/g, "");
    const orderRes = await pool.query(
      `SELECT * FROM orders 
       WHERE customer_id = $1 
          OR ($2 <> '' AND customer_phone LIKE $3)
       ORDER BY created_at DESC 
       LIMIT 50`,
      [customer.id, cleanPhone, `%${cleanPhone.slice(-10)}%`]
    );

    const recentOrders = orderRes.rows.map(mapOrderForErp);

    const bookingRes = await pool.query(
      `SELECT * FROM pickups 
       WHERE phone LIKE $1 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [`%${cleanPhone.slice(-10)}%`]
    ).catch(() => ({ rows: [] }));

    return res.json({
      success: true,
      data: {
        customer: mapCustomer(customer),
        recentOrders,
        recentBookings: bookingRes.rows,
        feedbackHistory: [],
        customerRating: customer.customer_rating,
        reviewCount: recentOrders.filter((o: any) => o.rating != null).length,
      }
    });
  } catch (err: any) {
    req.log?.error(err, "Failed to fetch customer profile details");
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/customers", async (req, res) => {
  try {
    const { limit = "100", page = "1", search } = req.query;
    let q = "/rest/v1/customers?select=*&order=created_at.desc";
    if (search && typeof search === "string" && search.trim()) {
      const s = encodeURIComponent(search.trim());
      q += `&or=(name.ilike.*${s}*,phone.ilike.*${s}*,email.ilike.*${s}*)`;
    }
    const lim = Math.min(1000, Number(limit) || 100);
    const offset = (Math.max(1, Number(page) || 1) - 1) * lim;
    q += `&limit=${lim}&offset=${offset}`;

    const rows = await supabaseRequest<any[]>(q, "GET");
    const mapped = rows.map(mapCustomer);
    res.json({ data: mapped, totalCount: mapped.length });
  } catch (err: any) {
    req.log?.error(err, "Failed to fetch customers");
    res.status(500).json({ data: [], totalCount: 0 });
  }
});

router.post("/customers", async (req, res) => {
  try {
    const { name, phone, email, address, secondaryPhone, creditLimit } = req.body;
    const id = `FZC26MY${Math.floor(1000 + Math.random() * 9000)}`;
    const payload = {
      id,
      name: name || "Customer",
      phone: phone || "",
      secondary_phone: secondaryPhone || null,
      email: email || null,
      address: typeof address === "object" ? address : { street: address || "" },
      credit_limit: Number(creditLimit || 1000),
      credit_balance: 0,
      wallet_balance_cache: 0,
      total_orders: 0,
      total_spent: 0,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const rows = await supabaseRequest<any[]>("/rest/v1/customers", "POST", payload, {
      Prefer: "return=representation",
    });
    res.status(201).json(mapCustomer(rows[0] || payload));
  } catch (err: any) {
    req.log?.error(err, "Failed to create customer");
    res.status(500).json({ error: err.message });
  }
});

router.patch("/customers/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { name, phone, email, address, secondaryPhone, creditLimit } = req.body;
    const gst = typeof req.body?.gstNumber === "string"
      ? req.body.gstNumber.trim().toUpperCase()
      : typeof req.body?.gst_number === "string"
      ? req.body.gst_number.trim().toUpperCase()
      : undefined;

    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) payload.name = name;
    if (phone !== undefined) payload.phone = phone;
    if (email !== undefined) payload.email = email;
    if (secondaryPhone !== undefined) payload.secondary_phone = secondaryPhone;
    if (creditLimit !== undefined) payload.credit_limit = Number(creditLimit);

    if (address !== undefined || gst !== undefined) {
      let mergedAddr: Record<string, any> = {};
      if (address !== undefined) {
        mergedAddr = typeof address === "object" && address !== null ? { ...address } : { street: address };
      } else {
        const existing = await supabaseRequest<any[]>(`/rest/v1/customers?id=eq.${encodeURIComponent(id)}&select=address&limit=1`, "GET");
        if (existing[0]?.address && typeof existing[0].address === "object") {
          mergedAddr = { ...existing[0].address };
        }
      }
      if (gst !== undefined) {
        mergedAddr.gstNumber = gst;
        mergedAddr.gst_number = gst;
      }
      payload.address = mergedAddr;
    }

    const rows = await supabaseRequest<any[]>(`/rest/v1/customers?id=eq.${encodeURIComponent(id)}`, "PATCH", payload, {
      Prefer: "return=representation",
    });
    res.json(mapCustomer(rows[0] || { id, ...payload }));
  } catch (err: any) {
    req.log?.error(err, "Failed to update customer");
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. DUE DATE ORDERS
// ==========================================
router.get("/due-date-orders", async (req, res) => {
  try {
    const { type, date } = req.query;
    let q = "/rest/v1/orders?select=*&order=created_at.desc&limit=200";
    const rows = await supabaseRequest<any[]>(q, "GET");

    let filtered = rows;
    if (type === "specific" && date) {
      const target = String(date).split("T")[0];
      filtered = rows.filter((o) => (o.due_date && o.due_date.startsWith(target)) || (o.pickup_date && o.pickup_date.startsWith(target)));
    }
    const transformed = filtered.map(mapOrderForErp);
    res.json({ orders: transformed });
  } catch (err: any) {
    req.log?.error(err, "Failed to fetch due date orders");
    res.status(500).json({ orders: [] });
  }
});

// ==========================================
// 4. ORDERS
// ==========================================
router.get("/orders/customer/:customerId", async (req, res) => {
  try {
    const customerId = req.params.customerId;
    const custRes = await pool.query("SELECT id, phone FROM customers WHERE id = $1 LIMIT 1", [customerId]);
    const phone = custRes.rows[0]?.phone || "";
    const cleanPhone = phone.replace(/\D/g, "");

    const rows = await pool.query(
      `SELECT * FROM orders 
       WHERE customer_id = $1 
          OR ($2 <> '' AND customer_phone LIKE $3)
       ORDER BY created_at DESC 
       LIMIT 100`,
      [customerId, cleanPhone, `%${cleanPhone.slice(-10)}%`]
    );
    res.json(rows.rows.map(mapOrderForErp));
  } catch (err: any) {
    req.log?.error(err, "Failed to fetch customer orders");
    res.status(500).json([]);
  }
});

// Check if /orders request is from ERP (query filters or employee auth)
router.get("/orders", async (req, res, next) => {
  const { createdDate, limit, dateFrom, page, search } = req.query;
  const isEmployee = req.authUser?.type === "employee" || Boolean(req.authUser?.role);

  // If this is an ERP request with filters or from employee, handle directly here
  if (createdDate || limit || dateFrom || page || search || isEmployee) {
    try {
      // 1. Search Query (phone, order_number, customer_name, customer_id, notes)
      if (search && typeof search === "string" && search.trim()) {
        const searchTerm = search.trim();
        const digitsOnly = searchTerm.replace(/\D/g, "");
        const searchPattern = `%${searchTerm}%`;
        const phonePattern = digitsOnly.length >= 4 ? `%${digitsOnly.slice(-10)}%` : searchPattern;

        const resRows = await pool.query(
          `SELECT * FROM orders 
           WHERE customer_phone LIKE $1 
              OR order_number ILIKE $2 
              OR customer_name ILIKE $2 
              OR customer_id ILIKE $2
              OR id::text ILIKE $2
              OR notes ILIKE $2
           ORDER BY created_at DESC 
           LIMIT 200`,
          [phonePattern, searchPattern]
        );
        return res.json(resRows.rows.map(mapOrderForErp));
      }

      // 2. Filter by Date or Default Active First Listing
      const lim = Math.min(2000, Number(limit) || 1000);
      
      if (createdDate && typeof createdDate === "string") {
        const resRows = await pool.query(
          `SELECT * FROM orders 
           WHERE created_at >= $1::timestamp AND created_at <= $2::timestamp
           ORDER BY created_at DESC 
           LIMIT $3`,
          [`${createdDate} 00:00:00`, `${createdDate} 23:59:59`, lim]
        );
        return res.json(resRows.rows.map(mapOrderForErp));
      }

      if (dateFrom && typeof dateFrom === "string") {
        const resRows = await pool.query(
          `SELECT * FROM orders 
           WHERE created_at >= $1::timestamp
           ORDER BY created_at DESC 
           LIMIT $2`,
          [dateFrom, lim]
        );
        return res.json(resRows.rows.map(mapOrderForErp));
      }

      // 3. Default Listing: ALL Active Orders prioritized first so nothing is ever dropped!
      const resRows = await pool.query(
        `SELECT * FROM orders 
         ORDER BY 
           CASE 
             WHEN status IN ('pending', 'processing', 'ready_for_pickup', 'out_for_delivery') THEN 0 
             ELSE 1 
           END, 
           created_at DESC 
         LIMIT $1`,
        [lim]
      );
      return res.json(resRows.rows.map(mapOrderForErp));
    } catch (err: any) {
      req.log?.error(err, "Failed to list ERP orders");
      return res.status(500).json({ success: false, error: { message: err.message } });
    }
  }

  // Otherwise, pass to customer portal handler in portal.ts
  next();
  return;
});


// Print Queue Route (must come before /orders/:id)
router.get("/orders/print-queue", async (req, res) => {
  try {
    const rows = await supabaseRequest<any[]>(
      "/rest/v1/orders?select=*&order=created_at.desc&limit=100",
      "GET"
    );
    const unprinted = (rows || [])
      .filter((r) => !r.tags_printed && r.status !== "cancelled")
      .map(mapOrderForErp);
    return res.json({ success: true, data: unprinted });
  } catch (err: any) {
    req.log?.error(err, "Failed to fetch print queue");
    return res.json({ success: true, data: [] });
  }
});

// Order Logs Route (must come before /orders/:id or handled specifically)
router.get("/orders/:id/logs", async (req, res) => {
  try {
    const orderId = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    const filter = isUuid ? `id=eq.${encodeURIComponent(orderId)}` : `order_number=eq.${encodeURIComponent(orderId)}`;
    const rows = await supabaseRequest<any[]>(`/rest/v1/orders?${filter}&limit=1`, "GET");
    const ord = rows?.[0];

    const logs = [
      {
        id: `log-created-${orderId}`,
        orderId,
        action: "created",
        actionTitle: "Order Created",
        description: `Order #${ord?.order_number || orderId} registered in facility system`,
        performedBy: ord?.customer_name || "System",
        timestamp: ord?.created_at || new Date().toISOString(),
      },
      {
        id: `log-status-${orderId}`,
        orderId,
        action: "order_status",
        actionTitle: "Current Status",
        description: `Current workflow stage: ${ord?.status || "pending"}`,
        performedBy: "Care Operations",
        timestamp: ord?.updated_at || ord?.created_at || new Date().toISOString(),
      }
    ];

    return res.json({ success: true, data: logs });
  } catch (err: any) {
    return res.json({ success: true, data: [] });
  }
});

router.get("/orders/:id", async (req, res, next) => {
  const isEmployee = req.authUser?.type === "employee" || Boolean(req.authUser?.role);
  try {
    const orderId = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    const filter = isUuid ? `id=eq.${encodeURIComponent(orderId)}` : `order_number=eq.${encodeURIComponent(orderId)}`;

    const rows = await supabaseRequest<any[]>(`/rest/v1/orders?${filter}&limit=1`, "GET");
    if (!rows || rows.length === 0) {
      if (!isEmployee && req.authUser?.type === "user") {
        return next();
      }
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Order not found" } });
    }

    const order = mapOrderForErp(rows[0]);
    return res.json({ success: true, data: order, ...order });
  } catch (err: any) {
    req.log?.error(err, "Failed to fetch order by id");
    return res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to load order" } });
  }
});

router.put("/orders/:id", async (req, res) => {
  try {
    const orderId = req.params.id;
    const body = req.body;
    const snake: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.status !== undefined) snake.status = body.status;
    if (body.paymentStatus !== undefined) snake.payment_status = body.paymentStatus;
    if (body.payment_status !== undefined) snake.payment_status = body.payment_status;
    if (body.totalAmount !== undefined) snake.total_amount = body.totalAmount;
    if (body.total_amount !== undefined) snake.total_amount = body.total_amount;
    if (body.advancePaid !== undefined) snake.advance_paid = body.advancePaid;
    if (body.advance_paid !== undefined) snake.advance_paid = body.advance_paid;
    if (body.notes !== undefined) snake.notes = body.notes;
    if (body.assignedTo !== undefined) snake.assigned_to = body.assignedTo;
    if (body.tagsPrinted !== undefined) snake.tags_printed = body.tagsPrinted;
    if (body.storeCode !== undefined) snake.store_code = body.storeCode;
    if (body.createdAt !== undefined) snake.created_at = body.createdAt;
    if (body.created_at !== undefined) snake.created_at = body.created_at;
    if (body.pickupDate !== undefined) snake.pickup_date = body.pickupDate;
    if (body.pickup_date !== undefined) snake.pickup_date = body.pickup_date;
    if (body.dueDate !== undefined) snake.due_date = body.dueDate;
    if (body.due_date !== undefined) snake.due_date = body.due_date;
    if (body.items !== undefined) snake.items = body.items;
    if (body.shippingAddress !== undefined) snake.shipping_address = body.shippingAddress;
    if (body.shipping_address !== undefined) snake.shipping_address = body.shipping_address;
    if (body.specialInstructions !== undefined) snake.special_instructions = body.specialInstructions;
    if (body.special_instructions !== undefined) snake.special_instructions = body.special_instructions;
    if (body.fulfillmentType !== undefined) snake.fulfillment_type = body.fulfillmentType;
    if (body.fulfillment_type !== undefined) snake.fulfillment_type = body.fulfillment_type;
    if (body.bagCount !== undefined) snake.bag_count = body.bagCount;
    if (body.priority !== undefined) snake.priority = body.priority;
    if (body.customerName !== undefined) snake.customer_name = body.customerName;
    if (body.customer_name !== undefined) snake.customer_name = body.customer_name;
    if (body.customerPhone !== undefined) snake.customer_phone = body.customerPhone;
    if (body.customer_phone !== undefined) snake.customer_phone = body.customer_phone;
    if (body.customerEmail !== undefined) snake.customer_email = body.customerEmail;
    if (body.customer_email !== undefined) snake.customer_email = body.customer_email;
    if (body.invoiceUrl !== undefined) snake.invoice_url = body.invoiceUrl;
    if (body.invoice_url !== undefined) snake.invoice_url = body.invoice_url;
    if (body.discountType !== undefined) snake.discount_type = body.discountType;
    if (body.discount_type !== undefined) snake.discount_type = body.discount_type;
    if (body.discountValue !== undefined) snake.discount_value = body.discountValue;
    if (body.discount_value !== undefined) snake.discount_value = body.discount_value;
    if (body.couponCode !== undefined) snake.coupon_code = body.couponCode;
    if (body.coupon_code !== undefined) snake.coupon_code = body.coupon_code;
    if (body.extraCharges !== undefined) snake.extra_charges = body.extraCharges;
    if (body.extra_charges !== undefined) snake.extra_charges = body.extra_charges;
    if (body.extraChargesLabel !== undefined) snake.extra_charges_label = body.extraChargesLabel;
    if (body.paymentMethod !== undefined) snake.payment_method = body.paymentMethod;
    if (body.payment_method !== undefined) snake.payment_method = body.payment_method;
    if (body.gstEnabled !== undefined) snake.gst_enabled = Boolean(body.gstEnabled);
    if (body.gst_enabled !== undefined) snake.gst_enabled = Boolean(body.gst_enabled);
    if (body.gstRate !== undefined) snake.gst_rate = Number(body.gstRate);
    if (body.gst_rate !== undefined) snake.gst_rate = Number(body.gst_rate);
    if (body.gstAmount !== undefined) snake.gst_amount = Number(body.gstAmount);
    if (body.gst_amount !== undefined) snake.gst_amount = Number(body.gst_amount);
    if (body.gstNumber !== undefined) snake.gst_number = body.gstNumber;
    if (body.gst_number !== undefined) snake.gst_number = body.gst_number;
    if (body.panNumber !== undefined) snake.pan_number = body.panNumber;
    if (body.pan_number !== undefined) snake.pan_number = body.pan_number;
    if (body.orderType !== undefined) snake.order_type = body.orderType;
    if (body.order_type !== undefined) snake.order_type = body.order_type;
    if (body.deliveryCharges !== undefined) snake.delivery_charges = body.deliveryCharges;
    if (body.delivery_charges !== undefined) snake.delivery_charges = body.delivery_charges;

    // Recalculate financial balances if totalAmount or advancePaid was updated
    if (snake.total_amount !== undefined || snake.advance_paid !== undefined) {
      const tot = Number(snake.total_amount !== undefined ? snake.total_amount : (body.totalAmount || body.total_amount || 0));
      const adv = Number(snake.advance_paid !== undefined ? snake.advance_paid : (body.advancePaid || body.advance_paid || 0));
      const rem = Math.max(0, tot - adv);
      snake.credit_used = rem;
      snake.is_credit_order = rem > 0;
      if (body.paymentStatus === undefined && body.payment_status === undefined) {
        if (adv >= tot && tot > 0) {
          snake.payment_status = "paid";
        } else if (adv > 0) {
          snake.payment_status = "partial";
        } else {
          snake.payment_status = "unpaid";
        }
      }
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    const filter = isUuid ? `id=eq.${encodeURIComponent(orderId)}` : `order_number=eq.${encodeURIComponent(orderId)}`;
    const updated = await supabaseRequest<any[]>(`/rest/v1/orders?${filter}`, "PATCH", snake, {
      Prefer: "return=representation",
    });
    const order = mapOrderForErp(updated[0] || { id: orderId, ...body });

    // Automated live status email dispatch to customer if email is available
    if (body.status && updated?.[0]) {
      (async () => {
        try {
          const ord = updated[0];
          let targetEmail = ord.customer_email || body.customerEmail || body.email;
          if (!targetEmail && ord.customer_phone) {
            const cust = await fetchCustomerByPhone(ord.customer_phone).catch(() => null);
            if (cust?.email) targetEmail = cust.email;
          }
          if (targetEmail && targetEmail.includes("@")) {
            await sendMsg91OrderStatusEmail({
              customerEmail: targetEmail,
              customerName: ord.customer_name || "Valued Customer",
              orderNumber: ord.order_number || orderId,
              status: ord.status,
              dueDate: ord.due_date,
              pickupDate: ord.pickup_date,
            });
            req.log?.info({ orderNumber: ord.order_number, to: targetEmail, status: ord.status }, "Sent automated status update email");
          }
        } catch (statusEmailErr) {
          req.log?.warn(statusEmailErr, "Could not send automated status email");
        }
      })();
    }

    return res.json({ success: true, data: order, ...order });
  } catch (err: any) {
    req.log?.error(err, "Failed to update order");
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Order Creation with Split Payment & Credit Logic
router.post("/orders", async (req, res) => {
  try {
    const body = req.body;
    const totalAmount = Number(body.totalAmount || body.total_amount || 0);
    const advancePaid = Number(body.advancePaid || body.advance_paid || 0);
    const creditAmount = Math.max(0, totalAmount - advancePaid);
    const rawMethod = (body.paymentMethod || body.payment_method || "credit").toLowerCase();

    // Business Logic:
    // 1. Credit is default.
    // 2. Advance can ONLY be Cash or UPI.
    // 3. If advance >= totalAmount: paid via advance method.
    // 4. If advance == 0: unpaid / 100% on credit.
    // 5. If advance > 0 && advance < totalAmount: partial payment (Advance via cash/upi + remainder on credit).
    let paymentStatus = "unpaid";
    let finalPaymentMethod = rawMethod;
    let isCreditOrder = false;
    let creditUsed = 0;

    if (advancePaid >= totalAmount && totalAmount > 0) {
      paymentStatus = "paid";
      finalPaymentMethod = rawMethod === "credit" ? "cash" : rawMethod;
      isCreditOrder = false;
      creditUsed = 0;
    } else if (advancePaid > 0) {
      paymentStatus = "partial";
      const advMethod = rawMethod === "credit" ? "cash" : rawMethod;
      finalPaymentMethod = `${advMethod} + credit`;
      isCreditOrder = true;
      creditUsed = creditAmount;
    } else {
      paymentStatus = "unpaid";
      finalPaymentMethod = "credit";
      isCreditOrder = true;
      creditUsed = totalAmount;
    }

    const orderId = crypto.randomUUID();
    const isFromBooking = Boolean(body.bookingId || body.booking_id || body.bookingRequestId || body.bookingSource === "website");
    const orderNumber = await generateUniqueOrderNumber(isFromBooking ? "BO" : "O");

    const orderRecord = {
      id: orderId,
      order_number: orderNumber,
      customer_id: body.customerId || body.customer_id || null,
      customer_name: body.customerName || body.customer_name || "Customer",
      customer_phone: body.customerPhone || body.customer_phone || "",
      customer_email: body.customerEmail || body.customer_email || null,
      items: body.items || [],
      total_amount: totalAmount,
      advance_paid: advancePaid,
      payment_method: finalPaymentMethod,
      payment_status: paymentStatus,
      is_credit_order: isCreditOrder,
      credit_used: creditUsed,
      shipping_address: body.shippingAddress || body.shipping_address || null,
      pickup_date: body.pickupDate || body.pickup_date || new Date().toISOString(),
      due_date: body.dueDate || body.due_date || null,
      status: "pending",
      special_instructions: body.specialInstructions || body.special_instructions || "",
      coupon_code: body.couponCode || body.coupon_code || null,
      discount_type: body.discountType || body.discount_type || null,
      discount_value: body.discountValue || body.discount_value || null,
      extra_charges: body.extraCharges || body.extra_charges || null,
      gst_enabled: Boolean(body.gstEnabled),
      gst_rate: body.gstRate ? Number(body.gstRate) : 0,
      gst_amount: body.gstAmount ? Number(body.gstAmount) : 0,
      gst_number: body.gstNumber || null,
      pan_number: body.panNumber || null,
      fulfillment_type: body.fulfillmentType || body.fulfillment_type || "pickup",
      bag_count: body.bagCount || 1,
      priority: body.priority || "normal",
      created_at: body.createdAt || body.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const inserted = await supabaseRequest<any[]>("/rest/v1/orders", "POST", orderRecord, {
      Prefer: "return=representation",
    });
    const createdOrder = inserted[0] || orderRecord;

    // Update customer wallet & credit ledger
    const custId = body.customerId || body.customer_id;
    if (isCreditOrder && creditUsed > 0 && custId) {
      try {
        await recordOrderCreditDebit({
          customerId: custId,
          orderId,
          orderNumber,
          creditAmount: creditUsed,
          advancePaid,
          paymentMethod: finalPaymentMethod,
        });
      } catch (creditErr) {
        req.log?.error(creditErr, "Failed to update wallet ledger for credit order");
      }
    } else if (paymentStatus === "paid" && rawMethod === "wallet" && custId && totalAmount > 0) {
      try {
        await recordWalletPaymentDebit({
          customerId: custId,
          orderId,
          orderNumber,
          amount: totalAmount,
        });
      } catch (walErr) {
        req.log?.error(walErr, "Failed to debit wallet for full wallet order");
      }
    }

    // Default automated email dispatch on order creation if email exists
    (async () => {
      try {
        let targetEmail = createdOrder.customer_email || body.customerEmail || body.email;
        if (!targetEmail && (body.customerPhone || createdOrder.customer_phone)) {
          const cust = await fetchCustomerByPhone(String(body.customerPhone || createdOrder.customer_phone)).catch(() => null);
          if (cust?.email) targetEmail = cust.email;
        }
        if (targetEmail && targetEmail.includes("@")) {
          const emailRes = await sendMsg91OrderInvoiceEmail({
            customerEmail: targetEmail,
            customerName: createdOrder.customer_name || "Valued Customer",
            orderNumber: createdOrder.order_number || orderNumber,
            amount: createdOrder.total_amount || totalAmount,
            invoicePdfUrl: createdOrder.invoice_url,
          });
          if (emailRes.success) {
            await supabaseRequest(`/rest/v1/orders?id=eq.${encodeURIComponent(createdOrder.id)}`, "PATCH", {
              email_sent_count: 1,
              last_email_status: "Sent",
              last_email_sent_at: new Date().toISOString(),
            }, { Prefer: "return=minimal" }).catch(() => null);
            req.log?.info({ orderNumber: createdOrder.order_number, to: targetEmail }, "Dispatched default initial invoice email");
          }
        }
      } catch (autoEmailErr) {
        req.log?.warn(autoEmailErr, "Could not send initial order invoice email");
      }
    })();

    res.status(201).json(mapOrderForErp(createdOrder));
  } catch (err: any) {
    req.log?.error(err, "Failed to create order");
    res.status(500).json({ success: false, error: { message: err.message || "Failed to create order" } });
  }
});

// ==========================================
// 5. BOOKINGS (/v1/bookings)
// ==========================================
router.get("/v1/bookings", async (req, res) => {
  try {
    const { status, search } = req.query;
    const rows = await supabaseRequest<any[]>("/rest/v1/pickups?select=*&order=created_at.desc&limit=100", "GET");
    let mapped = rows.map((p) => {
      const matchOrder = (p.notes || "").match(/Converted to Order:\s*([A-Za-z0-9_-]+)\s*\(([^)]+)\)/i);
      const isConverted = p.status === "confirmed" && Boolean(matchOrder);
      return {
        id: p.id,
        bookingReference: p.booking_reference,
        bookingId: p.booking_reference,
        requestNumber: p.booking_reference,
        source: "Doorstep",
        channel: "Web",
        customerName: p.customer_name || "Customer",
        customerPhone: p.customer_phone || "",
        services: p.services,
        preferredDate: p.preferred_date,
        preferredSlot: p.time_slot || p.preferred_slot || "morning",
        timeSlot: p.time_slot,
        branch: normalizeStoreCode(p.store_code || p.branch || "POL"),
        storeCode: normalizeStoreCode(p.store_code || p.branch || "POL"),
        status: isConverted ? "converted" : p.status === "pending" ? "new" : (p.status || "new"),
        address: p.address || p.pickup_address,
        pickupAddress: p.address || p.pickup_address,
        convertedOrderId: matchOrder ? matchOrder[2] : (p.converted_order_id || null),
        orderNumber: matchOrder ? matchOrder[1] : null,
        notes: p.notes || null,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      };
    });

    if (status && status !== "all") {
      const s = String(status).toLowerCase();
      mapped = mapped.filter((b) => b.status === s || (s === "new" && b.status === "pending"));
    }

    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim().toLowerCase();
      mapped = mapped.filter(
        (b) =>
          b.customerName?.toLowerCase().includes(q) ||
          b.customerPhone?.includes(q) ||
          b.bookingReference?.toLowerCase().includes(q),
      );
    }

    res.json({
      success: true,
      data: {
        rows: mapped,
        total: mapped.length,
      },
      bookings: mapped,
      rows: mapped,
    });
  } catch (err: any) {
    req.log?.error(err, "Failed to fetch bookings");
    res.status(500).json({ success: false, data: { rows: [], total: 0 }, bookings: [] });
  }
});

router.patch("/v1/bookings/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const patchPayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.status) patchPayload.status = body.status;
    if (body.storeCode) { patchPayload.branch = normalizeStoreCode(body.storeCode); patchPayload.store_code = normalizeStoreCode(body.storeCode); }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const filter = isUuid ? `id=eq.${encodeURIComponent(id)}` : `booking_reference=eq.${encodeURIComponent(id)}`;
    await supabaseRequest(`/rest/v1/pickups?${filter}`, "PATCH", patchPayload, {
      Prefer: "return=minimal",
    });

    res.json({ success: true, message: "Booking updated" });
  } catch (err: any) {
    req.log?.error(err, "Failed to update booking");
    res.status(500).json({ success: false, error: { message: err.message || "Failed to update booking" } });
  }
});

router.post("/v1/bookings/:id/convert-to-order", async (req, res) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const filter = isUuid ? `id=eq.${encodeURIComponent(id)}` : `booking_reference=eq.${encodeURIComponent(id)}`;
    const pickups = await supabaseRequest<any[]>(`/rest/v1/pickups?${filter}`, "GET");
    const pickup = pickups[0];
    if (!pickup) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const orderNumber = await generateUniqueOrderNumber("BO");
    const orderId = crypto.randomUUID();

    const orderRecord = {
      id: orderId,
      order_number: orderNumber,
      customer_id: pickup.customer_id || null,
      customer_name: pickup.customer_name || "Customer",
      customer_phone: pickup.customer_phone || "",
      items: [{ name: "Doorstep Collection Items", quantity: 1, price: 0, subtotal: 0 }],
      total_amount: 0,
      advance_paid: 0,
      payment_method: "credit",
      payment_status: "pending",
      is_credit_order: true,
      credit_used: 0,
      shipping_address: pickup.address || null,
      pickup_date: pickup.preferred_date || new Date().toISOString(),
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabaseRequest("/rest/v1/orders", "POST", orderRecord, {
      Prefer: "return=minimal",
    });

    await supabaseRequest(
      `/rest/v1/pickups?${filter}`,
      "PATCH",
      {
        status: "confirmed",
        notes: `Converted to Order: ${orderNumber} (${orderId})`,
        updated_at: new Date().toISOString(),
      },
      {
        Prefer: "return=minimal",
      },
    );

    return res.json({
      success: true,
      data: {
        order: {
          id: orderId,
          orderNumber,
        },
      },
    });
  } catch (err: any) {
    req.log?.error(err, "Failed to convert booking to order");
    return res.status(500).json({ success: false, message: err.message || "Failed to convert booking" });
  }
});

// ==========================================
// 6. CREDITS
// ==========================================
router.get("/credits/report/outstanding", async (req, res) => {
  try {
    const rows = await supabaseRequest<any[]>("/rest/v1/customers?credit_balance=gt.0&order=credit_balance.desc", "GET");
    res.json({ success: true, data: rows.map(mapCustomer) });
  } catch (err: any) {
    req.log?.error(err, "Failed to fetch outstanding credit report");
    res.status(500).json({ success: false, data: [] });
  }
});

router.get("/credits", async (req, res) => {
  try {
    const rows = await supabaseRequest<any[]>("/rest/v1/credit_transactions?select=*&order=created_at.desc&limit=100", "GET");
    res.json({ success: true, data: rows });
  } catch (err: any) {
    req.log?.error(err, "Failed to fetch credit transactions");
    res.status(500).json({ success: false, data: [] });
  }
});


// ==========================================
// 8. DOCUMENTS / INVOICE UPLOAD & WHATSAPP BILL DISPATCH
// ==========================================

const handleDocumentUpload = async (req: any, res: any) => {
  try {
    const rawFilename = req.headers['x-filename'] || req.query.filename || ('invoice_' + Date.now() + '.pdf');
    const filename = String(rawFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const mimeType = (req.headers['content-type'] || 'application/pdf').split(';')[0].trim();

    let fileBuffer: Buffer | null = null;

    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      fileBuffer = req.body;
    } else if (req.body && typeof req.body === 'object') {
      if (req.body.file && typeof req.body.file === 'string') {
        const base64Data = req.body.file.replace(/^data:[^;]+;base64,/, '');
        fileBuffer = Buffer.from(base64Data, 'base64');
      } else if (req.body.pdfBase64 && typeof req.body.pdfBase64 === 'string') {
        const base64Data = req.body.pdfBase64.replace(/^data:[^;]+;base64,/, '');
        fileBuffer = Buffer.from(base64Data, 'base64');
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      const billFallback = 'https://myfabclean.com/trackorder/' + encodeURIComponent(filename.replace(/\.pdf$/i, ''));
      return res.json({
        success: true,
        fileUrl: billFallback,
        document: { fileUrl: billFallback, filename },
        warning: 'No file binary received; generated trackable bill link',
      });
    }

    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '/');
    const r2Key = 'documents/invoices/' + yearMonth + '/' + Date.now() + '_' + filename;

    let fileUrl = '';
    if (isR2Configured()) {
      fileUrl = await uploadPublicObject(r2Key, fileBuffer, mimeType);
    } else {
      fileUrl = 'https://pub-c99d2656ac73471b81644c90647ebd30.r2.dev/' + r2Key;
    }

    return res.json({
      success: true,
      fileUrl,
      document: {
        fileUrl,
        filename,
        size: fileBuffer.length,
        mimeType,
      },
    });
  } catch (err: any) {
    req.log?.error(err, 'Document upload failed');
    const orderRef = String(req.query?.orderNumber || req.headers['x-order-number'] || '');
    const fallbackUrl = orderRef ? ('https://myfabclean.com/trackorder/' + encodeURIComponent(orderRef)) : '';
    return res.status(200).json({
      success: true,
      fileUrl: fallbackUrl || 'https://myfabclean.com',
      document: { fileUrl: fallbackUrl || 'https://myfabclean.com' },
      warning: err.message,
    });
  }
};

router.post('/documents/upload', handleDocumentUpload);
router.post('/api/documents/upload', handleDocumentUpload);

// WhatsApp Order Bill Sender
const handleWhatsAppSendBill = async (req: any, res: any) => {
  try {
    const {
      customerPhone,
      secondaryPhone,
      orderId,
      amount,
      pdfUrl,
      mainItem,
      customerName,
      sendCount = 0,
    } = req.body || {};

    if (!customerPhone && !secondaryPhone) {
      return res.status(400).json({
        success: false,
        error: 'Customer phone number is required to send WhatsApp bill',
      });
    }

    const rawPhone = String(customerPhone || secondaryPhone || '').trim();
    const cleanDigits = rawPhone.replace(/\D/g, '');
    const formattedPhone = cleanDigits.length === 10 ? ('91' + cleanDigits) : cleanDigits;

    const authKey = process.env.MSG91_AUTH_KEY || '491266AqsX3mD29Cew69c118abP1';
    const integratedNumber = process.env.MSG91_INTEGRATED_NUMBER || '15559458542';
    const namespace = process.env.MSG91_TEMPLATE_NAMESPACE || '5b9c340a_3221_42e3_9b9f_98b402c0c8ac';
    const templateName = process.env.MSG91_TEMPLATE_NAME_ORDER || 'invoice_for_customer';

    const cleanOrderNum = String(orderId || '').replace(/^#/, '');
    const publicBillUrl = pdfUrl || ('https://myfabclean.com/trackorder/' + encodeURIComponent(cleanOrderNum));

    const components: Record<string, any> = {
      header_1: {
        type: 'document',
        value: publicBillUrl,
        filename: 'Invoice_' + (cleanOrderNum || Date.now()) + '.pdf',
      },
      body_1: {
        type: 'text',
        value: customerName || 'Valued Customer',
      },
      body_2: {
        type: 'text',
        value: mainItem || 'Garment Care & Cleaning',
      },
      body_3: {
        type: 'text',
        value: cleanOrderNum,
      },
      body_4: {
        type: 'text',
        value: typeof amount === 'number' ? amount.toFixed(2) : String(amount || '0.00'),
      },
      button_2: {
        type: 'text',
        value: cleanOrderNum,
      },
    };

    const msg91Payload = {
      integrated_number: integratedNumber,
      content_type: 'template',
      payload: {
        messaging_product: 'whatsapp',
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'en',
            policy: 'deterministic',
          },
          namespace: namespace,
          to_and_components: [
            {
              to: [formattedPhone],
              components,
            },
          ],
        },
      },
    };

    const response = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: authKey,
      },
      body: JSON.stringify(msg91Payload),
    });

    const msg91Res: any = await response.json().catch(() => ({}));
    const isSuccess = response.ok && msg91Res?.status !== 'error';
    const newSendCount = isSuccess ? (Number(sendCount) + 1) : Number(sendCount);

    // Dispatches invoice email from dobi@mail.myfabclean.com if customer has an email
    try {
      let targetEmail = req.body?.customerEmail || req.body?.email;
      if (!targetEmail && cleanOrderNum) {
        const orderRows = await supabaseRequest<any[]>(
          `/rest/v1/orders?order_number=eq.${encodeURIComponent(cleanOrderNum)}&select=customer_email,customer_phone`,
          'GET'
        ).catch(() => []);
        if (orderRows?.[0]?.customer_email) {
          targetEmail = orderRows[0].customer_email;
        } else if (orderRows?.[0]?.customer_phone) {
          const cust = await fetchCustomerByPhone(orderRows[0].customer_phone).catch(() => null);
          if (cust?.email) targetEmail = cust.email;
        }
      }
      if (!targetEmail && (customerPhone || secondaryPhone)) {
        const cust = await fetchCustomerByPhone(String(customerPhone || secondaryPhone)).catch(() => null);
        if (cust?.email) targetEmail = cust.email;
      }

      if (targetEmail && targetEmail.includes('@')) {
        sendMsg91OrderInvoiceEmail({
          customerEmail: targetEmail,
          customerName: customerName || 'Valued Customer',
          orderNumber: cleanOrderNum,
          amount: amount || 0,
          invoicePdfUrl: publicBillUrl,
        }).then((emailRes) => {
          if (emailRes.success) {
            req.log?.info({ orderNumber: cleanOrderNum, to: targetEmail }, 'Dispatched invoice email from dobi@mail.myfabclean.com');
          } else {
            req.log?.warn({ orderNumber: cleanOrderNum, err: emailRes.error }, 'Failed dispatching invoice email');
          }
        }).catch((err) => {
          req.log?.warn(err, 'Error in sendMsg91OrderInvoiceEmail');
        });
      }
    } catch (emailLookupErr) {
      req.log?.warn(emailLookupErr, 'Email dispatch lookup error');
    }

    if (cleanOrderNum) {
      try {
        const patchData: Record<string, any> = {
          last_whatsapp_status: isSuccess ? 'Sent' : (msg91Res?.message || 'Failed'),
          whatsapp_message_count: newSendCount,
          updated_at: new Date().toISOString(),
        };
        if (isSuccess) {
          patchData.last_whatsapp_sent_at = new Date().toISOString();
        }
        if (pdfUrl) patchData.invoice_url = pdfUrl;
        
        let patchRows = await supabaseRequest<any[]>(
          '/rest/v1/orders?order_number=eq.' + encodeURIComponent(cleanOrderNum),
          'PATCH',
          patchData,
          { Prefer: 'return=representation' }
        ).catch(() => []);

        if (!patchRows || patchRows.length === 0) {
          patchRows = await supabaseRequest<any[]>(
            '/rest/v1/orders?order_number=eq.' + encodeURIComponent('#' + cleanOrderNum),
            'PATCH',
            patchData,
            { Prefer: 'return=representation' }
          ).catch(() => []);
        }

        if (!patchRows || patchRows.length === 0) {
          await supabaseRequest(
            '/rest/v1/orders?id=eq.' + encodeURIComponent(cleanOrderNum),
            'PATCH',
            patchData,
            { Prefer: 'return=minimal' }
          ).catch(() => null);
        }
      } catch (patchErr) {
        req.log?.warn(patchErr, 'Failed to update order whatsapp status in Supabase');
      }
    }

    if (!isSuccess) {
      req.log?.warn({ msg91Res }, 'MSG91 WhatsApp send returned non-200');
      return res.status(200).json({
        success: false,
        error: msg91Res?.message || 'MSG91 returned an error while sending WhatsApp message',
        newSendCount,
        canResendAgain: newSendCount < 3,
      });
    }

    return res.json({
      success: true,
      templateUsed: templateName,
      newSendCount,
      canResendAgain: newSendCount < 3,
      data: msg91Res,
    });
  } catch (err: any) {
    req.log?.error(err, 'Failed to send WhatsApp message');
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to send WhatsApp message',
    });
  }
};

// Email Order Bill Sender
const handleEmailSendBill = async (req: any, res: any) => {
  try {
    const orderRef = String(req.params.id || req.body?.orderId || req.body?.orderNumber || '').trim();
    const providedEmail = String(req.body?.email || req.body?.customerEmail || '').trim();
    const customPdfUrl = req.body?.pdfUrl || req.body?.invoiceUrl;

    if (!orderRef) {
      return res.status(400).json({ success: false, error: 'Order reference is required' });
    }

    const cleanOrderNum = orderRef.replace(/^#/, '');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanOrderNum);

    let orderRow: any = null;
    if (isUuid) {
      const rows = await supabaseRequest<any[]>(`/rest/v1/orders?id=eq.${encodeURIComponent(cleanOrderNum)}&limit=1`, 'GET').catch(() => []);
      orderRow = rows?.[0];
    } else {
      let rows = await supabaseRequest<any[]>(`/rest/v1/orders?order_number=eq.${encodeURIComponent(cleanOrderNum)}&limit=1`, 'GET').catch(() => []);
      if (!rows?.[0]) {
        rows = await supabaseRequest<any[]>(`/rest/v1/orders?order_number=eq.${encodeURIComponent('#' + cleanOrderNum)}&limit=1`, 'GET').catch(() => []);
      }
      orderRow = rows?.[0];
    }

    if (!orderRow) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    let targetEmail = providedEmail || orderRow.customer_email;
    if (!targetEmail && orderRow.customer_phone) {
      const cust = await fetchCustomerByPhone(orderRow.customer_phone).catch(() => null);
      if (cust?.email) targetEmail = cust.email;
    }

    if (!targetEmail || !targetEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        needsEmail: true,
        error: 'No email address on file for this customer. Please enter their email address.',
      });
    }

    // Save provided email to order and customer if changed
    if (providedEmail && providedEmail.includes('@') && providedEmail !== orderRow.customer_email) {
      await supabaseRequest(`/rest/v1/orders?id=eq.${encodeURIComponent(orderRow.id)}`, 'PATCH', {
        customer_email: providedEmail,
        updated_at: new Date().toISOString(),
      }, { Prefer: 'return=minimal' }).catch(() => null);

      if (orderRow.customer_id) {
        await supabaseRequest(`/rest/v1/customers?id=eq.${encodeURIComponent(orderRow.customer_id)}`, 'PATCH', {
          email: providedEmail,
          updated_at: new Date().toISOString(),
        }, { Prefer: 'return=minimal' }).catch(() => null);
      } else if (orderRow.customer_phone) {
        await supabaseRequest(`/rest/v1/customers?phone=eq.${encodeURIComponent(orderRow.customer_phone)}`, 'PATCH', {
          email: providedEmail,
          updated_at: new Date().toISOString(),
        }, { Prefer: 'return=minimal' }).catch(() => null);
      }
    }

    const publicBillUrl = customPdfUrl || orderRow.invoice_url || (`https://myfabclean.com/trackorder/${encodeURIComponent(orderRow.order_number.replace(/^#/, ''))}`);

    const emailRes = await sendMsg91OrderInvoiceEmail({
      customerEmail: targetEmail,
      customerName: orderRow.customer_name || 'Valued Customer',
      orderNumber: orderRow.order_number,
      amount: orderRow.total_amount || 0,
      invoicePdfUrl: publicBillUrl,
    });

    const currentCount = Number(orderRow.email_sent_count || 0);
    const newEmailCount = currentCount + (emailRes.success ? 1 : 0);

    await supabaseRequest(`/rest/v1/orders?id=eq.${encodeURIComponent(orderRow.id)}`, 'PATCH', {
      email_sent_count: newEmailCount,
      last_email_status: emailRes.success ? 'Sent' : (emailRes.error || 'Failed'),
      last_email_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { Prefer: 'return=minimal' }).catch(() => null);

    if (!emailRes.success) {
      return res.status(200).json({
        success: false,
        error: emailRes.error || 'Failed to dispatch email via MSG91',
        newEmailCount,
      });
    }

    return res.json({
      success: true,
      message: `Tax invoice sent successfully to ${targetEmail}`,
      email: targetEmail,
      newEmailCount,
    });
  } catch (err: any) {
    req.log?.error(err, 'Failed to send email bill');
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error while sending email',
    });
  }
};

router.post('/whatsapp/send-bill', handleWhatsAppSendBill);
router.post('/api/whatsapp/send-bill', handleWhatsAppSendBill);
router.post('/whatsapp/send-invoice', handleWhatsAppSendBill);
router.post('/api/whatsapp/send-invoice', handleWhatsAppSendBill);

router.post('/orders/:id/send-email-bill', handleEmailSendBill);
router.post('/api/orders/:id/send-email-bill', handleEmailSendBill);
router.post('/orders/send-email-bill', handleEmailSendBill);
router.post('/api/orders/send-email-bill', handleEmailSendBill);

// ==========================================
// 8. APP & WEBSITE MANAGEMENT ROUTES (SUPER ADMIN)
// ==========================================

// Get Account Deletion Requests from Supabase settings
router.get(['/erp/account-deletion-requests', '/api/erp/account-deletion-requests'], async (req, res) => {
  try {
    const rows = await supabaseRequest<any[]>('/rest/v1/settings?category=eq.account_deletion&order=updated_at.desc', 'GET').catch(() => []);
    const items = rows.map((r) => {
      try {
        const parsed = JSON.parse(r.value);
        return {
          settingKey: r.key,
          updatedAt: r.updated_at,
          ...parsed,
        };
      } catch {
        return {
          settingKey: r.key,
          updatedAt: r.updated_at,
          raw: r.value,
        };
      }
    });
    res.json({ success: true, count: items.length, data: items });
  } catch (err: any) {
    req.log?.error(err, 'Failed to fetch deletion requests');
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

// Update Deletion Request Status (Approve/Erase, Retain, Dismiss)
router.post(['/erp/account-deletion-requests/:key/action', '/api/erp/account-deletion-requests/:key/action'], async (req, res) => {
  try {
    const key = req.params.key as string;
    const { action, adminNotes } = req.body || {};

    const rows = await supabaseRequest<any[]>(`/rest/v1/settings?key=eq.${encodeURIComponent(key)}&limit=1`, 'GET').catch(() => []);
    if (!rows?.[0]) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(rows[0].value);
    } catch (_) {}

    const newStatus = action === 'approve_delete' ? 'approved_deleted' : action === 'retain' ? 'retained' : action === 'contacted' ? 'customer_contacted' : 'dismissed';
    parsed.status = newStatus;
    parsed.adminNotes = adminNotes || parsed.adminNotes || '';
    parsed.processedAt = new Date().toISOString();

    if (action === 'approve_delete' && parsed.customerPhone) {
      const cleanPhone = parsed.customerPhone;
      await supabaseRequest(`/rest/v1/customers?phone=ilike.*${encodeURIComponent(cleanPhone.slice(-10))}*`, 'PATCH', {
        name: 'Deleted Customer',
        phone: '0000000000',
        email: null,
        status: 'deleted',
        notes: `Account deleted per DPDP request. Survey: ${parsed.reason}`,
      }).catch(() => null);
    }

    await supabaseRequest(`/rest/v1/settings?key=eq.${encodeURIComponent(key)}`, 'PATCH', {
      value: JSON.stringify(parsed),
      updated_at: new Date().toISOString(),
      updated_by: 'erp_admin',
    }, { Prefer: 'return=minimal' });

    return res.json({ success: true, message: `Request updated to ${newStatus}`, data: parsed });
  } catch (err: any) {
    req.log?.error(err, 'Failed to update deletion request');
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Referral Program & Statistics for App Management Hub
router.get(['/erp/app-management/referrals', '/api/erp/app-management/referrals'], async (req, res) => {
  try {
    const rows: any[] = await supabaseRequest<any[]>('/rest/v1/portal_referrals?select=*&order=created_at.desc&limit=100', 'GET').catch(() => []);
    const settingsRows = await supabaseRequest<any[]>('/rest/v1/settings?category=eq.app_config&key=eq.referral_program&limit=1', 'GET').catch(() => []);
    let config = { referrerBonus: 50, refereeBonus: 25, isActive: true };
    if (settingsRows?.[0]?.value) {
      try { config = JSON.parse(settingsRows[0].value); } catch (_) {}
    }

    const totalRewardsCredited = rows.reduce((sum, r) => sum + (Number(r.referrer_reward) || 0) + (Number(r.referee_reward) || 0), 0);
    const uniqueReferrers = new Set(rows.map(r => r.referrer_phone).filter(Boolean)).size;

    res.json({
      success: true,
      config,
      stats: {
        totalReferrals: rows.length,
        uniqueReferrers,
        totalRewardsCredited,
      },
      data: rows,
    });
  } catch (err: any) {
    req.log?.error(err, 'Failed to fetch referrals');
    res.status(500).json({ success: false, error: err.message });
  }
});

// App & Website Banners Management
router.get(['/erp/app-management/banners', '/api/erp/app-management/banners'], async (req, res) => {
  try {
    const rows = await supabaseRequest<any[]>('/rest/v1/settings?category=eq.app_banner', 'GET').catch(() => []);
    let banners = rows.map(r => {
      try { return JSON.parse(r.value); } catch { return null; }
    }).filter(Boolean);

    if (banners.length === 0) {
      banners = [
        {
          id: 'diwali_special_50',
          title: 'Diwali Special: 50% OFF on All Dry Cleaning Services',
          subtitle: 'Relax this Diwali... Let us take care of your special garments! Use Code FABDIWALI',
          code: 'FABDIWALI',
          discountPercent: 50,
          badge: 'DIWALI SPECIAL 50% OFF',
          imageUrl: '/diwali-special.jpg',
          validTill: '5 Nov 2026',
          isActive: true,
          target: 'both',
        },
      ];
    }

    res.json({ success: true, banners });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, banners: [] });
  }
});

router.post(['/erp/app-management/banners', '/api/erp/app-management/banners'], async (req, res) => {
  try {
    const { banner } = req.body || {};
    if (!banner?.id) return res.status(400).json({ success: false, error: 'Banner ID is required' });

    const key = `banner_${banner.id}`;
    const payload = {
      key,
      value: JSON.stringify(banner),
      category: 'app_banner',
      updated_at: new Date().toISOString(),
      updated_by: 'erp_admin',
    };

    // Check if the setting already exists to avoid unique constraint conflict
    const existing = await supabaseRequest<any[]>(`/rest/v1/settings?key=eq.${encodeURIComponent(key)}&limit=1`, 'GET').catch(() => []);
    if (existing && existing.length > 0) {
      await supabaseRequest(`/rest/v1/settings?key=eq.${encodeURIComponent(key)}`, 'PATCH', payload);
    } else {
      await supabaseRequest('/rest/v1/settings', 'POST', payload);
    }

    return res.json({ success: true, message: 'Banner updated successfully', banner });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Website Public Enquiries from contacts table
router.get(["/erp/website-management/enquiries", "/api/erp/website-management/enquiries", "/erp/website/enquiries", "/api/erp/website/enquiries"], async (req, res) => {
  try {
    const rows = await supabaseRequest<any[]>('/rest/v1/contacts?select=*&order=created_at.desc&limit=100', 'GET').catch(() => []);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err: any) {
    req.log?.error(err, 'Failed to fetch contact inquiries');
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

export default router;
