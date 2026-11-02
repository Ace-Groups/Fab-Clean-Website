import { Router, type IRouter } from "express";
import { requireAuth } from "../lib/auth.js";
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
  getRazorpayPublicConfig,
} from "../lib/razorpay.js";
import {
  fetchCustomerByPhone,
  fetchOwnedOrderById,
  updateCustomerById,
  updateOrder,
  insertTransaction,
  insertCreditTransaction,
  insertWalletTransaction,
  fetchWalletTransactions,
} from "../lib/supabase-admin.js";
import { sendPaidInvoiceWhatsApp } from "../lib/whatsapp-invoice.js";
import {
  autoSettleCustomerDueOrders,
  recordOrderPaymentCredit,
  recordWalletPaymentDebit,
  fetchUnifiedCustomerTransactions,
} from "../lib/wallet-engine.js";

const router: IRouter = Router();

/**
 * GET /api/payments/config
 * Returns public Razorpay key ID for checkout
 */
router.get("/config", (req, res) => {
  res.json({
    success: true,
    data: getRazorpayPublicConfig(),
  });
});

/**
 * GET /api/wallet/transactions
 * Returns wallet transaction history for the logged-in customer
 */
router.get("/wallet/transactions", requireAuth, async (req, res) => {
  try {
    const customer = await fetchCustomerByPhone(req.authUser!.phone);
    if (!customer?.id) {
      return res.json({ success: true, data: [] });
    }
    const transactions = await fetchUnifiedCustomerTransactions(customer.id, req.authUser!.phone);
    res.json({
      success: true,
      data: transactions,
    });
  } catch (err: any) {
    req.log.error(err, "Failed to fetch wallet transactions");
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/wallet/create-recharge-order
 * Creates a Razorpay order to recharge wallet
 */
router.post("/wallet/create-recharge-order", requireAuth, async (req, res) => {
  try {
    const { amount } = req.body;
    const rechargeAmount = Number(amount);
    if (!rechargeAmount || rechargeAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: { message: "Invalid amount. Minimum recharge is ₹1." },
      });
    }

    const customer = await fetchCustomerByPhone(req.authUser!.phone);
    if (!customer?.id) {
      return res.status(404).json({
        success: false,
        error: { message: "Customer profile not found" },
      });
    }

    const receipt = `wal_${customer.id.slice(-6)}_${Date.now().toString().slice(-6)}`;
    const rzpOrder = await createRazorpayOrder({
      amountInPaisa: rechargeAmount * 100,
      receipt,
      notes: {
        type: "WALLET_RECHARGE",
        customerId: customer.id,
        phone: req.authUser!.phone,
        customerName: customer.name || "Customer",
      },
    });

    res.json({
      success: true,
      data: {
        orderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        keyId: getRazorpayPublicConfig().keyId,
        customer: {
          name: customer.name || "",
          email: customer.email || "",
          phone: customer.phone || req.authUser!.phone,
        },
      },
    });
  } catch (err: any) {
    req.log.error(err, "Failed to create wallet recharge order");
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/wallet/verify-recharge
 * Verifies Razorpay payment signature and credits customer wallet
 */
router.post("/wallet/verify-recharge", requireAuth, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, amount } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        error: { message: "Missing Razorpay verification parameters" },
      });
    }

    const isValid = verifyRazorpaySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: { message: "Invalid signature. Payment verification failed." },
      });
    }

    const customer = await fetchCustomerByPhone(req.authUser!.phone);
    if (!customer?.id) {
      return res.status(404).json({ success: false, error: { message: "Customer profile not found" } });
    }

    const rechargeAmount = Number(amount);
    const currentBalance = Number(customer.wallet_balance_cache ?? 0);
    const newBalance = currentBalance + rechargeAmount;

    // Record wallet transaction (PostgreSQL trigger trg_wallet_transactions_after_insert
    // automatically updates customers.wallet_balance_cache and maintains ledger integrity)
    await insertWalletTransaction({
      transaction_id: `WAL-RZP-${Date.now()}-${razorpayPaymentId.slice(-6)}`,
      customer_id: customer.id,
      type: "credit",
      transaction_type: "CREDIT",
      payment_method: "UPI",
      reference_type: "PAYMENT",
      reference_id: razorpayPaymentId,
      amount: rechargeAmount,
      balance_before: currentBalance,
      balance_after: newBalance,
      note: `Razorpay Payment ID: ${razorpayPaymentId}`,
    }).catch((err) => req.log.error(err, "Failed to insert wallet_transaction row"));

    // Record general transaction ledger entry
    await insertTransaction({
      customer_id: customer.id,
      type: "WALLET_RECHARGE",
      amount: rechargeAmount,
      payment_method: "RAZORPAY",
      status: "SUCCESS",
      notes: `Razorpay Payment ID: ${razorpayPaymentId}`,
    }).catch((err) => req.log.warn(err, "Failed to insert transaction row"));

    // AUTO-SETTLEMENT ENGINE: Automatically clear any pending / partial / credit orders
    let settlementMessage = `₹${rechargeAmount} added to your wallet successfully!`;
    let settleResult = null;
    try {
      settleResult = await autoSettleCustomerDueOrders(customer.id, req.authUser!.phone);
      if (settleResult.settledOrders.length > 0) {
        const clearedNumbers = settleResult.settledOrders.map((o) => `#${o.orderNumber}`).join(", ");
        settlementMessage = `₹${rechargeAmount} added! Automatically settled ${settleResult.settledOrders.length} due order(s) (${clearedNumbers})!`;
      }
    } catch (settleErr) {
      req.log.error(settleErr, "Auto-settlement failed after wallet recharge");
    }

    const updatedCustomer = await fetchCustomerByPhone(req.authUser!.phone);
    const resolvedBalance = Number(updatedCustomer?.wallet_balance_cache ?? (settleResult?.remainingWalletBalance ?? newBalance));

    res.json({
      success: true,
      message: settlementMessage,
      data: {
        newBalance: resolvedBalance,
        paymentId: razorpayPaymentId,
        settledOrders: settleResult?.settledOrders || [],
      },
    });
  } catch (err: any) {
    req.log.error(err, "Failed to verify wallet recharge");
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/orders/:id/create-pay-order
 * Creates a Razorpay order for an unpaid order
 */
router.post("/orders/:id/create-pay-order", requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await fetchOwnedOrderById(req.authUser!.phone, orderId);

    if (!order) {
      return res.status(404).json({ success: false, error: { message: "Order not found" } });
    }

    if (order.payment_status === "paid") {
      return res.status(400).json({ success: false, error: { message: "Order is already paid" } });
    }

    const totalAmount = Number(order.total_amount ?? 0);
    const previousAdvance = Number((order as any).advance_paid ?? 0);
    const amountToPay = Number((order as any).credit_used ?? Math.max(0, totalAmount - previousAdvance));

    if (amountToPay <= 0) {
      return res.status(400).json({ success: false, error: { message: "Outstanding balance is zero" } });
    }

    const customer = await fetchCustomerByPhone(req.authUser!.phone);
    const receipt = `ord_${order.order_number.replace(/[^a-zA-Z0-9]/g, "").slice(-8)}`;

    const rzpOrder = await createRazorpayOrder({
      amountInPaisa: amountToPay * 100,
      receipt,
      notes: {
        type: "ORDER_PAYMENT",
        orderId: order.id,
        orderNumber: order.order_number,
        customerId: customer?.id || "",
        phone: req.authUser!.phone,
        creditSettlement: String(amountToPay),
      },
    });

    res.json({
      success: true,
      data: {
        orderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        keyId: getRazorpayPublicConfig().keyId,
        orderNumber: order.order_number,
        totalAmount,
        amountToPay,
        customer: {
          name: customer?.name || order.customer_name || "",
          email: customer?.email || "",
          phone: customer?.phone || req.authUser!.phone,
        },
      },
    });
  } catch (err: any) {
    req.log.error(err, "Failed to create order payment");
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/orders/:id/verify-pay
 * Verifies Razorpay payment for an unpaid order, settles credit balance, updates order, and fires WhatsApp Paid Invoice.
 */
router.post("/orders/:id/verify-pay", requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        error: { message: "Missing Razorpay verification parameters" },
      });
    }

    const isValid = verifyRazorpaySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: { message: "Invalid signature. Payment verification failed." },
      });
    }

    const order = await fetchOwnedOrderById(req.authUser!.phone, orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: { message: "Order not found" } });
    }

    const customer = await fetchCustomerByPhone(req.authUser!.phone);
    const totalAmount = Number(order.total_amount ?? 0);
    const previousAdvance = Number((order as any).advance_paid ?? 0);
    const amountPaid = Number((order as any).credit_used ?? Math.max(0, totalAmount - previousAdvance));

    // 1. Update Order in Supabase to PAID
    await updateOrder(order.id, {
      payment_status: "paid",
      payment_method: previousAdvance > 0 ? `${(order as any).payment_method || "cash"} + online_upi` : "online_razorpay",
      advance_paid: totalAmount,
      credit_used: 0,
      is_credit_order: false,
      updated_at: new Date().toISOString(),
    });

    // 2. Settle customer wallet & credit ledger for this online order payment
    if (customer?.id && amountPaid > 0) {
      try {
        await recordOrderPaymentCredit({
          customerId: customer.id,
          orderId: order.id,
          orderNumber: order.order_number,
          amountPaid,
          paymentMethod: "UPI",
          referenceId: razorpayPaymentId,
        });
      } catch (walErr) {
        req.log?.warn(walErr, "Failed to record payment credit in wallet ledger");
      }

      // Insert transaction ledger
      await insertTransaction({
        customer_id: customer.id,
        order_id: order.id,
        type: "ORDER_PAYMENT",
        amount: amountPaid,
        payment_method: "ONLINE_RAZORPAY",
        status: "SUCCESS",
        notes: `Razorpay: ${razorpayPaymentId}`,
      }).catch((err) => req.log.warn(err, "Failed to insert transaction row"));
    }

    // 3. Trigger WhatsApp Paid Invoice
    if (order.invoice_url) {
      const itemsList = Array.isArray(order.items)
        ? order.items.map((it: any) => it.serviceName || it.name || "Item").join(", ")
        : "Dry Cleaning & Laundry";

      void sendPaidInvoiceWhatsApp({
        phoneNumber: req.authUser!.phone,
        customerName: order.customer_name || customer?.name || "Customer",
        orderNumber: order.order_number,
        amount: amountPaid,
        invoiceUrl: order.invoice_url,
        itemsSummary: itemsList,
      });
    }

    res.json({
      success: true,
      message: `Order ${order.order_number} marked as Paid!`,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        paymentStatus: "paid",
        paymentId: razorpayPaymentId,
      },
    });
  } catch (err: any) {
    req.log.error(err, "Failed to verify order payment");
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/orders/:id/pay-with-wallet
 * Pays an unpaid order directly using the customer's wallet balance
 */
router.post("/orders/:id/pay-with-wallet", requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await fetchOwnedOrderById(req.authUser!.phone, orderId);

    if (!order) {
      return res.status(404).json({ success: false, error: { message: "Order not found" } });
    }

    if (order.payment_status === "paid") {
      return res.status(400).json({ success: false, error: { message: "Order is already paid" } });
    }

    const customer = await fetchCustomerByPhone(req.authUser!.phone);
    if (!customer?.id) {
      return res.status(404).json({ success: false, error: { message: "Customer profile not found" } });
    }

    const currentWallet = Number(customer.wallet_balance_cache ?? 0);
    const totalAmount = Number(order.total_amount ?? 0);
    const currentAdvance = Number((order as any).advance_paid ?? 0);
    const amountToPay = Number((order as any).credit_used ?? Math.max(0, totalAmount - currentAdvance));

    if (amountToPay <= 0) {
      return res.status(400).json({ success: false, error: { message: "Outstanding balance is zero" } });
    }

    if (currentWallet < amountToPay) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Insufficient wallet balance. You have ₹${currentWallet.toFixed(0)}, but outstanding balance is ₹${amountToPay.toFixed(0)}.`,
        },
      });
    }

    const finalMethod = currentAdvance > 0 ? `${(order as any).payment_method || "credit"} + wallet` : "wallet";

    // 1. Mark order as PAID via wallet
    await updateOrder(order.id, {
      payment_status: "paid",
      payment_method: finalMethod,
      advance_paid: totalAmount,
      credit_used: 0,
      is_credit_order: false,
      updated_at: new Date().toISOString(),
    });

    // 2. Record wallet debit transaction
    await recordWalletPaymentDebit({
      customerId: customer.id,
      orderId: order.id,
      orderNumber: order.order_number,
      amount: amountToPay,
    });

    // 4. Trigger WhatsApp Paid Invoice
    if (order.invoice_url) {
      const itemsList = Array.isArray(order.items)
        ? order.items.map((it: any) => it.serviceName || it.name || "Item").join(", ")
        : "Dry Cleaning & Laundry";

      void sendPaidInvoiceWhatsApp({
        phoneNumber: req.authUser!.phone,
        customerName: order.customer_name || customer.name || "Customer",
        orderNumber: order.order_number,
        amount: amountToPay,
        invoiceUrl: order.invoice_url,
        itemsSummary: itemsList,
      });
    }

    res.json({
      success: true,
      message: `Order ${order.order_number} paid successfully with Wallet!`,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        paymentStatus: "paid",
        newWalletBalance,
      },
    });
  } catch (err: any) {
    req.log.error(err, "Failed to pay with wallet");
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/payments/webhook
 * Razorpay Webhook receiver for background/asynchronous payment events (payment.captured)
 */
router.post("/payments/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "0065ae0b8a91bad4d473dc27660d7b0b8e957b3d10cba81e52a1351e0dc71425";

    if (!signature) {
      return res.status(400).json({ status: "error", message: "Missing x-razorpay-signature header" });
    }

    const rawBody = JSON.stringify(req.body);
    const isValid = verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      req.log.warn({ signature }, "Invalid Razorpay webhook signature");
      return res.status(400).json({ status: "error", message: "Invalid webhook signature" });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === "payment.captured") {
      const payment = payload?.payment?.entity;
      const notes = payment?.notes || {};
      const amountInRupees = Number(payment?.amount || 0) / 100;
      const paymentId = payment?.id;

      if (notes.type === "WALLET_RECHARGE" && notes.customerId) {
        // Asynchronous credit fallback for wallet
        req.log.info({ customerId: notes.customerId, amount: amountInRupees, paymentId }, "Webhook: Processing wallet recharge");
        const customer = await fetchCustomerByPhone(notes.phone);
        if (customer) {
          const currentBalance = Number(customer.wallet_balance_cache ?? 0);
          const newBalance = currentBalance + amountInRupees;
          await insertWalletTransaction({
            transaction_id: `WAL-RZP-WH-${Date.now()}-${paymentId.slice(-6)}`,
            customer_id: customer.id,
            type: "credit",
            transaction_type: "CREDIT",
            amount: amountInRupees,
            balance_before: currentBalance,
            balance_after: newBalance,
            payment_method: "UPI",
            reference_type: "PAYMENT",
            reference_id: paymentId,
            note: `Webhook payment: ${paymentId}`,
          }).catch((err) => req.log.error(err, "Failed to insert webhook wallet transaction"));
          await insertTransaction({
            customer_id: customer.id,
            type: "WALLET_RECHARGE_WEBHOOK",
            amount: amountInRupees,
            payment_method: "RAZORPAY_WEBHOOK",
            status: "SUCCESS",
            notes: `Webhook payment: ${paymentId}`,
          }).catch(() => {});
        }
      }
    }

    res.json({ status: "ok" });
  } catch (err: any) {
    req.log.error(err, "Webhook processing error");
    res.status(500).json({ status: "error", message: err.message });
  }
});

export default router;
