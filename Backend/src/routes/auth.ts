import { Router, type IRouter, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable, erpCustomers } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { normalizePhone, requireAuth } from "../lib/auth.js";

type OtpSession = {
  id: string;
  phone: string;
  otp: string;
  expires: number;
  attempts: number;
};

type SessionUser = {
  id: string;
  phone: string;
  customerId?: string;
  name?: string;
  email?: string;
  createdAt?: string;
  avatar?: string;
  hasCompletedOnboarding?: boolean;
  tierPoints: number;
  tier: "fresh";
  referralCode: string;
  weekStreak: number;
  walletBalance: number;
};

const router: IRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET;
let ACTUAL_JWT_SECRET = JWT_SECRET;

if (!ACTUAL_JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.warn("⚠️ WARNING: JWT_SECRET environment variable is missing! Generating a random temporary secret. Note: Users will be logged out on every server restart until you set a persistent JWT_SECRET in your environment.");
    ACTUAL_JWT_SECRET = crypto.randomBytes(32).toString("hex");
  } else {
    ACTUAL_JWT_SECRET = "fab-clean-dev-secret-2025";
  }
}

const AUTH_SECRET = ACTUAL_JWT_SECRET ?? "fab-clean-dev-secret-2025";

const otpSessions = new Map<string, OtpSession>();
const latestOtpSessionByPhone = new Map<string, string>();
const lastOtpRequest = new Map<string, number>();

const OTP_EXPIRY_SEC = 600;
const OTP_RESEND_COOLDOWN_SEC = 30;
const ACCESS_TOKEN_TTL = "1h";
const REFRESH_TOKEN_TTL = "30d";

function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function createOtpSession(phone: string, otp: string): OtpSession {
  const id = crypto.randomUUID();
  return {
    id,
    phone,
    otp,
    expires: Date.now() + OTP_EXPIRY_SEC * 1000,
    attempts: 0,
  };
}

function toSessionUser(user: { id: string; phone: string; customerId: string | null; name: string | null; email: string | null; createdAt: Date }): SessionUser {
  return {
    id: user.id,
    phone: user.phone,
    customerId: user.customerId ?? undefined,
    name: user.name ?? undefined,
    email: user.email ?? undefined,
    createdAt: user.createdAt.toISOString(),
    avatar: undefined,
    hasCompletedOnboarding: false,
    tierPoints: 0,
    tier: "fresh",
    referralCode: user.id.replace(/-/g, "").slice(0, 8).toUpperCase(),
    weekStreak: 0,
    walletBalance: 0,
  };
}

function issueAccessToken(user: { id: string; phone: string; customerId: string | null }): string {
  return jwt.sign(
    { userId: user.id, phone: user.phone, customerId: user.customerId ?? undefined },
    AUTH_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL },
  );
}

function issueRefreshToken(userId: string): string {
  return jwt.sign(
    { userId },
    AUTH_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL },
  );
}

function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function resolveOtpSession(phoneRaw?: unknown, sessionIdRaw?: unknown): { phone: string; session?: OtpSession } {
  const normalizedPhone = typeof phoneRaw === "string" ? normalizePhone(phoneRaw) : "";
  const sessionId = typeof sessionIdRaw === "string" ? sessionIdRaw : "";

  if (sessionId) {
    const session = otpSessions.get(sessionId);
    if (session) {
      return { phone: session.phone, session };
    }
  }

  if (normalizedPhone) {
    const latestSessionId = latestOtpSessionByPhone.get(normalizedPhone);
    if (latestSessionId) {
      const session = otpSessions.get(latestSessionId);
      if (session) {
        return { phone: normalizedPhone, session };
      }
    }
    return { phone: normalizedPhone };
  }

  return { phone: "" };
}

