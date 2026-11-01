/**
 * ============================================================================
 * FAB CLEAN UNIFIED WALLET & ORDER AUTO-SETTLEMENT ENGINE
 * ============================================================================
 *
 * Business Requirements Implemented:
 * 1. Order Created on Credit:
 *    - The credit/due amount is debited from the customer's wallet ledger immediately.
 *    - Triggers in PostgreSQL automatically update `customers.wallet_balance_cache`
 *      and keep `credit_balance = abs(wallet_balance_after)` synchronized.
 *
 * 2. Order Paid in Full:
 *    - If paid via wallet, debits the full amount from the customer's wallet.
 *    - If paid online/cash upfront, records transaction accordingly.
 *
 * 3. Wallet Funded / Recharged (Automatic Settlement):
 *    - When funds enter the customer's wallet (e.g., via Razorpay recharge or top-up),
 *      the engine automatically scans all pending/unpaid/partial credit orders for
 *      that customer in FIFO order (oldest due date/created_at first).
 *    - The engine automatically debits the wallet to clear each order's remaining due.
 *    - When an order's due is 100% cleared, its status is automatically updated to 'paid',
 *      is_credit_order is set to false, credit_used set to 0, and a digital WhatsApp
 *      Paid Invoice is triggered.
 *    - EMPLOYEES DO NOT NEED TO MARK ANYTHING AS PAID SEPARATELY.
 *
 * 4. Online Individual Order Payments:
 *    - If a customer settles an individual credit order online via UPI/Razorpay,
 *      the payment is credited to the ledger, neutralizing the previous order debit.
 * ============================================================================
 */

import {
  supabaseRequest,
  insertWalletTransaction,
  insertTransaction,
  updateOrder,
  type CustomerRecord,
} from "./supabase-admin.js";
import { sendPaidInvoiceWhatsApp } from "./whatsapp-invoice.js";
import { logger } from "./logger.js";

export interface AutoSettleResult {
  settledOrders: Array<{
    orderId: string;
    orderNumber: string;
    allocatedAmount: number;
    remainingDue: number;
    fullyCleared: boolean;
  }>;
  totalAllocated: number;
  remainingWalletBalance: number;
}

/**
 * Record a debit on the customer's wallet ledger when an order is created on credit.
 * Postgres trigger `wallet_transactions_after_insert` automatically updates
 * `customers.wallet_balance_cache` and adjusts `credit_balance`.
 */
export async function recordOrderCreditDebit(params: {
  customerId: string;
  orderId: string;
  orderNumber: string;
  creditAmount: number;
  advancePaid?: number;
  paymentMethod?: string;
}): Promise<any> {
  const { customerId, orderId, orderNumber, creditAmount, advancePaid = 0, paymentMethod = "credit" } = params;

  if (!customerId || creditAmount <= 0) return null;

  try {
    const note = `[CRD] Order #${orderNumber} balance on credit (Due: ₹${creditAmount.toFixed(2)}${
      advancePaid > 0 ? `, Advance ₹${advancePaid.toFixed(2)} paid via ${paymentMethod}` : ""
    })`;

    // Insert wallet debit transaction
    const tx = await insertWalletTransaction({
      customer_id: customerId,
      type: "debit",
      transaction_type: "DEBIT",
      amount: -creditAmount,
      reference_type: "ORDER",
      reference_id: orderId,
      reference_order_id: orderId,
      payment_method: "OTHER",
      note,
    });

    logger.info(
      { customerId, orderId, orderNumber, creditAmount },
      "Successfully debited customer wallet for credit order",
    );

    return tx;
  } catch (err) {
    logger.error(
      { err, customerId, orderId, orderNumber, creditAmount },
      "Failed to record order credit debit in wallet ledger",
    );
    throw err;
  }
}

/**
 * Record a credit on the customer's wallet ledger when an online payment is received for an order.
 * This offsets the debit that was applied when the order was placed on credit.
 */
