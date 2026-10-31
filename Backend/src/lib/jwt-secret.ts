import crypto from "node:crypto";

/**
 * Single source of truth for JWT signing/verification across auth routes + requireAuth.
 */
function resolveJwtSecret(): string {
  if (process.env.JWT_SECRET?.trim()) {
    return process.env.JWT_SECRET.trim();
  }
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "JWT_SECRET missing — using ephemeral secret (sessions reset on restart). Set JWT_SECRET on Cloud Run.",
    );
    return crypto.randomBytes(32).toString("hex");
  }
  return "fab-clean-dev-secret-2025";
}

export const AUTH_JWT_SECRET = resolveJwtSecret();
