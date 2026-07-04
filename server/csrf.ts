import type { Context, Next } from "hono";

const COOKIE_NAME = "csrf-token";
const HEADER_NAME = "x-csrf-token";

function getSecret(): string {
  const secret = process.env.CSRF_SECRET;
  if (!secret) {
    throw new Error("CSRF_SECRET environment variable is not set");
  }
  return secret;
}

async function generateToken(secret: string): Promise<{ nonce: string; hmac: string }> {
  const nonceBytes = new Uint8Array(32);
  crypto.getRandomValues(nonceBytes);
  const nonce = Array.from(nonceBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(nonce));
  const hmac = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { nonce, hmac };
}

async function validateToken(secret: string, token: string): Promise<boolean> {
  const parts = token.split("|");
  if (parts.length !== 2) return false;
  const [nonce, hmac] = parts;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(nonce));
  const expectedHmac = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const hmacBuf = new TextEncoder().encode(hmac);
  const expectedBuf = new TextEncoder().encode(expectedHmac);
  if (hmacBuf.byteLength !== expectedBuf.byteLength) return false;
  let result = 0;
  for (let i = 0; i < hmacBuf.byteLength; i++) {
    result |= hmacBuf[i] ^ expectedBuf[i];
  }
  return result === 0;
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

export async function csrfProtection(c: Context, next: Next): Promise<Response | void> {
  const secret = getSecret();
  const method = c.req.method;

  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    const { nonce, hmac } = await generateToken(secret);
    const token = `${nonce}|${hmac}`;

    c.res.headers.set("Set-Cookie", `${COOKIE_NAME}=${token}; Path=/; SameSite=Strict; HttpOnly=false; ${process.env.NODE_ENV === "production" ? "Secure;" : ""}`);
    c.res.headers.set(HEADER_NAME, token);
    return next();
  }

  const cookies = parseCookies(c.req.header("Cookie") || null);
  const cookieToken = cookies[COOKIE_NAME];
  const headerToken = c.req.header(HEADER_NAME);

  if (!cookieToken || !headerToken) {
    c.status(403);
    return c.json({ error: "Missing CSRF token" });
  }

  if (cookieToken !== headerToken) {
    c.status(403);
    return c.json({ error: "CSRF token mismatch" });
  }

  const valid = await validateToken(secret, cookieToken);
  if (!valid) {
    c.status(403);
    return c.json({ error: "Invalid CSRF token" });
  }

  return next();
}
