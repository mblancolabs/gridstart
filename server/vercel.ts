import { createServer } from "http";
import { createApp } from "./index";
import { registerRoutes } from "./routes";
import { errorHandler } from "./errorHandler";

const { app } = createApp();
const httpServer = createServer(app);
await registerRoutes(httpServer, app);
app.use(errorHandler);

export default app;
