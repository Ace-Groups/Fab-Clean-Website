/**
 * Upload public assets to Cloudflare R2 (Ace-Digital / Fab Clean).
 * Uses Cloudflare API token (no AWS SDK required).
 */

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || "";
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || "";
const BUCKET = process.env.R2_BUCKET || "fab-clean-assets";
const PUBLIC_BASE =
  process.env.R2_PUBLIC_BASE_URL ||
  "https://pub-c99d2656ac73471b81644c90647ebd30.r2.dev";

export function isR2Configured(): boolean {
  return Boolean(ACCOUNT_ID && API_TOKEN && BUCKET);
}

export function publicObjectUrl(key: string): string {
  return `${PUBLIC_BASE.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

/** Encode each path segment; keep `/` literal (R2 API requirement). */
function objectPath(key: string): string {
  return key
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export async function uploadPublicObject(key: string, body: Buffer, contentType: string): Promise<string> {
  if (!isR2Configured()) {
    throw new Error("Cloudflare R2 is not configured");
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/objects/${objectPath(key)}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": contentType,
      "Content-Length": String(body.byteLength),
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`R2 upload failed (${response.status}): ${text.slice(0, 200)}`);
  }

  return publicObjectUrl(key);
}

export function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) {
    throw new Error("Invalid image data");
  }
  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > 500_000) {
    throw new Error("Image is too large");
  }
  return { buffer, contentType };
}
