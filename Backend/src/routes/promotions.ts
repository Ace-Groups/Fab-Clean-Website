import { Router, type IRouter } from "express";
import crypto from "crypto";
import { supabaseRequest } from "../lib/supabase-admin.js";

const router: IRouter = Router();

// In-memory + Supabase backed store for promotional campaigns and ad spend
const SETTINGS_KEY = "marketing.promotions_and_ads";

async function getPromotionsData(): Promise<{ coupons: any[]; adCampaigns: any[] }> {
  try {
    const rows = await supabaseRequest<any[]>(
      `/rest/v1/settings?key=eq.${encodeURIComponent(SETTINGS_KEY)}&select=value`,
      "GET"
    ).catch(() => []);

    if (rows && rows.length > 0 && rows[0]?.value) {
      return typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value;
    }
  } catch (e) {
    // fallback
  }

  // Default seed promotions
  return {
    coupons: [
      {
        id: "fabdiwali-2026",
        code: "FABDIWALI",
        title: "Diwali 50% Off Dry Cleaning",
        description: "50% off on all Dry Cleaning, Shoe Cleaning, Bags & Home Linen for first-time customers.",
        discountType: "percentage",
        discountValue: 50,
        firstTimeOnly: true,
        category: "Dry Cleaning, Shoes, Bags, Curtains",
        startDate: "2026-10-28",
        endDate: "2026-11-05",
        status: "active",
        usageCount: 14,
      },
      {
        id: "welcome-50",
        code: "WELCOME50",
        title: "New Customer ₹50 Welcome Cash",
        description: "₹50 flat referral / welcome credit on initial order registration.",
        discountType: "fixed",
        discountValue: 50,
        firstTimeOnly: true,
        category: "All Services",
        startDate: "2026-09-01",
        endDate: "2026-12-31",
        status: "active",
        usageCount: 88,
      },
    ],
    adCampaigns: [
      {
        id: "meta-diwali-2026",
        name: "Diwali Special 50% Meta & Instagram Campaign",
        platform: "Meta / Instagram",
        spendAmount: 4500,
        startDate: "2026-10-25",
        endDate: "2026-11-05",
        targetAudience: "Pollachi & Coimbatore garment care, working professionals",
        impressions: 24500,
        leads: 180,
        ordersGenerated: 42,
        couponCode: "FABDIWALI",
        status: "active",
        notes: "Targeting premium fabric dry clean & shoe laundry users.",
      },
      {
        id: "local-flyers-sep",
        name: "Mahalingapuram Doorstep Flyers Distribution",
        platform: "Print / Flyers",
        spendAmount: 2500,
        startDate: "2026-10-01",
        endDate: "2026-10-15",
        targetAudience: "Mahalingapuram, Suleeswaranpatti residences",
        impressions: 3000,
        leads: 45,
        ordersGenerated: 18,
        couponCode: "WELCOME50",
        status: "completed",
        notes: "Local area print inserts with QR code for quick doorstep pickup booking.",
      },
    ],
  };
}

async function savePromotionsData(data: { coupons: any[]; adCampaigns: any[] }): Promise<void> {
  const payload = {
    category: "marketing",
    key: SETTINGS_KEY,
    value: data,
    updated_at: new Date().toISOString(),
  };

  const existing = await supabaseRequest<any[]>(
    `/rest/v1/settings?key=eq.${encodeURIComponent(SETTINGS_KEY)}&select=id`,
    "GET"
  ).catch(() => []);

  if (existing && existing.length > 0) {
    await supabaseRequest(
      `/rest/v1/settings?key=eq.${encodeURIComponent(SETTINGS_KEY)}`,
      "PATCH",
      payload
    );
  } else {
    await supabaseRequest("/rest/v1/settings", "POST", {
      ...payload,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    });
  }
}

// GET /api/promotions - List all active coupons, ad campaigns, and spending metrics
router.get("/promotions", async (req, res) => {
  try {
    const data = await getPromotionsData();

    // Calculate aggregated metrics
    const totalAdSpend = data.adCampaigns.reduce((sum, c) => sum + Number(c.spendAmount || 0), 0);
    const totalOrdersAttributed = data.adCampaigns.reduce((sum, c) => sum + Number(c.ordersGenerated || 0), 0);
    const activeCouponsCount = data.coupons.filter(c => c.status === "active").length;
    const activeCampaignsCount = data.adCampaigns.filter(c => c.status === "active").length;

    return res.json({
      success: true,
      data,
      metrics: {
        totalAdSpend,
        totalOrdersAttributed,
        activeCouponsCount,
        activeCampaignsCount,
        averageCac: totalOrdersAttributed > 0 ? Math.round(totalAdSpend / totalOrdersAttributed) : 0,
      },
    });
  } catch (err: any) {
    req.log?.error(err, "Failed to load promotions");
    return res.status(500).json({ success: false, error: { message: err.message || "Failed to load promotions" } });
  }
});

