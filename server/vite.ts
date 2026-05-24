import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { validateFilePath } from "./utils";
import { staticLimiter } from "./middleware/rateLimit";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(staticLimiter);
  app.use(vite.middlewares);

  // Catch-all: serve landing page at /, SPA at all other paths
  app.use("/{*path}", async (req, res, next) => {
    const url = (req.originalUrl ?? "/").replace(/\0/g, "");

    if (url === "/" || url === "/index.html") {
      try {
        const landingPath = path.resolve(
          import.meta.dirname, "..", "client", "index.html",
        );
        if (!validateFilePath(landingPath, path.resolve(import.meta.dirname, ".."))) {
          throw new Error("Invalid template file path");
        }
        const page = await fs.promises.readFile(landingPath, "utf-8");
        res.status(200).set({ "Content-Type": "text/html" }).end(page);
        return;
      } catch (e) {
        next(e);
        return;
      }
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "app.html",
      );

      // Validate template path for security
      if (!validateFilePath(clientTemplate, path.resolve(import.meta.dirname, ".."))) {
        throw new Error("Invalid template file path");
      }

      // always reload the app.html file from disk in case it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
