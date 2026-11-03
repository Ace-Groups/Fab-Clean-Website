import { Router, type IRouter } from "express";
import crypto from "crypto";
import { supabaseRequest } from "../lib/supabase-admin.js";

const router: IRouter = Router();

// GET /api/expenses - List expenses with filters and summary
router.get("/expenses", async (req, res) => {
  try {
    const { storeCode, dateFrom, dateTo, category, limit = "200" } = req.query;

    let query = "/rest/v1/mapp_expense_entries?select=*&order=incurred_at.desc,created_at.desc";

    if (storeCode && typeof storeCode === "string" && storeCode !== "all") {
      query += `&store_code=eq.${encodeURIComponent(storeCode.toUpperCase())}`;
    }

    if (category && typeof category === "string" && category !== "all") {
      query += `&category=eq.${encodeURIComponent(category)}`;
    }

    if (dateFrom && typeof dateFrom === "string") {
      query += `&incurred_at=gte.${encodeURIComponent(dateFrom)}`;
    }

    if (dateTo && typeof dateTo === "string") {
      query += `&incurred_at=lte.${encodeURIComponent(dateTo)}`;
    }

    const maxLimit = Math.min(1000, Number(limit) || 200);
    query += `&limit=${maxLimit}`;

    const rows = await supabaseRequest<any[]>(query, "GET").catch(() => []);

    // Summary calculations
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthStr = now.toISOString().slice(0, 7);

    let totalAmount = 0;
    let todayAmount = 0;
    let monthAmount = 0;
    const byStore: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const r of rows) {
      const amt = Number(r.amount || 0);
      totalAmount += amt;

      const incurredDate = String(r.incurred_at || "").slice(0, 10);
      if (incurredDate === todayStr) {
        todayAmount += amt;
      }
      if (incurredDate.startsWith(monthStr)) {
        monthAmount += amt;
      }

      const st = String(r.store_code || "UNKNOWN").toUpperCase();
      byStore[st] = (byStore[st] || 0) + amt;

      const cat = String(r.category || "General");
      byCategory[cat] = (byCategory[cat] || 0) + amt;
    }

    return res.json({
      success: true,
      data: rows,
      summary: {
        totalAmount,
        todayAmount,
        monthAmount,
        byStore,
        byCategory,
        count: rows.length,
      },
    });
  } catch (err: any) {
    req.log?.error(err, "Failed to fetch expenses");
    return res.status(500).json({
      success: false,
      error: { message: err.message || "Failed to load expenses" },
    });
  }
});

// POST /api/expenses - Log a new daily expense store-wise
router.post("/expenses", async (req, res) => {
  try {
    const { amount, category, note, incurred_at, store_code, payment_mode, created_by } = req.body || {};

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: { message: "Valid expense amount is required" },
      });
    }

    if (!category || typeof category !== "string") {
      return res.status(400).json({
        success: false,
        error: { message: "Expense category is required" },
      });
    }

    const finalStoreCode = String(store_code || "POL").trim().toUpperCase();
    const finalDate = incurred_at
      ? new Date(incurred_at).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const fullNote = payment_mode
      ? `[${String(payment_mode).toUpperCase()}] ${note || ""}`.trim()
      : String(note || "").trim();

    const payload = {
      id: crypto.randomUUID(),
      amount: numericAmount,
      category: category.trim(),
      note: fullNote,
      incurred_at: finalDate,
      store_code: finalStoreCode,
      created_by: String(created_by || (req as any).authUser?.name || "Admin").trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const inserted = await supabaseRequest<any[]>(
      "/rest/v1/mapp_expense_entries",
      "POST",
      payload,
      { Prefer: "return=representation" }
    );

    return res.status(201).json({
      success: true,
      data: Array.isArray(inserted) && inserted.length > 0 ? inserted[0] : payload,
      message: "Daily expense recorded successfully",
    });
  } catch (err: any) {
    req.log?.error(err, "Failed to create expense");
    return res.status(500).json({
      success: false,
      error: { message: err.message || "Failed to record expense" },
    });
  }
});

// DELETE /api/expenses/:id - Remove an expense entry
router.delete("/expenses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: { message: "Expense ID is required" } });
    }

    await supabaseRequest(`/rest/v1/mapp_expense_entries?id=eq.${encodeURIComponent(id)}`, "DELETE");

    return res.json({
      success: true,
      message: "Expense entry deleted successfully",
    });
  } catch (err: any) {
    req.log?.error(err, "Failed to delete expense");
    return res.status(500).json({
      success: false,
      error: { message: err.message || "Failed to delete expense" },
    });
  }
});

export default router;