// POST /api/promotions/coupon - Create or update coupon
router.post("/promotions/coupon", async (req, res) => {
  try {
    const { id, code, title, description, discountType, discountValue, firstTimeOnly, category, startDate, endDate, status } = req.body || {};

    if (!code || !title) {
      return res.status(400).json({ success: false, error: { message: "Coupon code and title are required" } });
    }

    const data = await getPromotionsData();
    const cleanCode = String(code).trim().toUpperCase();

    const existingIndex = data.coupons.findIndex(c => (id && c.id === id) || c.code === cleanCode);

    const couponRecord = {
      id: id || crypto.randomUUID(),
      code: cleanCode,
      title: String(title).trim(),
      description: String(description || "").trim(),
      discountType: discountType === "fixed" ? "fixed" : "percentage",
      discountValue: Number(discountValue) || 10,
      firstTimeOnly: Boolean(firstTimeOnly),
      category: String(category || "All Services").trim(),
      startDate: startDate || new Date().toISOString().slice(0, 10),
      endDate: endDate || "2026-12-31",
      status: status === "inactive" ? "inactive" : "active",
      usageCount: existingIndex >= 0 ? (data.coupons[existingIndex].usageCount || 0) : 0,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      data.coupons[existingIndex] = { ...data.coupons[existingIndex], ...couponRecord };
    } else {
      data.coupons.unshift(couponRecord);
    }

    await savePromotionsData(data);

    return res.status(201).json({
      success: true,
      data: couponRecord,
      message: `Coupon ${cleanCode} saved successfully`,
    });
  } catch (err: any) {
    req.log?.error(err, "Failed to save coupon");
    return res.status(500).json({ success: false, error: { message: err.message || "Failed to save coupon" } });
  }
});

// POST /api/promotions/campaign - Create or update ad/promotion campaign spend
router.post("/promotions/campaign", async (req, res) => {
  try {
    const { id, name, platform, spendAmount, startDate, endDate, targetAudience, impressions, leads, ordersGenerated, couponCode, status, notes } = req.body || {};

    if (!name || spendAmount === undefined) {
      return res.status(400).json({ success: false, error: { message: "Campaign name and spend amount are required" } });
    }

    const data = await getPromotionsData();

    const campaignRecord = {
      id: id || crypto.randomUUID(),
      name: String(name).trim(),
      platform: String(platform || "Meta / Instagram").trim(),
      spendAmount: Number(spendAmount) || 0,
      startDate: startDate || new Date().toISOString().slice(0, 10),
      endDate: endDate || new Date().toISOString().slice(0, 10),
      targetAudience: String(targetAudience || "").trim(),
      impressions: Number(impressions) || 0,
      leads: Number(leads) || 0,
      ordersGenerated: Number(ordersGenerated) || 0,
      couponCode: couponCode ? String(couponCode).trim().toUpperCase() : undefined,
      status: status || "active",
      notes: String(notes || "").trim(),
      updatedAt: new Date().toISOString(),
    };

    const existingIndex = data.adCampaigns.findIndex(c => c.id === campaignRecord.id);
    if (existingIndex >= 0) {
      data.adCampaigns[existingIndex] = { ...data.adCampaigns[existingIndex], ...campaignRecord };
    } else {
      data.adCampaigns.unshift(campaignRecord);
    }

    await savePromotionsData(data);

    return res.status(201).json({
      success: true,
      data: campaignRecord,
      message: "Ad campaign and spending recorded successfully",
    });
  } catch (err: any) {
    req.log?.error(err, "Failed to save ad campaign");
    return res.status(500).json({ success: false, error: { message: err.message || "Failed to save campaign" } });
  }
});

// DELETE /api/promotions/coupon/:id
router.delete("/promotions/coupon/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = await getPromotionsData();
    data.coupons = data.coupons.filter(c => c.id !== id && c.code !== id);
    await savePromotionsData(data);
    return res.json({ success: true, message: "Coupon deleted successfully" });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// DELETE /api/promotions/campaign/:id
router.delete("/promotions/campaign/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = await getPromotionsData();
    data.adCampaigns = data.adCampaigns.filter(c => c.id !== id);
    await savePromotionsData(data);
    return res.json({ success: true, message: "Ad campaign deleted successfully" });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
});

export default router;
