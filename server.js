import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import geolib from "geolib";
import crypto from "crypto";
import jwt from "jsonwebtoken";

dotenv.config();
const app = express();

// Trust the Railway proxy so express-rate-limit and req.ip use X-Forwarded-For correctly
// Use numeric value if you know there is a single proxy (1) or `true` for trust all proxies.
app.set('trust proxy', 1);

const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// JSON parse error handler — return JSON error instead of HTML
app.use((err, req, res, next) => {
  if (err && (err instanceof SyntaxError || err.type === 'entity.parse.failed')) {
    console.error("Invalid JSON body:", err.message);
    return res.status(400).json({ success: false, message: "Invalid JSON body" });
  }
  next(err);
});

app.use(express.static("public"));

// Ensure Prisma connects at startup and disconnects gracefully on shutdown
(async () => {
  try {
    await prisma.$connect();
    console.log("✅ Prisma connected");
  } catch (e) {
    console.error("Prisma connect error:", e);
  }
})();

process.on("SIGINT", async () => {
  console.log("SIGINT received, disconnecting Prisma...");
  try { await prisma.$disconnect(); } catch(_) {}
  process.exit(0);
});
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, disconnecting Prisma...");
  try { await prisma.$disconnect(); } catch(_) {}
  process.exit(0);
});

// Health
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Bus Transport API running", environment: process.env.NODE_ENV || "development" });
});

