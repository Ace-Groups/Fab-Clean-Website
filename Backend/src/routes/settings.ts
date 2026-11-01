import { Router, type IRouter } from "express";
import crypto from "crypto";
import { supabaseRequest } from "../lib/supabase-admin.js";

const router: IRouter = Router();

function mapStoreToCamel(row: any) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    shortName: row.short_name || row.code || "",
    isActive: row.is_active ?? true,
    isDefault: row.is_default ?? false,
    sortOrder: Number(row.sort_order ?? 0),
    address: row.address || {},
    contactDetails: row.contact_details || {},
    legalDetails: row.legal_details || {},
    invoiceOverrides: row.invoice_overrides || {},
    tagOverrides: row.tag_overrides || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStoreToSnake(payload: any) {
  const snake: Record<string, any> = {};
  if (payload.code !== undefined) snake.code = String(payload.code).trim().toUpperCase();
  if (payload.name !== undefined) snake.name = String(payload.name).trim();
  if (payload.shortName !== undefined) snake.short_name = String(payload.shortName).trim();
  if (payload.isActive !== undefined) snake.is_active = Boolean(payload.isActive);
  if (payload.isDefault !== undefined) snake.is_default = Boolean(payload.isDefault);
  if (payload.sortOrder !== undefined) snake.sort_order = Number(payload.sortOrder);
  if (payload.address !== undefined) snake.address = payload.address;
  if (payload.contactDetails !== undefined) snake.contact_details = payload.contactDetails;
  if (payload.legalDetails !== undefined) snake.legal_details = payload.legalDetails;
  if (payload.invoiceOverrides !== undefined) snake.invoice_overrides = payload.invoiceOverrides;
  if (payload.tagOverrides !== undefined) snake.tag_overrides = payload.tagOverrides;
  return snake;
}

