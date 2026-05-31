import "dotenv/config";

import express from "express";
import { createServer } from "http";
import { randomUUID } from "crypto";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { errorHandler } from "./errorHandler";
import { requestComplete } from "./logger";
import { csrfProtection } from "./csrf";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function createApp() {
  const app = express();
  const httpServer = createServer(app);

  const isProduction = process.env.NODE_ENV === "production";
  const devCspOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const devCspWsOrigin = process.env.DEV_CSP_WS_ORIGIN || devCspOrigin.replace(/^https?:/, 'ws:');

  // Enable CORS with specific configuration
  app.use(cors({
    origin: devCspOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
    credentials: false,
    maxAge: 86400,
  }));

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));

  app.use(cookieParser());

  // Stateless double-submit cookie CSRF protection
  app.use(csrfProtection);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: isProduction
          ? {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "https://api.fontshare.com"],
              fontSrc: ["'self'", "https://api.fontshare.com", "https://cdn.fontshare.com"],
              imgSrc: ["'self'", "data:"],
              connectSrc: ["'self'", "https://api.fontshare.com"],
              workerSrc: ["'self'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
            }
          : {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", devCspOrigin],
              styleSrc: ["'self'", "'unsafe-inline'", "https://api.fontshare.com"],
              fontSrc: ["'self'", "https://api.fontshare.com", "https://cdn.fontshare.com"],
              imgSrc: ["'self'", "data:"],
              connectSrc: ["'self'", "https://api.fontshare.com", devCspOrigin, devCspWsOrigin],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
            },
      },
    }),
  );

  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.set("X-Request-Id", req.requestId);
    next();
  });

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        requestComplete(req.requestId ?? "unknown", res.statusCode, duration, capturedJsonResponse);
      }
    });

    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return { app, httpServer };
}

export function log(message: string, source = "gridstart") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function startServer() {
  const { app, httpServer } = createApp();

  await registerRoutes(httpServer, app);

  app.use(errorHandler);

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
}

const isMainModule = process.argv[1] && (
  typeof require !== "undefined"
    ? require.main === module
    : import.meta.url === `file://${process.argv[1]}`
);

if (isMainModule) {
  startServer();
}
