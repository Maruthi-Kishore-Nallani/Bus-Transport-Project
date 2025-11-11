/**
 * 🚍 Bus Transport Project — Unified Backend + Frontend Server
 * Works on Railway | Serves APIs and HTML files
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs";
import https from "https";
import { getDistance, getDistanceFromLine } from "geolib";

dotenv.config();

const app = express();
const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || "dev-secret";
const MAIN_ADMIN_EMAIL = process.env.MAIN_ADMIN_EMAIL || "";
const MAIN_ADMIN_PASSWORD = process.env.MAIN_ADMIN_PASSWORD || "";

/* ============================
   🔒 SECURITY CONFIGURATION
============================ */
app.use(
  helmet({
    contentSecurityPolicy: isProduction ? undefined : false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rate limiting
app.use(
  "/api/",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 100 : 1000,
    message: "Too many requests, try again later.",
  })
);

/* ============================
   🗂 STATIC FILE SERVING
============================ */
// ✅ Serve HTML, CSS, JS from /public
app.use(express.static(path.join(__dirname, "public")));

/* ============================
   🧠 SIMPLE LOGGER
============================ */
const log = (...args) => {
  if (!isProduction) console.log("[INFO]", ...args);
};

/* ============================
   👨‍💻 AUTH HELPERS
============================ */
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token)
    return res.status(401).json({ success: false, message: "Missing token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
}

/* ============================
   🚌 API ROUTES
============================ */

// ✅ Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Bus API is running",
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ✅ Admin Login
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, message: "Email & password required" });

    // Superadmin from .env
    if (email === MAIN_ADMIN_EMAIL && password === MAIN_ADMIN_PASSWORD) {
      const token = jwt.sign(
        { role: "superadmin", email },
        JWT_SECRET,
        { expiresIn: "8h" }
      );
      return res.json({ success: true, token });
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin || !bcrypt.compareSync(password, admin.password))
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });

    const token = jwt.sign(
      { role: "admin", email: admin.email },
      JWT_SECRET,
      { expiresIn: "8h" }
    );
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ✅ Get All Buses
app.get("/api/admin/buses", requireAdmin, async (req, res) => {
  try {
    const buses = await prisma.bus.findMany({
      include: { stops: { orderBy: { order: "asc" } } },
    });
    res.json({ success: true, buses });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to fetch buses" });
  }
});

// ✅ Check Availability (Simplified for Testing)
app.post("/api/check-availability", async (req, res) => {
  const { location } = req.body;
  if (!location)
    return res
      .status(400)
      .json({ success: false, message: "Location required" });

  res.json({
    success: true,
    available: true,
    message: "Mock success — backend live",
    location,
  });
});

/* ============================
   🌐 ROOT + FRONTEND ROUTES
============================ */

// ✅ Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "page.html"));
});

// ✅ Admin Pages
app.get("/admin", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin.html"))
);
app.get("/admin-dashboard", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin-dashboard.html"))
);
app.get("/admin-signup", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin-signup.html"))
);

/* ============================
   ❌ FALLBACK HANDLERS
============================ */
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ success: false, message: "Route not found" });
  } else {
    res
      .status(404)
      .send("<h2>404 - Page Not Found</h2><a href='/'>Go Home</a>");
  }
});

/* ============================
   🚀 START SERVER
============================ */
app.listen(PORT, () => {
  log(`✅ Server running on port ${PORT}`);
  if (!isProduction)
    console.log(`📍 Visit: http://localhost:${PORT}/api/health`);
});
