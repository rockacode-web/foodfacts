import express from "express";
import cors from "cors";
import multer from "multer";
import { getRequiredEnv, loadEnv } from "./config/env.js";
import { createAuthRouter } from "./routes/authRoutes.js";
import { createIntakeRouter } from "./routes/intakeRoutes.js";
import { createProfileRouter } from "./routes/profileRoutes.js";
import { createScanRouter } from "./routes/scanRoutes.js";
import { prisma } from "./utils/prisma.js";

loadEnv();

const app = express();
const port = Number(process.env.PORT || 8080);
const configuredOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  "http://localhost:5173",
  "https://foodfacts-web-nu.vercel.app",
  ...configuredOrigins
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.get("/api/health-check", (_req, res) => {
  res.json({ status: "ok", scanMethod: "openai-vision" });
});
app.get("/", (req, res) => {
  res.json({
    message: "Food Label Scanner API is running"
  });
});

app.use("/api/auth", createAuthRouter());
app.use("/api/profile", createProfileRouter());
app.use("/api/scans", createScanRouter(upload));
app.use("/api/intake", createIntakeRouter());

app.use((err, _req, res, _next) => {
  console.error("[backend-node] Unhandled error:", err);
  res.status(500).json({
    status: "error",
    message: "Internal server error."
  });
});

async function startServer() {
  getRequiredEnv("DATABASE_URL");
  getRequiredEnv("JWT_SECRET");

  await prisma.$connect();
  app.listen(port, () => {
    console.log(`[backend-node] Listening on http://localhost:${port}`);
  });
}

async function shutdown(signal) {
  try {
    await prisma.$disconnect();
  } finally {
    process.exit(signal ? 0 : 1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

startServer().catch((error) => {
  console.error("[backend-node] Failed to start:", error);
  void shutdown();
});
