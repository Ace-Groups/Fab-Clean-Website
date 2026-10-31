import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import cookieParser from "cookie-parser";

import helmet from "helmet";
import rateLimit from "express-rate-limit";

const DEFAULT_CORS_ORIGINS = [
  "https://myfabclean.com",
  "https://www.myfabclean.com",
  "https://app.myfabclean.com",
  "https://fab-clean-website.web.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function resolveCorsOrigins(): string[] {
  const fromEnv = process.env.CORS_ORIGINS?.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return fromEnv?.length ? fromEnv : DEFAULT_CORS_ORIGINS;
}

const app: Express = express();

// Trust the first proxy (Render load balancer) so rate limiting works per user IP
app.set("trust proxy", 1);

// Security middleware
app.use(helmet());

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "fab-clean-backend",
  });
});

// General API rate limiting — very generous limit to prevent frontend blocks
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "development" ? 100000 : 2000, 
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.headers["x-forwarded-for"]?.toString() || "anonymous";
  },
  message: { success: false, error: { code: "TOO_MANY_REQUESTS", message: "Too many requests. Please try again in a few minutes." } },
  skip: () => process.env.NODE_ENV === "development",
});
app.use("/api", generalLimiter);

// Strict rate limiting for auth endpoints only (OTP abuse prevention)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "development" ? 100000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.headers["x-forwarded-for"]?.toString() || "anonymous";
  },
  message: { success: false, error: { code: "TOO_MANY_REQUESTS", message: "Too many login attempts. Please wait a few minutes before trying again." } },
  skip: () => process.env.NODE_ENV === "development",
});
app.use("/api/auth", authLimiter);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const corsOrigins = resolveCorsOrigins();
app.use(
  cors({
    origin(origin, callback) {
      // Same-origin or server-to-server (no Origin header)
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, origin ?? corsOrigins[0]);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Global Error Handler to prevent stack trace leaks
import { NextFunction, Request, Response } from "express";

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error(err, "Unhandled API Exception");
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred while processing your request. Please try again later.",
    },
  });
});

export default app;