router.post("/auth/send-otp", async (req, res) => {
  const rawPhone = req.body?.phone;
  const phone = typeof rawPhone === "string" ? normalizePhone(rawPhone) : "";

  if (!phone) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Phone number is required" },
    });
    return;
  }

  const lastRequest = lastOtpRequest.get(phone);
  if (lastRequest && Date.now() - lastRequest < OTP_RESEND_COOLDOWN_SEC * 1000) {
    res.status(429).json({
      success: false,
      error: { code: "TOO_MANY_REQUESTS", message: "Please wait 30 seconds before requesting another OTP" },
    });
    return;
  }
  lastOtpRequest.set(phone, Date.now());

  try {
    const authKey = process.env.MSG91_AUTH_KEY;

    if (!authKey) {
      req.log.warn("MSG91 configuration is missing. OTP not sent.");
      res.status(500).json({
        success: false,
        error: { code: "SERVER_ERROR", message: "OTP service is not configured properly." },
      });
      return;
    }

    const otp = generateOtp();
    const session = createOtpSession(phone, otp);
    otpSessions.set(session.id, session);
    latestOtpSessionByPhone.set(phone, session.id);

    const whatsappIntegratedNumber = process.env.MSG91_WHATSAPP_NUMBER || "15559458542";
    const whatsappTemplateName = process.env.MSG91_WHATSAPP_TEMPLATE_NAME || "verification_code_template";
    const whatsappNamespace = process.env.MSG91_WHATSAPP_NAMESPACE || "5b9c340a_3221_42e3_9b9f_98b402c0c8ac";

    const rawPayload = JSON.stringify({
      integrated_number: whatsappIntegratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: whatsappTemplateName,
          language: {
            code: "en",
            policy: "deterministic",
          },
          namespace: whatsappNamespace,
          to_and_components: [
            {
              to: [
                `91${phone}`,
              ],
              components: {
                body_1: {
                  type: "text",
                  value: otp,
                },
                button_1: {
                  subtype: "url",
                  type: "text",
                  value: otp,
                },
              },
            },
          ],
        },
      },
    });

    const response = await fetch("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: rawPayload,
    });

    const responseData = await response.text();
    req.log.info({
      phone: phone.slice(-4),
      status: response.status,
      response: responseData,
      otp: process.env.NODE_ENV === "development" ? otp : "****",
    }, "Direct WhatsApp OTP Request Sent");

    if (!response.ok) {
      throw new Error(`MSG91 API error: ${response.status} ${responseData}`);
    }

    const payload = {
      sessionId: session.id,
      method: "whatsapp" as const,
      message: "OTP sent successfully.",
      expiresInSec: OTP_EXPIRY_SEC,
      resendCooldownSec: OTP_RESEND_COOLDOWN_SEC,
      expiresIn: OTP_EXPIRY_SEC,
    };

    res.json({
      success: true,
      data: payload,
      ...payload,
    });
  } catch (error) {
    req.log.error({ phone: phone.slice(-4), error }, "Failed to send OTP");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to send OTP. Please try again." },
    });
  }
});

router.post("/auth/verify-otp", async (req, res) => {
  const { otp, phone: rawPhone, sessionId } = req.body ?? {};

  if (!otp || (typeof otp !== "string")) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "OTP is required" },
    });
    return;
  }

  const resolved = resolveOtpSession(rawPhone, sessionId);
  const phone = resolved.phone;
  const session = resolved.session;

  if (!phone) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Phone or sessionId is required" },
    });
    return;
  }

  try {
    if (!session) {
      res.status(400).json({
        success: false,
        error: { code: "RETRY_REQUIRED", message: "OTP expired or not requested. Please request a new one." },
      });
      return;
    }

    if (Date.now() > session.expires) {
      otpSessions.delete(session.id);
      if (latestOtpSessionByPhone.get(phone) === session.id) {
        latestOtpSessionByPhone.delete(phone);
      }
      res.status(400).json({
        success: false,
        error: { code: "EXPIRED_OTP", message: "OTP has expired. Please request a new one." },
      });
      return;
    }

    if (session.otp !== otp) {
      session.attempts += 1;
      if (session.attempts >= 3) {
        otpSessions.delete(session.id);
        if (latestOtpSessionByPhone.get(phone) === session.id) {
          latestOtpSessionByPhone.delete(phone);
        }
      }
      res.status(400).json({
        success: false,
        error: { code: "INVALID_OTP", message: "Invalid OTP code." },
      });
      return;
    }

    otpSessions.delete(session.id);
    if (latestOtpSessionByPhone.get(phone) === session.id) {
      latestOtpSessionByPhone.delete(phone);
    }

    let user = await db.query.usersTable.findFirst({
      where: eq(usersTable.phone, phone),
    });

    const isNewUser = !user;
    let erpLinked = false;

    if (!user) {
      const erpCustomer = await db.query.erpCustomers.findFirst({
        where: sql`normalize_phone_e164(${erpCustomers.phone}) = normalize_phone_e164(${phone})`,
      });

      const [created] = await db
        .insert(usersTable)
        .values({
          phone,
          customerId: erpCustomer?.id || null,
          name: erpCustomer?.name || null,
          email: erpCustomer?.email || null,
        })
        .returning();
      user = created;
      erpLinked = Boolean(erpCustomer?.id);
    } else if (!user.customerId) {
      const erpCustomer = await db.query.erpCustomers.findFirst({
        where: sql`normalize_phone_e164(${erpCustomers.phone}) = normalize_phone_e164(${phone})`,
      });
      if (erpCustomer) {
        await db.update(usersTable)
          .set({
            customerId: erpCustomer.id,
            name: user.name || erpCustomer.name,
            email: user.email || erpCustomer.email,
          })
          .where(eq(usersTable.id, user.id));
        user.customerId = erpCustomer.id;
        erpLinked = true;
      }
    } else {
      erpLinked = true;
    }

    const accessToken = issueAccessToken(user);
    const refreshToken = issueRefreshToken(user.id);

    setRefreshCookie(res, refreshToken);

    const sessionUser = toSessionUser(user);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        token: accessToken,
        isNewUser,
        erpLinked,
        user: sessionUser,
      },
      accessToken,
      refreshToken,
      token: accessToken,
      isNewUser,
      erpLinked,
      user: sessionUser,
    });
  } catch (err) {
    req.log.error(err, "Auth error");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Authentication failed" },
    });
  }
});