function mapProfileToCamel(row: any) {
  if (!row) {
    return {
      scopeKey: "global",
      companyName: "Fab Clean",
      legalName: "Fab Clean",
      companyAddress: {
        city: "Pollachi",
        line1: "#16, Venkatramana Round Road, Mahalingapuram",
        state: "Tamil Nadu",
        country: "India",
        pincode: "642002"
      },
      contactDetails: {
        email: "support@myfabclean.com",
        phone: "+91 93630 59595",
        website: "https://myfabclean.com"
      },
      taxDetails: {
        pan: "AITPD3522F",
        gstin: "33AITPD3522F1ZK",
        currency: "INR"
      },
      paymentDetails: {
        upiId: "9886788858@pz",
        upiName: "Fab Clean"
      },
      invoiceDefaults: {
        showLogo: true,
        showTerms: true,
        showPaymentQr: true,
        defaultDueDays: 12
      }
    };
  }

  return {
    id: row.id,
    scopeKey: row.scope_key || "global",
    companyName: row.company_name || "Fab Clean",
    legalName: row.legal_name || "",
    companyAddress: row.company_address || {},
    contactDetails: row.contact_details || {},
    taxDetails: row.tax_details || {},
    paymentDetails: row.payment_details || {},
    invoiceDefaults: row.invoice_defaults || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInvoiceTemplateToCamel(row: any) {
  return {
    id: row.id,
    templateKey: row.template_key,
    name: row.name,
    description: row.description || "",
    presetKey: row.preset_key || "classic",
    storeId: row.store_id || null,
    isAiOptimized: Boolean(row.is_ai_optimized),
    isActive: row.is_active ?? true,
    isDefault: row.is_default ?? false,
    sortOrder: Number(row.sort_order ?? 0),
    config: row.config || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTagTemplateToCamel(row: any) {
  return {
    id: row.id,
    templateKey: row.template_key,
    name: row.name,
    description: row.description || "",
    layoutKey: row.layout_key || "thermal_compact",
    storeId: row.store_id || null,
    isAiOptimized: Boolean(row.is_ai_optimized),
    isActive: row.is_active ?? true,
    isDefault: row.is_default ?? false,
    sortOrder: Number(row.sort_order ?? 0),
    config: row.config || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// STORES
// ==========================================

router.get("/settings/stores", async (req, res) => {
  try {
    const activeOnly = req.query.activeOnly === "true";
    let endpoint = "/rest/v1/stores?select=*&order=sort_order.asc,name.asc";
    if (activeOnly) {
      endpoint += "&is_active=eq.true";
    }

    const rows = await supabaseRequest<any[]>(endpoint, "GET");
    const stores = (rows || []).map(mapStoreToCamel);

    res.json({ success: true, stores });
  } catch (error: any) {
    req.log?.error(error, "Failed to load stores");
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/settings/stores", async (req, res) => {
  try {
    const payload = req.body || {};
    const storeId = payload.id || crypto.randomUUID();
    const snake = {
      id: storeId,
      slug: storeId,
      ...mapStoreToSnake(payload),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const inserted = await supabaseRequest<any[]>("/rest/v1/stores", "POST", snake, {
      Prefer: "return=representation",
    });

    const store = mapStoreToCamel(inserted[0]);
    res.json({ success: true, store });
  } catch (error: any) {
    req.log?.error(error, "Failed to create store");
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put("/settings/stores/:id", async (req, res) => {
  try {
    const storeId = req.params.id;
    const payload = req.body || {};
    const snake = {
      ...mapStoreToSnake(payload),
      updated_at: new Date().toISOString(),
    };

    const updated = await supabaseRequest<any[]>(
      `/rest/v1/stores?id=eq.${storeId}`,
      "PATCH",
      snake,
      { Prefer: "return=representation" }
    );

    const store = mapStoreToCamel(updated[0] || { id: storeId, ...payload });
    res.json({ success: true, store });
  } catch (error: any) {
    req.log?.error(error, "Failed to update store");
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==========================================
// BUSINESS PROFILE
// ==========================================

router.get("/settings/business-profile", async (req, res) => {
  try {
    const rows = await supabaseRequest<any[]>(
      "/rest/v1/business_profiles?scope_key=eq.global&select=*",
      "GET"
    );
    const profile = mapProfileToCamel(rows[0]);
    res.json({ success: true, profile });
  } catch (error: any) {
    req.log?.error(error, "Failed to load business profile");
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/settings/business-profile", async (req, res) => {
  try {
    const payload = req.body || {};
    const snake: Record<string, any> = {
      scope_key: "global",
      updated_at: new Date().toISOString(),
    };

    if (payload.companyName !== undefined) snake.company_name = payload.companyName;
    if (payload.legalName !== undefined) snake.legal_name = payload.legalName;
    if (payload.companyAddress !== undefined) snake.company_address = payload.companyAddress;
    if (payload.contactDetails !== undefined) snake.contact_details = payload.contactDetails;
    if (payload.taxDetails !== undefined) snake.tax_details = payload.taxDetails;
    if (payload.paymentDetails !== undefined) snake.payment_details = payload.paymentDetails;
    if (payload.invoiceDefaults !== undefined) snake.invoice_defaults = payload.invoiceDefaults;

    const upserted = await supabaseRequest<any[]>(
      "/rest/v1/business_profiles?on_conflict=scope_key",
      "POST",
      snake,
      { Prefer: "return=representation,resolution=merge-duplicates" }
    );

    const profile = mapProfileToCamel(upserted[0] || payload);
    res.json({ success: true, profile });
  } catch (error: any) {
    req.log?.error(error, "Failed to update business profile");
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==========================================
// INVOICE TEMPLATES
// ==========================================

router.get("/settings/invoice-templates", async (req, res) => {
  try {
    const storeId = req.query.storeId === "global" ? null : (req.query.storeId as string);
    const activeOnly = req.query.activeOnly === "true";

    let endpoint = "/rest/v1/invoice_templates?select=*&order=sort_order.asc,name.asc";
    if (activeOnly) endpoint += "&is_active=eq.true";
    if (storeId === null) endpoint += "&store_id=is.null";
    else if (storeId) endpoint += `&store_id=eq.${storeId}`;

    const rows = await supabaseRequest<any[]>(endpoint, "GET");
    const templates = (rows || []).map(mapInvoiceTemplateToCamel);

    res.json({ success: true, templates });
  } catch (error: any) {
    req.log?.error(error, "Failed to load invoice templates");
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/settings/invoice-templates/resolve", async (req, res) => {
  try {
    const storeId = req.query.storeId as string;
    const storeCode = req.query.storeCode as string;
    const templateKey = req.query.templateKey as string;

    const [profiles, stores, templates] = await Promise.all([
      supabaseRequest<any[]>("/rest/v1/business_profiles?scope_key=eq.global&select=*", "GET"),
      storeId
        ? supabaseRequest<any[]>(`/rest/v1/stores?id=eq.${storeId}&select=*`, "GET")
        : storeCode
        ? supabaseRequest<any[]>(`/rest/v1/stores?code=eq.${storeCode.toUpperCase()}&select=*`, "GET")
        : Promise.resolve([]),
      supabaseRequest<any[]>("/rest/v1/invoice_templates?is_active=eq.true&select=*&order=sort_order.asc", "GET"),
    ]);

    const businessProfile = mapProfileToCamel(profiles[0]);
    const store = stores[0] ? mapStoreToCamel(stores[0]) : null;
    let template = (templates || []).map(mapInvoiceTemplateToCamel).find((t) =>
      templateKey ? t.templateKey === templateKey : t.isDefault
    ) || (templates[0] ? mapInvoiceTemplateToCamel(templates[0]) : null);

    res.json({ success: true, businessProfile, store, template });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/settings/invoice-templates", async (req, res) => {
  try {
    const payload = req.body || {};
    const templateId = payload.id || crypto.randomUUID();
    const snake = {
      id: templateId,
      template_key: payload.templateKey || `tpl-${Date.now()}`,
      name: payload.name || "Invoice Template",
      description: payload.description || "",
      preset_key: payload.presetKey || "classic",
      store_id: payload.storeId || null,
      is_ai_optimized: Boolean(payload.isAiOptimized),
      is_active: payload.isActive ?? true,
      is_default: payload.isDefault ?? false,
      sort_order: Number(payload.sortOrder ?? 0),
      config: payload.config || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const inserted = await supabaseRequest<any[]>("/rest/v1/invoice_templates", "POST", snake, {
      Prefer: "return=representation",
    });

    const template = mapInvoiceTemplateToCamel(inserted[0]);
    res.json({ success: true, template });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put("/settings/invoice-templates/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const payload = req.body || {};
    const snake: Record<string, any> = { updated_at: new Date().toISOString() };

    if (payload.name !== undefined) snake.name = payload.name;
    if (payload.description !== undefined) snake.description = payload.description;
    if (payload.presetKey !== undefined) snake.preset_key = payload.presetKey;
    if (payload.isAiOptimized !== undefined) snake.is_ai_optimized = payload.isAiOptimized;
    if (payload.isActive !== undefined) snake.is_active = payload.isActive;
    if (payload.isDefault !== undefined) snake.is_default = payload.isDefault;
    if (payload.sortOrder !== undefined) snake.sort_order = payload.sortOrder;
    if (payload.config !== undefined) snake.config = payload.config;

    const updated = await supabaseRequest<any[]>(
      `/rest/v1/invoice_templates?id=eq.${id}`,
      "PATCH",
      snake,
      { Prefer: "return=representation" }
    );

    const template = mapInvoiceTemplateToCamel(updated[0] || { id, ...payload });
    res.json({ success: true, template });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==========================================
// TAG TEMPLATES
// ==========================================

router.get("/settings/tag-templates", async (req, res) => {
  try {
    const storeId = req.query.storeId === "global" ? null : (req.query.storeId as string);
    const activeOnly = req.query.activeOnly === "true";

    let endpoint = "/rest/v1/tag_templates?select=*&order=sort_order.asc,name.asc";
    if (activeOnly) endpoint += "&is_active=eq.true";
    if (storeId === null) endpoint += "&store_id=is.null";
    else if (storeId) endpoint += `&store_id=eq.${storeId}`;

    const rows = await supabaseRequest<any[]>(endpoint, "GET");
    const templates = (rows || []).map(mapTagTemplateToCamel);

    res.json({ success: true, templates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/settings/tag-templates/resolve", async (req, res) => {
  try {
    const storeId = req.query.storeId as string;
    const templateKey = req.query.templateKey as string;

    const [stores, templates] = await Promise.all([
      storeId ? supabaseRequest<any[]>(`/rest/v1/stores?id=eq.${storeId}&select=*`, "GET") : Promise.resolve([]),
      supabaseRequest<any[]>("/rest/v1/tag_templates?is_active=eq.true&select=*&order=sort_order.asc", "GET"),
    ]);

    const store = stores[0] ? mapStoreToCamel(stores[0]) : null;
    let template = (templates || []).map(mapTagTemplateToCamel).find((t) =>
      templateKey ? t.templateKey === templateKey : t.isDefault
    ) || (templates[0] ? mapTagTemplateToCamel(templates[0]) : null);

    res.json({ success: true, store, template });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// BUSINESS SETTINGS
// ==========================================

router.get("/business-settings", (_req, res) => {
  res.json({
    success: true,
    settings: {
      taxRate: 18,
      currencySymbol: "₹",
      minimumOrderValue: 200,
      defaultTurnaroundHours: 48,
      expressSurchargePercent: 50,
      enableStockAlerts: true,
      lowStockThreshold: 10,
      receiptHeader: "Fab Clean Premium Garment Care",
      receiptFooter: "Thank you for choosing Fab Clean!",
    },
  });
});

router.put("/business-settings", (req, res) => {
  res.json({
    success: true,
    settings: req.body,
  });
});

export default router;