export async function recordOrderPaymentCredit(params: {
  customerId: string;
  orderId: string;
  orderNumber: string;
  amountPaid: number;
  paymentMethod?: string;
  referenceId?: string;
}): Promise<any> {
  const { customerId, orderId, orderNumber, amountPaid, paymentMethod = "UPI", referenceId } = params;

  if (!customerId || amountPaid <= 0) return null;

  try {
    const tx = await insertWalletTransaction({
      customer_id: customerId,
      type: "credit",
      transaction_type: "CREDIT",
      amount: amountPaid,
      payment_method: paymentMethod.toUpperCase().replace(/\s+/g, "_"),
      reference_type: "PAYMENT",
      reference_id: referenceId || orderId,
      reference_order_id: orderId,
      note: `Online payment received for Order #${orderNumber} (${referenceId || "UPI"})`,
    });

    logger.info(
      { customerId, orderId, orderNumber, amountPaid },
      "Recorded order payment credit in wallet ledger",
    );

    return tx;
  } catch (err) {
    logger.error(
      { err, customerId, orderId, amountPaid },
      "Failed to record order payment credit in wallet ledger",
    );
    throw err;
  }
}

/**
 * Record a direct wallet debit when an order is paid using Fab Pass / Wallet.
 */
export async function recordWalletPaymentDebit(params: {
  customerId: string;
  orderId: string;
  orderNumber: string;
  amount: number;
}): Promise<any> {
  const { customerId, orderId, orderNumber, amount } = params;

  if (!customerId || amount <= 0) return null;

  return insertWalletTransaction({
    customer_id: customerId,
    type: "debit",
    transaction_type: "DEBIT",
    amount: -amount,
    payment_method: "OTHER",
    reference_type: "ORDER",
    reference_id: orderId,
    reference_order_id: orderId,
    note: `Order #${orderNumber} paid in full via Fab Pass / Wallet`,
  });
}

/**
 * AUTO-SETTLEMENT ENGINE:
 * Automatically settles due orders from positive wallet funds in FIFO order (oldest first).
 * Automatically updates order payment status to 'paid', clears credit flags,
 * and sends WhatsApp invoices without requiring manual employee intervention.
 */