router.post("/auth/refresh", async (req, res) => {
  const bodyRefreshToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;
  const cookieRefreshToken = typeof req.cookies?.refresh_token === "string" ? req.cookies.refresh_token : undefined;
  const token = bodyRefreshToken || cookieRefreshToken;

  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "No refresh token" },
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, AUTH_SECRET) as { userId: string };
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, decoded.userId),
    });

    if (!user) {
      throw new Error("User not found");
    }

    const accessToken = issueAccessToken(user);
    const refreshToken = issueRefreshToken(user.id);

    if (cookieRefreshToken) {
      setRefreshCookie(res, refreshToken);
    }

    res.json({
      success: true,
      data: { accessToken, refreshToken },
      accessToken,
      refreshToken,
    });
  } catch (_err) {
    res.clearCookie("refresh_token");
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid or expired refresh token" },
    });
  }
});

router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, req.authUser!.userId),
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      });
      return;
    }

    const profile = toSessionUser(user);
    res.json({
      success: true,
      data: profile,
      ...profile,
    });
  } catch (err) {
    req.log.error(err, "Failed to load auth profile");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to load profile" },
    });
  }
});

router.patch("/auth/me", requireAuth, async (req, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : undefined;
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : undefined;

    const [updatedUser] = await db
      .update(usersTable)
      .set({
        ...(name !== undefined ? { name: name || null } : {}),
        ...(email !== undefined ? { email: email || null } : {}),
      })
      .where(eq(usersTable.id, req.authUser!.userId))
      .returning();

    if (!updatedUser) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      });
      return;
    }

    const profile = toSessionUser(updatedUser);
    res.json({
      success: true,
      data: profile,
      ...profile,
    });
  } catch (err) {
    req.log.error(err, "Failed to update auth profile");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to update profile" },
    });
  }
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie("refresh_token");
  res.json({ success: true, message: "Logged out successfully" });
});

/**
 * Public widget config for MSG91 OTP widget.
 * AuthKey never leaves the server — only widgetId + tokenAuth (widget public credentials).
 */
router.get("/auth/otp-widget-config", (_req, res) => {
  const widgetId = process.env.MSG91_WIDGET_ID || process.env.VITE_MSG91_WIDGET_ID || "";
  const tokenAuth =
    process.env.MSG91_OTP_VERIFICATION_TOKEN ||
    process.env.VITE_MSG91_TOKEN_AUTH ||
    process.env.MSG91_TOKEN_AUTH ||
    "";

  if (!widgetId || !tokenAuth) {
    res.status(503).json({
      success: false,
      error: { code: "NOT_CONFIGURED", message: "OTP widget is not configured" },
    });
    return;
  }

  res.json({
    success: true,
    data: { widgetId, tokenAuth },
    widgetId,
    tokenAuth,
  });
});

/**
 * Verify MSG91 widget access-token, then issue Fab Clean session JWTs.
 */
