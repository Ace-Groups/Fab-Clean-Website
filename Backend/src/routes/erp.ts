
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
import { supabaseRequest } from "../lib/supabase-admin.js";
import { recordOrderCreditDebit, recordWalletPaymentDebit } from "../lib/wallet-engine.js";

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
    items: Array.isArray(parsedItems) ? parsedItems : [],
    totalAmount: Number(o.total_amount || 0),
    total_amount: Number(o.total_amount || 0),
    advancePaid: Number(o.advance_paid || 0),
    advance_paid: Number(o.advance_paid || 0),
    paymentMethod: o.payment_method || "credit",
    payment_method: o.payment_method || "credit",
    paymentStatus: o.payment_status || "unpaid",
    payment_status: o.payment_status || "unpaid",
    isCreditOrder: Boolean(o.is_credit_order),
    is_credit_order: Boolean(o.is_credit_order),
    creditUsed: Number(o.credit_used || 0),
    credit_used: Number(o.credit_used || 0),
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
    res.json(rows[0]);
  } catch (err: any) {
    req.log?.error(err, "Failed to fetch service");
    res.status(500).json({ error: err.message });
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
    res.json({ success: true, data: addressList });
  } catch (err: any) {
    req.log?.error(err, "Failed to load customer addresses");
    res.status(500).json({ success: false, data: [] });
  }
});

router.get("/customers/:id", async (req, res) => {
  try {
    const rows = await supabaseRequest<any[]>(`/rest/v1/customers?id=eq.${encodeURIComponent(req.params.id)}&limit=1`, "GET");
    if (!rows[0]) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(mapCustomer(rows[0]));
  } catch (err: any) {
    req.log?.error(err, "Failed to fetch customer");
    res.status(500).json({ error: err.message });
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
    const rows = await supabaseRequest<any[]>(
      `/rest/v1/orders?customer_id=eq.${encodeURIComponent(customerId)}&order=created_at.desc&limit=50`,
      "GET",
    );
    res.json(rows.map(mapOrderForErp));
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
      let q = "/rest/v1/orders?select=*&order=created_at.desc";
      if (createdDate && typeof createdDate === "string") {
        q += `&created_at=gte.${createdDate}T00:00:00Z&created_at=lte.${createdDate}T23:59:59Z`;
      } else if (dateFrom && typeof dateFrom === "string") {
        q += `&created_at=gte.${encodeURIComponent(dateFrom)}`;
      }
      const lim = Math.min(500, Number(limit) || 100);
      q += `&limit=${lim}`;

      const rows = await supabaseRequest<any[]>(q, "GET");
      const mapped = rows.map(mapOrderForErp);
      return res.json(mapped);
    } catch (err: any) {
      req.log?.error(err, "Failed to list ERP orders");
      return res.status(500).json({ success: false, error: { message: err.message } });
    }
  }

  // Otherwise, pass to customer portal handler in portal.ts
  next();
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
    res.json({ success: true, data: unprinted });
  } catch (err: any) {
    req.log?.error(err, "Failed to fetch print queue");
    res.json({ success: true, data: [] });
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

    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.json({ success: true, data: [] });
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
    if (body.notes !== undefined) snake.notes = body.notes;
    if (body.assignedTo !== undefined) snake.assigned_to = body.assignedTo;
    if (body.tagsPrinted !== undefined) snake.tags_printed = body.tagsPrinted;
    if (body.storeCode !== undefined) snake.store_code = body.storeCode;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    const filter = isUuid ? `id=eq.${encodeURIComponent(orderId)}` : `order_number=eq.${encodeURIComponent(orderId)}`;
    const updated = await supabaseRequest<any[]>(`/rest/v1/orders?${filter}`, "PATCH", snake, {
      Prefer: "return=representation",
    });
    const order = mapOrderForErp(updated[0] || { id: orderId, ...body });
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
    const year = new Date().getFullYear();
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `FZC-${year}FAB${randomSuffix}`;

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
      created_at: new Date().toISOString(),
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

    await supabaseRequest(`/rest/v1/pickups?id=eq.${encodeURIComponent(id)}`, "PATCH", patchPayload, {
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
    const pickups = await supabaseRequest<any[]>(`/rest/v1/pickups?id=eq.${encodeURIComponent(id)}`, "GET");
    const pickup = pickups[0];
    if (!pickup) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const year = new Date().getFullYear();
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `FZC-${year}FAB${randomSuffix}`;
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
      `/rest/v1/pickups?id=eq.${encodeURIComponent(id)}`,
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

    res.json({
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
    res.status(500).json({ success: false, message: err.message || "Failed to convert booking" });
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

export default router;