export async function autoSettleCustomerDueOrders(
  customerId: string,
  customerPhone?: string,
): Promise<AutoSettleResult> {
  const result: AutoSettleResult = {
    settledOrders: [],
    totalAllocated: 0,
    remainingWalletBalance: 0,
  };

  if (!customerId) return result;

  try {
    // 1. Fetch current customer state
    const customers = await supabaseRequest<CustomerRecord[]>(
      `/rest/v1/customers?id=eq.${encodeURIComponent(customerId)}&select=id,name,phone,wallet_balance_cache,credit_balance`,
      "GET",
    );
    const customer = customers[0];
    if (!customer) return result;

    let availableBalance = Number(customer.wallet_balance_cache ?? 0);
    if (availableBalance <= 0) {
      result.remainingWalletBalance = availableBalance;
      return result;
    }

    // 2. Fetch all unpaid or partial orders for this customer (FIFO: oldest created_at first)
    const unpaidOrders = await supabaseRequest<any[]>(
      `/rest/v1/orders?customer_id=eq.${encodeURIComponent(
        customerId,
      )}&payment_status=in.(unpaid,partial,pending,credit)&order=created_at.asc&limit=50`,
      "GET",
    );

    if (!unpaidOrders || unpaidOrders.length === 0) {
      result.remainingWalletBalance = availableBalance;
      return result;
    }

    const recipientPhone = customerPhone || customer.phone;

    // 3. Sequentially allocate available wallet funds to due orders
    for (const order of unpaidOrders) {
      if (availableBalance <= 0) break;

      const orderTotal = Number(order.total_amount ?? 0);
      const currentAdvance = Number(order.advance_paid ?? 0);
      const currentDue = Math.max(0, orderTotal - currentAdvance);

      if (currentDue <= 0) {
        // Order had 0 due already, ensure clean status
        await updateOrder(order.id, {
          payment_status: "paid",
          is_credit_order: false,
          credit_used: 0,
          updated_at: new Date().toISOString(),
        });
        continue;
      }

      // Determine allocation for this order
      const allocation = Math.min(availableBalance, currentDue);
      const newAdvance = currentAdvance + allocation;
      const remainingOrderDue = Math.max(0, orderTotal - newAdvance);
      const isFullyCleared = remainingOrderDue === 0;

      // Deduct from available balance tracker
      availableBalance -= allocation;
      result.totalAllocated += allocation;

      // 4. Record wallet debit transaction for this auto-settlement
      await insertWalletTransaction({
        customer_id: customerId,
        type: "debit",
        transaction_type: "DEBIT",
        amount: -allocation,
        payment_method: "OTHER",
        reference_type: "ORDER",
        reference_id: order.id,
        reference_order_id: order.id,
        note: `[AUTO-SETTLE] Order #${order.order_number} auto-debited ₹${allocation.toFixed(2)}${
          isFullyCleared ? " (Fully Paid)" : ` (Remaining Due: ₹${remainingOrderDue.toFixed(2)})`
        }`,
      }).catch((err) => logger.error({ err, orderId: order.id }, "Failed to insert auto-settle debit transaction"));

      // 5. Update Order in Supabase
      const existingMethod = String(order.payment_method || "credit").toLowerCase();
      let newPaymentMethod: string;
      if (isFullyCleared) {
        newPaymentMethod = currentAdvance > 0 && !existingMethod.includes("wallet")
          ? `${existingMethod} + wallet`
          : "wallet";
      } else {
        newPaymentMethod = existingMethod.includes("credit") ? existingMethod : `${existingMethod} + credit`;
      }

      const orderUpdatePayload: Record<string, unknown> = {
        advance_paid: newAdvance,
        payment_status: isFullyCleared ? "paid" : "partial",
        payment_method: newPaymentMethod,
        is_credit_order: !isFullyCleared,
        credit_used: remainingOrderDue,
        updated_at: new Date().toISOString(),
      };

      await updateOrder(order.id, orderUpdatePayload);

      // Record transaction ledger entry
      await insertTransaction({
        customer_id: customerId,
        order_id: order.id,
        type: "ORDER_PAYMENT",
        amount: allocation,
        payment_method: "WALLET",
        status: "SUCCESS",
        notes: `Auto-settled via Fab Pass / Wallet: ₹${allocation.toFixed(2)}`,
      }).catch(() => null);

      // 6. If fully cleared, send WhatsApp Paid Invoice automatically
      if (isFullyCleared && recipientPhone && order.invoice_url) {
        const itemsSummary = Array.isArray(order.items)
          ? order.items.map((it: any) => it.serviceName || it.name || "Item").join(", ")
          : "Dry Cleaning & Laundry";

        void sendPaidInvoiceWhatsApp({
          phoneNumber: recipientPhone,
          customerName: order.customer_name || customer.name || "Customer",
          orderNumber: order.order_number,
          amount: allocation,
          invoiceUrl: order.invoice_url,
          itemsSummary,
        }).catch((err) => logger.warn({ err }, "Failed to send WhatsApp auto-settle invoice"));
      }

      result.settledOrders.push({
        orderId: order.id,
        orderNumber: order.order_number,
        allocatedAmount: allocation,
        remainingDue: remainingOrderDue,
        fullyCleared: isFullyCleared,
      });

      logger.info(
        {
          orderNumber: order.order_number,
          allocated: allocation,
          remainingDue: remainingOrderDue,
          isFullyCleared,
        },
        "Auto-settled order due from customer wallet balance",
      );
    }

    result.remainingWalletBalance = availableBalance;
    return result;
  } catch (err) {
    logger.error({ err, customerId }, "Error during auto-settle customer due orders");
    return result;
  }
}

