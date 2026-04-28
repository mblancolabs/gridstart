import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { staticLimiter } from "./middleware/rateLimit";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Apply rate limiting to static file requests
  app.use(staticLimiter);

  // Serve static files with security headers
  app.use(express.static(distPath, {
    setHeaders: (res, path) => {
      // Prevent MIME type sniffing
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Prevent clickjacking
      res.setHeader('X-Frame-Options', 'DENY');
      // Enable XSS protection
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }
  }));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
