import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

const COOKIE_NAME = "csrf-token";
const HEADER_NAME = "x-csrf-token";

function getSecret(): string {
  return process.env.CSRF_SECRET || "fallback-csrf-secret-change-in-prod";
}

function generateToken(secret: string): { nonce: string; hmac: string } {
  const nonce = crypto.randomBytes(32).toString("hex");
  const hmac = crypto.createHmac("sha256", secret).update(nonce).digest("hex");
  return { nonce, hmac };
}

function validateToken(secret: string, token: string): boolean {
  const parts = token.split("|");
  if (parts.length !== 2) return false;
  const [nonce, hmac] = parts;
  const expectedHmac = crypto.createHmac("sha256", secret).update(nonce).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedHmac, "hex"), Buffer.from(hmac, "hex"));
  } catch {
    return false;
  }
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const secret = getSecret();

  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const { nonce, hmac } = generateToken(secret);
    const token = `${nonce}|${hmac}`;

    res.cookie(COOKIE_NAME, token, {
      httpOnly: false,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    res.setHeader(HEADER_NAME, token);
    return next();
  }

  const cookieToken = req.cookies?.[COOKIE_NAME];
  const headerToken = req.headers[HEADER_NAME.toLowerCase()] as string | undefined;

  if (!cookieToken || !headerToken) {
    res.status(403).json({ error: "Missing CSRF token" });
    return;
  }

  if (cookieToken !== headerToken) {
    res.status(403).json({ error: "CSRF token mismatch" });
    return;
  }

  if (!validateToken(secret, cookieToken)) {
    res.status(403).json({ error: "Invalid CSRF token" });
    return;
  }

  next();
}