export interface UnifiedTransactionItem {
  id: string;
  title: string;
  type: "credit" | "debit";
  amount: number;
  paymentMethod: string;
  category: "recharge" | "order_payment" | "advance_payment" | "auto_settle" | "adjustment";
  date: string;
  status: "SUCCESS" | "COMPLETED" | "PENDING";
  note?: string;
  orderId?: string;
  orderNumber?: string;
  orderDetails?: {
    orderNumber: string;
    services: string[];
    items: Array<{ name: string; quantity: number; price: number; subtotal: number }>;
    totalAmount: number;
    advancePaid: number;
    dueAmount: number;
    paymentStatus: string;
    orderStatus: string;
    invoiceUrl?: string | null;
    createdAt?: string;
  };
}

function cleanPaymentMethodName(rawMethod?: string | null, note?: string | null): string {
  const m = String(rawMethod || "").toUpperCase();
  const n = String(note || "").toUpperCase();

  if (m.includes("UPI") || n.includes("UPI") || n.includes("GPAY") || n.includes("PHONEPE") || n.includes("PAYTM")) {
    return "UPI";
  }
  if (m.includes("CASH") || n.includes("CASH")) {
    return "Cash";
  }
  if (m.includes("WALLET") || m.includes("PASS") || n.includes("FAB PASS")) {
    return "Fab Pass";
  }
  if (m.includes("CARD")) {
    return "Card";
  }
  if (m.includes("NET_BANKING") || m.includes("NETBANKING")) {
    return "Net Banking";
  }
  if (m.includes("CREDIT")) {
    return "Credit Account";
  }
  if (n.includes("RAZORPAY")) {
    return "UPI / Online";
  }
  return "Online Payment";
}

/**
 * UNIFIED CUSTOMER TRANSACTION HISTORY
 * Aggregates all user financial events across:
 * - Wallet Recharges
 * - Order Advance Payments (Cash / UPI)
 * - Order Settlements / Online Payments
 * - Direct Wallet Debits
 * - Auto-Settlements
 *
 * Removes Razorpay mentions in favor of clean payment modes (UPI, Cash, Fab Pass).
 * Enriches every transaction with order details, item breakdown, and invoice download link.
 */