// GET all routes
app.get("/api/routes", async (req, res) => {
  try {
    const buses = await prisma.bus.findMany({ include: { stops: true } });
    if (!buses || buses.length === 0) return res.status(404).json({ success: false, message: "No buses found" });

    const routes = buses.map((bus) => {
      const morningStops = (bus.stops || []).filter(s => s.period === "MORNING").sort((a,b)=>a.order-b.order);
      const eveningStops = (bus.stops || []).filter(s => s.period === "EVENING").sort((a,b)=>a.order-b.order);
      return {
        id: bus.id,
        number: bus.number,
        name: bus.name,
        location: bus.location,
        capacity: bus.capacity,
        currentOccupancy: bus.currentOccupancy,
        driverName: bus.driverName,
        driverPhone: bus.driverPhone,
        liveLocationUrl: bus.liveLocationUrl,
        morningRoute: {
          from: morningStops[0]?.name || "N/A",
          to: morningStops[morningStops.length - 1]?.name || "N/A",
          stops: morningStops.map(s => ({ name: s.name, coords: { lat: s.lat, lng: s.lng } })),
        },
        eveningRoute: {
          from: eveningStops[0]?.name || "N/A",
          to: eveningStops[eveningStops.length - 1]?.name || "N/A",
          stops: eveningStops.map(s => ({ name: s.name, coords: { lat: s.lat, lng: s.lng } })),
        },
      };
    });

    res.json({ success: true, routes });
  } catch (err) {
    console.error("Error /api/routes:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET single route
app.get("/api/routes/:busNumber", async (req, res) => {
  try {
    const { busNumber } = req.params;
    const bus = await prisma.bus.findUnique({ where: { number: String(busNumber) }, include: { stops: true } });
    if (!bus) return res.status(404).json({ success: false, message: "Bus not found" });

    const morningStops = (bus.stops || []).filter(s => s.period === "MORNING").sort((a,b)=>a.order-b.order);
    const eveningStops = (bus.stops || []).filter(s => s.period === "EVENING").sort((a,b)=>a.order-b.order);

    const transformed = {
      id: bus.id, number: bus.number, name: bus.name, location: bus.location,
      capacity: bus.capacity, currentOccupancy: bus.currentOccupancy,
      driverName: bus.driverName, driverPhone: bus.driverPhone, liveLocationUrl: bus.liveLocationUrl,
      morningRoute: { from: morningStops[0]?.name || "N/A", to: morningStops[morningStops.length - 1]?.name || "N/A", stops: morningStops.map(s=>({ name: s.name, coords: { lat: s.lat, lng: s.lng } })) },
      eveningRoute: { from: eveningStops[0]?.name || "N/A", to: eveningStops[eveningStops.length - 1]?.name || "N/A", stops: eveningStops.map(s=>({ name: s.name, coords: { lat: s.lat, lng: s.lng } })) },
    };

    res.json({ success: true, bus: transformed });
  } catch (err) {
    console.error("Error /api/routes/:busNumber:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// POST check-availability
app.post("/api/check-availability", async (req, res) => {
  try {
    const { email, location } = req.body || {};
    if (!email || !location) return res.status(400).json({ success: false, message: "Missing email or location" });

    const radiusKm = Number(process.env.SEARCH_RADIUS_KM || 1.5);
    const radiusMeters = radiusKm * 1000;
    let userCoords = null;

    if (typeof location === "string" && location.includes(",")) {
      const [lat, lng] = location.split(",").map(s => Number(s.trim()));
      if (!isNaN(lat) && !isNaN(lng)) userCoords = { latitude: lat, longitude: lng };
    }

    const stops = await prisma.stop.findMany({ include: { bus: true } });
    const matched = new Map();

    if (userCoords) {
      for (const s of stops) {
        const stopCoords = { latitude: s.lat, longitude: s.lng };
        const d = geolib.getDistance(userCoords, stopCoords);
        if (d <= radiusMeters) matched.set(String(s.bus.number), { bus: s.bus, distanceMeters: d });
      }
    } else {
      const q = String(location).toLowerCase();
      for (const s of stops) {
        if ((s.name && s.name.toLowerCase().includes(q)) || (s.bus?.location && s.bus.location.toLowerCase().includes(q))) {
          matched.set(String(s.bus.number), { bus: s.bus, distanceMeters: null });
        }
      }
    }

    const buses = Array.from(matched.values()).map(x => ({ busNumber: x.bus.number, distanceMeters: x.distanceMeters, capacity: x.bus.capacity, currentOccupancy: x.bus.currentOccupancy }));
    const available = buses.some(b => Number(b.capacity || 0) > Number(b.currentOccupancy || 0));

    // log if model exists
    try {
      if (prisma.availabilityLog) {
        await prisma.availabilityLog.create({ data: { email, location: String(location).slice(0,200), status: available ? "AVAILABLE" : "UNAVAILABLE", lat: userCoords?.latitude || null, lng: userCoords?.longitude || null } });
      }
    } catch (_) { /* non fatal */ }

    res.json({ success: true, available, buses });
  } catch (err) {
    console.error("Error /api/check-availability:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Settings
app.get("/api/settings", (req, res) => {
  res.json({ success: true, settings: { siteTitle: "BUS TRANSPORT DETAILS", contact: { address: "VR Siddhartha Engineering College, Vijayawada", phone: "+91 98765 43210", email: "support@vrsecbus.in" } } });
});

/* ---------------- Admin helpers & endpoints (must be BEFORE 404) ---------------- */

// --- JWT-based admin tokens (replace in-memory sessions) ---
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.ADMIN_PASSWORD || "dev_admin_secret";
function createAdminToken(email) {
  // 2 hour expiry
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: "2h" });
}
function verifyAdminToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET); // returns payload { email, iat, exp }
  } catch (e) {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.query.token || null);
  if (!token) return res.status(401).json({ success: false, message: "Missing token" });
  const payload = verifyAdminToken(token);
  if (!payload) return res.status(401).json({ success: false, message: "Invalid or expired token" });
  req.adminEmail = payload.email;
  next();
}

// Update POST /admin/login to return JWT (keep existing credential checks)
app.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, message: "Missing credentials" });

    const ENV_EMAIL = process.env.ADMIN_EMAIL;
    const ENV_PASS = process.env.ADMIN_PASSWORD;
    if (ENV_EMAIL && ENV_PASS) {
      if (email === ENV_EMAIL && password === ENV_PASS) {
        const token = createAdminToken(email);
        return res.json({ success: true, token });
      } else {
        return res.status(401).json({ success: false, message: "Invalid admin credentials" });
      }
    }

    // fallback to DB admin
    try {
      const admin = await prisma.admin?.findUnique({ where: { email } });
      if (!admin) return res.status(401).json({ success: false, message: "Admin not found" });
      // If you store hashed passwords, use bcrypt.compare here
      if (admin.password !== password) return res.status(401).json({ success: false, message: "Invalid password" });
      const token = createAdminToken(email);
      return res.json({ success: true, token });
    } catch (e) {
      console.warn("Prisma admin lookup failed:", e.message || e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Update GET /admin/me to verify JWT
app.get("/admin/me", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.query.token || null);
  if (!token) return res.status(401).json({ success: false, message: "Missing token" });
  const payload = verifyAdminToken(token);
  if (!payload) return res.status(401).json({ success: false, message: "Invalid or expired token" });
  res.json({ success: true, email: payload.email });
});

// Example protected bus update endpoints (minimal)
app.patch("/api/buses/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = req.body || {};
    const updated = await prisma.bus.update({ where: { id }, data });
    res.json({ success: true, bus: updated });
  } catch (err) {
    console.error("Error PATCH /api/buses/:id", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.put("/api/buses/:id/stops", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const stops = Array.isArray(req.body) ? req.body : [];
    // naive replace: delete existing stops for bus, then create new
    await prisma.stop.deleteMany({ where: { busId: id } });
    const created = [];
    for (const s of stops) {
      const c = await prisma.stop.create({ data: { busId: id, name: s.name || "", lat: s.lat || 0, lng: s.lng || 0, period: s.period || "MORNING", order: s.order || 0 } });
      created.push(c);
    }
    res.json({ success: true, stops: created });
  } catch (err) {
    console.error("Error PUT /api/buses/:id/stops", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ---------------- 404 catch-all and server start (last) ---------------- */
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));