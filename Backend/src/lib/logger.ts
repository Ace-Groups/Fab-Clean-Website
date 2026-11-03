import pino from "pino";
import pretty from "pino-pretty";

const isProduction = process.env.NODE_ENV === "production";

const baseOptions = {
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
};

// Use a sync pretty stream in development. Worker-based `transport: { target }`
// crashes on newer Node (thread-stream: "this should not happen: undefined").
export const logger = isProduction
  ? pino(baseOptions)
  : pino(baseOptions, pretty({ colorize: true, sync: true }));
