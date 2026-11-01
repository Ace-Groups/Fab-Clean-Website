import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";

export const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || "fab-clean-jwt-production-secret-2026-suleeshwaranpatti";

export type AuthenticatedUser = {
  userId: string;
  phone?: string;
  customerId?: string;
  type?: string;
  role?: string;
  employeeId?: string;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(-10);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
    return;
  }

  try {
    const token = header.slice("Bearer ".length);
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET) as any;
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        // Cryptographically verify token signature ignoring expiration claim
        payload = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as any;
        // Allow session token valid for up to 90 days from issued time
        const issuedAtSec = payload.iat || 0;
        const nowSec = Math.floor(Date.now() / 1000);
        if (issuedAtSec > 0 && nowSec - issuedAtSec > 90 * 24 * 60 * 60) {
          throw err;
        }
      } else {
        throw err;
      }
    }

    const id = payload.id || payload.userId || payload.sub;
    if (!id) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid session token" },
      });
      return;
    }

    req.authUser = {
      userId: id,
      phone: payload.phone ? normalizePhone(payload.phone) : undefined,
      customerId: payload.customerId,
      type: payload.type || (payload.role ? "employee" : "user"),
      role: payload.role,
      employeeId: payload.employeeId,
    };
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Session expired or invalid" },
    });
  }
}