router.post("/auth/verify-widget", async (req, res) => {
  const accessTokenRaw =
    req.body?.accessToken ??
    req.body?.["access-token"] ??
    req.body?.token ??
    req.body?.message;
  const accessToken = typeof accessTokenRaw === "string" ? accessTokenRaw.trim() : "";
  const phone = typeof req.body?.phone === "string" ? normalizePhone(req.body.phone) : "";

  if (!accessToken) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Widget access token is required" },
    });
    return;
  }

  const authKey = process.env.MSG91_AUTH_KEY;
  if (!authKey) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "OTP service is not configured properly." },
    });
    return;
  }

  try {
    const verifyResponse = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify({
        authkey: authKey,
        "access-token": accessToken,
      }),
    });

    const verifyText = await verifyResponse.text();
    let verifyJson: Record<string, unknown> = {};
    try {
      verifyJson = JSON.parse(verifyText) as Record<string, unknown>;
    } catch {
      verifyJson = {};
    }

    const verifyOk =
      verifyResponse.ok &&
      (verifyJson.type === "success" ||
        verifyJson.message === "success" ||
        verifyJson.status === "success" ||
        Number(verifyJson.type) === 200 ||
        verifyJson.hasOwnProperty("request_id") ||
        String(verifyJson.type || "").toLowerCase() === "success");

    // MSG91 returns various shapes; treat HTTP 200 with no explicit error as success.
    const explicitError =
      verifyJson.type === "error" ||
      verifyJson.status === "error" ||
      (typeof verifyJson.message === "string" && /invalid|fail|expire/i.test(verifyJson.message) && verifyJson.type !== "success");

    if (!verifyResponse.ok || explicitError || (!verifyOk && verifyJson.type && verifyJson.type !== "success")) {
      req.log.warn({ status: verifyResponse.status, body: verifyText.slice(0, 500) }, "MSG91 widget token verify failed");
      res.status(401).json({
        success: false,
        error: { code: "INVALID_TOKEN", message: "OTP verification failed. Please try again." },
      });
      return;
    }

    // Prefer phone from client (normalized). Fallback to MSG91 payload if present.
    const msg91PhoneRaw =
      (verifyJson as { data?: { mobile?: string; phone?: string } }).data?.mobile ||
      (verifyJson as { data?: { phone?: string } }).data?.phone ||
      (verifyJson as { mobile?: string }).mobile ||
      "";
    const msg91Phone = typeof msg91PhoneRaw === "string" ? normalizePhone(msg91PhoneRaw.replace(/^91/, "")) : "";
    const resolvedPhone = phone || msg91Phone;

    if (!resolvedPhone) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Phone number is required after OTP verification" },
      });
      return;
    }

    let user = await db.query.usersTable.findFirst({
      where: eq(usersTable.phone, resolvedPhone),
    });

    const isNewUser = !user;
    let erpLinked = false;

    if (!user) {
      const erpCustomer = await db.query.erpCustomers.findFirst({
        where: sql`normalize_phone_e164(${erpCustomers.phone}) = normalize_phone_e164(${resolvedPhone})`,
      });

      const [created] = await db
        .insert(usersTable)
        .values({
          phone: resolvedPhone,
          customerId: erpCustomer?.id || null,
          name: erpCustomer?.name || null,
          email: erpCustomer?.email || null,
        })
        .returning();
      user = created;
      erpLinked = Boolean(erpCustomer?.id);
    } else if (!user.customerId) {
      const erpCustomer = await db.query.erpCustomers.findFirst({
        where: sql`normalize_phone_e164(${erpCustomers.phone}) = normalize_phone_e164(${resolvedPhone})`,
      });
      if (erpCustomer) {
        await db.update(usersTable)
          .set({
            customerId: erpCustomer.id,
            name: user.name || erpCustomer.name,
            email: user.email || erpCustomer.email,
          })
          .where(eq(usersTable.id, user.id));
        user.customerId = erpCustomer.id;
        erpLinked = true;
      }
    } else {
      erpLinked = true;
    }

    const accessJwt = issueAccessToken(user);
    const refreshToken = issueRefreshToken(user.id);
    setRefreshCookie(res, refreshToken);
    const sessionUser = toSessionUser(user);

    res.json({
      success: true,
      data: {
        accessToken: accessJwt,
        refreshToken,
        token: accessJwt,
        isNewUser,
        erpLinked,
        user: sessionUser,
      },
      accessToken: accessJwt,
      refreshToken,
      token: accessJwt,
      isNewUser,
      erpLinked,
      user: sessionUser,
    });
  } catch (err) {
    req.log.error(err, "Widget auth error");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Authentication failed" },
    });
  }
});

export default router;
