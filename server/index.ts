import "dotenv/config";

import express from "express";
import { createServer } from "http";
import { randomUUID } from "crypto";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import lusca from "lusca";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { errorHandler } from "./errorHandler";
import { requestComplete } from "./logger";

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

  // Lusca security configuration
  const luscaConfig = {
    csrf: {
      cookie: 'csrf-token',
      header: 'x-csrf-token',
      secret: process.env.CSRF_SECRET || 'default-secret-change-in-prod'
    },
    xframe: 'SAMEORIGIN',
    ...(isProduction && {
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }),
    xssProtection: true,
    nosniff: true,
    referrerPolicy: isProduction ? 'strict-origin-when-cross-origin' : 'no-referrer-when-downgrade'
  };

  // Enable CORS with specific configuration
  app.use(cors({
    origin: devCspOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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

  // Session middleware for Lusca
  app.use(session({
    secret: process.env.SESSION_SECRET || 'default-session-secret-change-in-prod',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Lusca security middleware
  app.use(lusca(luscaConfig));

  // Set CSRF token in header for client access
  app.use((req, res, next) => {
    if ((res as any).locals._csrf) {
      res.set('X-CSRF-Token', (res as any).locals._csrf);
    }
    next();
  });

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
              connectSrc: ["'self'"],
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
              connectSrc: ["'self'", devCspOrigin, devCspWsOrigin],
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

(async () => {
  const { app, httpServer } = createApp();

  await registerRoutes(httpServer, app);

  app.use(errorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
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
})();
