import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// Simple CSRF protection without sessions
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

// Generate a random CSRF token
function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Middleware to set CSRF token in cookie and response headers
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Get existing token from cookie or generate new one
  let token = req.cookies[CSRF_COOKIE_NAME];
  if (!token) {
    token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
  }

  // Attach token to request for use in routes
  (req as any).csrfToken = () => token;

  // Set token in response header for client access
  res.set('X-CSRF-Token', token);
  next();
};

// Middleware to validate CSRF token for state-changing requests
export const validateCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  // Skip validation for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const tokenFromCookie = req.cookies[CSRF_COOKIE_NAME];
  const tokenFromHeader = req.headers[CSRF_HEADER_NAME] as string;

  if (!tokenFromCookie || !tokenFromHeader || tokenFromCookie !== tokenFromHeader) {
    return res.status(403).json({
      error: 'CSRF token validation failed',
      message: 'Invalid or missing CSRF token'
    });
  }

  next();
};

// Error handler for CSRF validation failures (kept for compatibility)
export const handleCsrfError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code === 'EBADCSRFTOKEN') {
    res.status(403).json({
      error: 'CSRF token validation failed',
      message: 'Invalid or missing CSRF token'
    });
    return;
  }
  next(err);
};

// Set CSRF token in response headers (for compatibility)
export const setCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  // Token is already set in csrfProtection middleware
  next();
};