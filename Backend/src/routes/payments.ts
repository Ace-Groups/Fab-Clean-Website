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
  fetchOrderByIdentifier,
  updateCustomerById,
  updateOrder,
  insertTransaction,
  insertCreditTransaction,
  insertWalletTransaction,
  fetchWalletTransactions,
} from "../lib/supabase-admin.js";
import { sendPaidInvoiceWhatsApp } from "../lib/whatsapp-invoice.js";
import {
  sendMsg91PaymentSuccessEmail,
  sendMsg91PaymentFailedEmail,
} from "../lib/msg91-email.js";
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
 * GET /api/payments/pay/:identifier (or /pay/:identifier)
 * Public redirect for customer payment
 */
router.get("/pay/:identifier", async (req, res) => {
  try {
    const identifier = req.params.identifier;
    const order = await fetchOrderByIdentifier(identifier);
    if (!order) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Fab Clean - Order Not Found</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 40px 20px; background: #f9fafb;">
          <h2 style="color: #ef4444;">Order Not Found</h2>
          <p style="color: #4b5563;">We could not locate this order. Please contact Fab Clean support.</p>
        </body>
        </html>
      `);
    }

    if (order.payment_status === "paid") {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Fab Clean - Bill Already Paid</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px 20px; background: #f0fdf4;">
          <div style="max-width: 420px; margin: 0 auto; background: white; padding: 32px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #bbf7d0;">
            <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
            <h2 style="color: #15803d; margin: 0 0 8px 0;">Payment Received!</h2>
            <p style="color: #4b5563; font-size: 15px; margin: 0 0 16px 0;">Order <strong>#${order.order_number}</strong> has already been marked as PAID.</p>
            <div style="background: #f8fafc; border-radius: 8px; padding: 12px; font-size: 14px; color: #334155; margin-bottom: 20px;">
              Total Amount: <strong>₹${order.total_amount}</strong>
            </div>
            <a href="https://myfabclean.com" style="display: inline-block; background: #16a34a; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Visit Fab Clean</a>
          </div>
        </body>
        </html>
      `);
    }

    const paymentLink = (order as any).payment_link || (order as any).paymentLink;
    if (paymentLink && typeof paymentLink === "string" && paymentLink.startsWith("http")) {
      return res.redirect(302, paymentLink);
    }

    return res.redirect(302, `https://myfabclean.com/trackorder/${encodeURIComponent(order.order_number)}`);
  } catch (err: any) {
    req.log?.error(err, "Pay redirect failed");
    res.status(500).send("Unable to process payment link");
  }
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
      const customer = await fetchCustomerByPhone(req.authUser!.phone).catch(() => null);
      if (customer?.email) {
        void sendMsg91PaymentFailedEmail({
          customerEmail: customer.email,
          customerName: customer.name || "Customer",
          amount: 0,
          transactionId: razorpayPaymentId,
          orderNumber: razorpayOrderId,
          failureReason: "Payment verification signature mismatch / declined",
        });
      }

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
      const customer = await fetchCustomerByPhone(req.authUser!.phone).catch(() => null);
      if (customer?.email) {
        void sendMsg91PaymentFailedEmail({
          customerEmail: customer.email,
          customerName: customer.name || "Customer",
          amount: 0,
          transactionId: razorpayPaymentId,
          orderNumber: razorpayOrderId,
          failureReason: "Payment verification signature mismatch / declined",
        });
      }

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

    // 4. Dispatch Payment Received E-Receipt via MSG91 Email
    const customerEmail = customer?.email || (order as any).customer_email;
    if (customerEmail) {
      void sendMsg91PaymentSuccessEmail({
        customerEmail,
        customerName: order.customer_name || customer?.name || "Customer",
        amount: amountPaid,
        transactionId: razorpayPaymentId,
        orderNumber: order.order_number,
        paymentMethod: "Razorpay (Online)",
        receiptPdfUrl: order.invoice_url || undefined,
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

    const newWalletBalance = currentWallet - amountToPay;
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

    // 5. Dispatch Payment Received E-Receipt via MSG91 Email for wallet payment
    const customerEmail = customer?.email || (order as any).customer_email;
    if (customerEmail) {
      void sendMsg91PaymentSuccessEmail({
        customerEmail,
        customerName: order.customer_name || customer?.name || "Customer",
        amount: amountToPay,
        transactionId: `WAL-DEB-${Date.now()}`,
        orderNumber: order.order_number,
        paymentMethod: "Fab Clean Wallet",
        receiptPdfUrl: order.invoice_url || undefined,
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

    const event = req.body?.event;
    const payload = req.body?.payload;

    if (event === "payment.captured" || event === "payment_link.paid" || event === "order.paid") {
      const payment = payload?.payment?.entity;
      const paymentLink = payload?.payment_link?.entity;
      const orderEntity = payload?.order?.entity;

      const notes = {
        ...(paymentLink?.notes || {}),
        ...(payment?.notes || {}),
        ...(orderEntity?.notes || {}),
      };

      const amountInRupees = Number(payment?.amount || paymentLink?.amount_paid || paymentLink?.amount || 0) / 100;
      const paymentId = payment?.id || paymentLink?.id || "RAZORPAY_WEBHOOK";

      // Case A: Wallet Recharge
      if (notes.type === "WALLET_RECHARGE" && notes.customerId) {
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

      // Case B: Order Payment (Paid via Razorpay Link or QR Code)
      const targetOrderId = notes.orderId || notes.order_id;
      const targetOrderNumber = notes.orderNumber || notes.order_number;

      if (notes.type === "ORDER_PAYMENT" || targetOrderId || targetOrderNumber) {
        const identifier = targetOrderId || targetOrderNumber;
        req.log.info({ identifier, amount: amountInRupees, paymentId }, "Webhook: Processing Order Payment");

        let order = identifier ? await fetchOrderByIdentifier(identifier).catch(() => null) : null;
        if (!order && paymentLink?.description) {
          const match = paymentLink.description.match(/Order\s*#?([A-Za-z0-9-]+)/i);
          if (match && match[1]) {
            order = await fetchOrderByIdentifier(match[1]).catch(() => null);
          }
        }

        if (order) {
          const totalAmount = Number(order.total_amount ?? amountInRupees);
          const customerPhone = order.customer_phone || notes.phone || "";

          // 1. Update Order in Supabase Postgres to PAID
          await updateOrder(order.id, {
            payment_status: "paid",
            payment_method: "online_razorpay",
            advance_paid: totalAmount,
            credit_used: 0,
            is_credit_order: false,
            updated_at: new Date().toISOString(),
          });

          req.log.info({ orderNumber: order.order_number }, "✅ Webhook: Order marked as PAID in Supabase");

          // 2. Settle customer wallet & credit ledger
          if (order.customer_id && amountInRupees > 0) {
            await recordOrderPaymentCredit({
              customerId: order.customer_id,
              orderId: order.id,
              orderNumber: order.order_number,
              amountPaid: amountInRupees,
              paymentMethod: "UPI",
              referenceId: paymentId,
            }).catch((walErr) => req.log.warn(walErr, "Failed to record credit in wallet ledger"));

            await insertTransaction({
              customer_id: order.customer_id,
              order_id: order.id,
              type: "ORDER_PAYMENT",
              amount: amountInRupees,
              payment_method: "ONLINE_RAZORPAY",
              status: "SUCCESS",
              notes: `Razorpay Webhook: ${paymentId}`,
            }).catch(() => {});
          }

          // 3. Dispatch WhatsApp Paid Invoice
          if (customerPhone && order.invoice_url) {
            const itemsList = Array.isArray(order.items)
              ? order.items.map((it: any) => it.serviceName || it.name || "Item").join(", ")
              : "Dry Cleaning & Laundry";

            void sendPaidInvoiceWhatsApp({
              phoneNumber: customerPhone,
              customerName: order.customer_name || "Customer",
              orderNumber: order.order_number,
              amount: amountInRupees || totalAmount,
              invoiceUrl: order.invoice_url,
              itemsSummary: itemsList,
            });
          }

          // 4. Dispatch Payment Received E-Receipt via MSG91 Email
          const customer = customerPhone ? await fetchCustomerByPhone(customerPhone).catch(() => null) : null;
          const targetEmail = customer?.email || (order as any).customer_email;
          if (targetEmail) {
            void sendMsg91PaymentSuccessEmail({
              customerEmail: targetEmail,
              customerName: order.customer_name || customer?.name || "Customer",
              amount: amountInRupees || totalAmount,
              transactionId: paymentId,
              orderNumber: order.order_number,
              paymentMethod: "Razorpay (Online UPI/Card)",
              receiptPdfUrl: order.invoice_url || undefined,
            });
          }
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