export async function fetchUnifiedCustomerTransactions(
  customerId: string,
  customerPhone: string,
): Promise<UnifiedTransactionItem[]> {
  const unified: UnifiedTransactionItem[] = [];
  const seenKeys = new Set<string>();

  try {
    // 1. Fetch wallet transactions and orders concurrently
    const [walletTxs, orders] = await Promise.all([
      supabaseRequest<any[]>(
        `/rest/v1/wallet_transactions?customer_id=eq.${encodeURIComponent(
          customerId,
        )}&order=created_at.desc&limit=50`,
        "GET",
      ).catch(() => []),
      supabaseRequest<any[]>(
        `/rest/v1/orders?customer_id=eq.${encodeURIComponent(customerId)}&order=created_at.desc&limit=50`,
        "GET",
      ).catch(() => []),
    ]);

    // Build order lookup map
    const orderMap = new Map<string, any>();
    for (const o of orders) {
      if (o.id) orderMap.set(o.id, o);
      if (o.order_number) orderMap.set(o.order_number, o);
    }

    function buildOrderDetails(order: any) {
      if (!order) return undefined;
      const total = Number(order.total_amount ?? 0);
      const advance = Number(order.advance_paid ?? 0);
      const items = Array.isArray(order.items)
        ? order.items.map((it: any) => ({
            name: it.serviceName || it.name || "Garment Service",
            quantity: Number(it.quantity || 1),
            price: Number(it.price || it.unitPrice || 0),
            subtotal: Number(it.subtotal || it.total || (Number(it.quantity || 1) * Number(it.price || 0))),
          }))
        : [];
      const services = items.length > 0
        ? items.map((it) => it.name)
        : ["Dry Cleaning & Laundry"];

      return {
        orderNumber: order.order_number,
        services,
        items,
        totalAmount: total,
        advancePaid: advance,
        dueAmount: Math.max(0, total - advance),
        paymentStatus: order.payment_status || "paid",
        orderStatus: order.status || "booked",
        invoiceUrl: order.invoice_url || null,
        createdAt: order.created_at,
      };
    }

    // 2. Process Wallet Transactions
    for (const wt of walletTxs) {
      const amt = Number(wt.amount || 0);
      const isCredit = amt > 0;
      const linkedOrderId = wt.reference_order_id || wt.reference_id;
      const linkedOrder = linkedOrderId ? orderMap.get(linkedOrderId) : null;
      const noteStr = String(wt.note || "");

      let category: UnifiedTransactionItem["category"] = "adjustment";
      let title = isCredit ? "Pass Recharge" : "Payment";

      if (noteStr.includes("AUTO-SETTLE")) {
        category = "auto_settle";
        title = linkedOrder ? `Auto-Settled #${linkedOrder.order_number}` : "Order Auto-Settled";
      } else if (linkedOrder || wt.reference_type === "ORDER") {
        category = "order_payment";
        title = linkedOrder ? `Order #${linkedOrder.order_number}` : "Order Payment";
      } else if (isCredit && (wt.reference_type === "PAYMENT" || noteStr.includes("recharge"))) {
        category = "recharge";
        title = "Fab Pass Recharge";
      }

      const method = cleanPaymentMethodName(wt.payment_method, wt.note);
      const dedupeKey = `wt-${wt.id || wt.transaction_id || `${wt.created_at}-${amt}`}`;

      if (!seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        unified.push({
          id: wt.id || `tx-${Date.now()}-${Math.random()}`,
          title,
          type: isCredit ? "credit" : "debit",
          amount: Math.abs(amt),
          paymentMethod: method,
          category,
          date: wt.created_at || new Date().toISOString(),
          status: "SUCCESS",
          note: noteStr.replace(/Razorpay Payment ID:\s*/i, "Ref: "),
          orderId: linkedOrder?.id,
          orderNumber: linkedOrder?.order_number,
          orderDetails: buildOrderDetails(linkedOrder),
        });
      }
    }

    // 3. Process Orders for Advance & Full Payments
    for (const o of orders) {
      const total = Number(o.total_amount ?? 0);
      const advance = Number(o.advance_paid ?? 0);
      const methodStr = String(o.payment_method || "credit").toLowerCase();

      // If an advance was paid (Cash or UPI)
      if (advance > 0) {
        const advMethod = cleanPaymentMethodName(o.payment_method);
        const dedupeKey = `ord-adv-${o.id}-${advance}`;

        if (!seenKeys.has(dedupeKey)) {
          seenKeys.add(dedupeKey);
          unified.push({
            id: `adv-${o.id}`,
            title: `Advance Payment (#${o.order_number})`,
            type: "debit",
            amount: advance,
            paymentMethod: advMethod,
            category: "advance_payment",
            date: o.created_at,
            status: "SUCCESS",
            note: `Advance ₹${advance.toFixed(0)} paid via ${advMethod}`,
            orderId: o.id,
            orderNumber: o.order_number,
            orderDetails: buildOrderDetails(o),
          });
        }
      }

      // If fully paid online and not covered by advance alone
      if (o.payment_status === "paid" && total > advance && (methodStr.includes("online") || methodStr.includes("upi"))) {
        const remainingSettled = total - advance;
        const dedupeKey = `ord-settle-${o.id}-${remainingSettled}`;

        if (!seenKeys.has(dedupeKey)) {
          seenKeys.add(dedupeKey);
          unified.push({
            id: `pay-${o.id}`,
            title: `Order Settlement (#${o.order_number})`,
            type: "debit",
            amount: remainingSettled,
            paymentMethod: "UPI",
            category: "order_payment",
            date: o.updated_at || o.created_at,
            status: "SUCCESS",
            note: `Online payment cleared for #${o.order_number}`,
            orderId: o.id,
            orderNumber: o.order_number,
            orderDetails: buildOrderDetails(o),
          });
        }
      }
    }

    // Sort by date descending (newest first)
    unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return unified;
  } catch (err) {
    logger.error({ err, customerId }, "Failed to fetch unified customer transactions");
    return unified;
  }
}
