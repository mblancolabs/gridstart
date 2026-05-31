import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { staticLimiter } from "./middleware/rateLimit";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(`Could not find the build directory: ${distPath}, make sure to build the client first`);
  }

  // Apply rate limiting to static file requests
  app.use(staticLimiter);

  // Serve static files with security headers (includes landing page at /)
  app.use(
    express.static(distPath, {
      setHeaders: (res, _path) => {
        // Prevent MIME type sniffing
        res.setHeader("X-Content-Type-Options", "nosniff");
        // Prevent clickjacking
        res.setHeader("X-Frame-Options", "DENY");
        // Enable XSS protection
        res.setHeader("X-XSS-Protection", "1; mode=block");
      },
    }),
  );

  // Catch-all: serve landing page at /, SPA at all other paths
  app.use("/{*path}", (req, res) => {
    const url = req.originalUrl ?? "/";
    if (url === "/" || url === "/index.html") {
      res.sendFile(path.resolve(distPath, "index.html"));
    } else {
      res.sendFile(path.resolve(distPath, "app.html"));
    }
  });
}
