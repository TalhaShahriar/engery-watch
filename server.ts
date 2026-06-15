import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import apiRouter from "./src/routes/api.ts";
import { startTelemetrySchedulers } from "./src/services/energyPoller.ts";
import { startScheduleRunner } from "./src/services/scheduleRunner.ts";

// Load local environment config
dotenv.config();

async function bootstrap() {
  const app = express();
  const PORT = 3000;

  // JSON request body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Create standard HTTP server and configure Socket.IO
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Client connection handler
  io.on("connection", (socket) => {
    console.log(`Socket connection incoming: ${socket.id}`);

    // Join room grouped by User Firebase UID for isolated secure message streaming
    socket.on("join-room", (userId: string) => {
      if (userId) {
        socket.join(userId);
        console.log(`Socket client ${socket.id} locked into room channel: ${userId}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket client disconnected: ${socket.id}`);
    });
  });

  // Mount primary application REST routes
  app.use("/api", apiRouter);

  // Health probe endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      node_env: process.env.NODE_ENV || "development",
    });
  });

  // Start background schedulers
  startTelemetrySchedulers(io);
  startScheduleRunner(io);

  // Configure Client Asset Delivery / Vite Hot Middleware
  if (process.env.NODE_ENV !== "production") {
    // Mount Vite dev server middleware to support client-side hot reloading in dev
    const viteInstance = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(viteInstance.middlewares);
    console.log("Vite development server middleware mounted.");
  } else {
    // Statics delivery in production mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static build files from dist/ folder.");
  }

  // Bind to 0.0.0.0 and port 3000 to enable container port forwarding
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[EnergyWatch BD Startup] Production server operating cleanly at http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Critical: Express master server crashed on bootstrap:", err);
  process.exit(1);
});
