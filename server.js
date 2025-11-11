/**
 * 🚌 Bus Transport Project — Production Ready
 * Full Backend + Frontend Server (Railway Deployment)
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import https from "https";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { getDistance, getDistanceFromLine } from "geolib";

dotenv.config();
const app = express();
const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Environment ---
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || "dev-secret";
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";
const SEARCH_RADIUS_KM = parseFloat(process.env.SEARCH_RADIUS_KM || "1.5");
const MAIN_ADMIN_EMAIL = process.env.MAIN_ADMIN_EMAIL || "";
const MAIN_ADMIN_PASSWORD = process.env.MAIN_ADMIN_PASSWORD || "";

// --- Security Middleware ---
app.use(
  helmet({
    contentSecurityPolicy: isProduction ? undefined : false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// Rate limiting
app.use(
  "/api/",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 100 : 1000,
    message: "Too many requests from this IP, please try again later.",
  })
);

// --- Serve Static Frontend ---
app.use(express.static(path.join(__dirname, "public")));

// --- Logger ---
const log = (...args) => {
  if (!isProduction) console.log("[INFO]", ...args);
};

// --- Authentication Middleware ---
function requireAdmin(req, res, next) {
  const token =
    req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null;
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

// --- Utilities ---
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validateCoordinates(lat, lng) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// --- Google Maps Geocode Helper ---
async function geocodeLocation(name) {
  if (!GOOGLE_MAPS_API_KEY) throw new Error("Google API key missing");
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    name
  )}&key=${GOOGLE_MAPS_API_KEY}`;
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const j = JSON.parse(data);
            if (j.status === "OK" && j.results[0]) {
              const loc = j.results[0].geometry.location;
              resolve({ lat: loc.lat, lng: loc.lng });
            } else reject("Geocode failed");
          } catch {
            reject("Invalid JSON");
          }
        });
      })
      .on("error", reject);
  });
}

// --- Path Intersection Check ---
function isPathIntersectsCircle(userLocation, path, radiusMeters) {
  const center = { latitude: userLocation.lat, longitude: userLocation.lng };
  for (const p of path) {
    const d = getDistance(
      { latitude: p.lat, longitude: p.lng },
      { latitude: center.latitude, longitude: center.longitude }
    );
    if (d <= radiusMeters) return true;
  }
  for (let i = 0; i < path.length - 1; i++) {
    const a = { latitude: path[i].lat, longitude: path[i].lng };
    const b = { latitude: path[i + 1].lat, longitude: path[i + 1].lng };
    if (getDistanceFromLine(center, a, b) <= radiusMeters) return true;
  }
  return false;
}

// --- Availability Finder ---
async function findNearbyBuses(userLocation, radiusKm = SEARCH_RADIUS_KM) {
  const radiusMeters = radiusKm * 1000;
  const buses = await prisma.bus.findMany({ include: { stops: true } });
  const results = [];

  for (const bus of buses) {
    const morningStops = bus.stops
      .filter((s) => s.period === "MORNING")
      .sort((a, b) => a.order - b.order);
    const eveningStops = bus.stops
      .filter((s) => s.period === "EVENING")
      .sort((a, b) => a.order - b.order);

    const checkStops = (stops) =>
      stops.some((s) => {
        const d = getDistance(
          { latitude: userLocation.lat, longitude: userLocation.lng },
          { latitude: s.lat, longitude: s.lng }
        );
        return d <= radiusMeters;
      });

    if (checkStops(morningStops) || checkStops(eveningStops)) {
      results.push({
        busNumber: bus.number,
        busName: bus.name,
        location: bus.location,
      });
    }
  }
  return results;
}

/* =====================================================
   🧠  API ROUTES
===================================================== */

// ✅ Health check
app.get("/api/health", (req, res) =>
  res.json({
    success: true,
    message: "Bus Transport API running",
    environment: NODE_ENV,
  })
);

// ✅ Admin login
app.post("/api/admin/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res
      .status(400)
      .json({ success: false, message: "Email and password required" });

  if (email === MAIN_ADMIN_EMAIL && password === MAIN_ADMIN_PASSWORD) {
    const token = jwt.sign({ role: "superadmin", email }, JWT_SECRET, {
      expiresIn: "8h",
    });
    return res.json({ success: true, token });
  }

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin || !bcrypt.compareSync(password, admin.password))
    return res
      .status(401)
      .json({ success: false, message: "Invalid credentials" });

  const token = jwt.sign({ role: "admin", email }, JWT_SECRET, {
    expiresIn: "8h",
  });
  res.json({ success: true, token });
});

// ✅ Bus availability
app.post("/api/check-availability", async (req, res) => {
  try {
    const { email, location } = req.body;
    if (!email || !location)
      return res
        .status(400)
        .json({ success: false, message: "Email and location required" });
    if (!validateEmail(email))
      return res
        .status(400)
        .json({ success: false, message: "Invalid email format" });

    let userLocation;
    const match = location.match(/^\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\s*$/);
    if (match) {
      userLocation = { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    } else {
      userLocation = await geocodeLocation(location);
    }

    if (!validateCoordinates(userLocation.lat, userLocation.lng))
      return res
        .status(400)
        .json({ success: false, message: "Invalid coordinates" });

    const nearby = await findNearbyBuses(userLocation, SEARCH_RADIUS_KM);

    await prisma.availabilityLog.create({
      data: {
        email,
        location,
        lat: userLocation.lat,
        lng: userLocation.lng,
        status: nearby.length > 0 ? "AVAILABLE" : "UNAVAILABLE",
      },
    });

    if (nearby.length === 0)
      return res.json({
        success: true,
        available: false,
        message:
          "Within 1.5 km radius, no college bus route passes your location.",
      });

    res.json({
      success: true,
      available: true,
      count: nearby.length,
      buses: nearby,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

/* =====================================================
   🌐 FRONTEND ROUTES
===================================================== */

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "page.html"))
);
app.get("/admin", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin.html"))
);
app.get("/admin-dashboard", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin-dashboard.html"))
);
app.get("/admin-signup", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin-signup.html"))
);

// --- 404 Handler ---
app.use((req, res) => {
  if (req.path.startsWith("/api/"))
    res.status(404).json({ success: false, message: "Route not found" });
  else
    res
      .status(404)
      .send("<h2>404 – Page Not Found</h2><a href='/'>Go Home</a>");
});

/* =====================================================
   🚀 START SERVER
===================================================== */
app.listen(PORT, () => {
  log(`✅ Bus Transport API live on port ${PORT}`);
  if (!isProduction)
    console.log(`📍 Visit http://localhost:${PORT}/api/health`);
});
