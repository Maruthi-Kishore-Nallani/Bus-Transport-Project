/*
 * Bus Transport - Backend API
 * 
 * BUS AVAILABILITY CHECKER WORKFLOW:
 * ===================================
 * 
 * STEP 1: Input Processing
 *   - Receives location input (place name or coordinates like "16.5062,80.6480")
 *   - If coordinates: uses directly
 *   - If place name: proceeds to STEP 2
 * 
 * STEP 2: Geocoding
 *   - Converts place name to geocodes (lat, lng)
 *   - Uses Google Geocoding API with caching
 *   - Example: "Vijayawada Railway Station" → {lat: 16.5062, lng: 80.6480}
 * 
 * STEP 3: Draw Circle
 *   - Creates a circle with 1.5km radius centered at user location
 *   - Radius: 1500 meters (configurable via SEARCH_RADIUS_KM)
 * 
 * STEP 4: Generate Route Paths
 *   - For each bus in database:
 *     * Loads all stops for morning and evening routes
 *     * Generates route path as array of points using Google Directions API
 *     * Route is encoded as polyline: [{lat, lng}, {lat, lng}, ...]
 *     * Falls back to straight-line between stops if API unavailable
 * 
 * STEP 5: Check Intersection
 *   - For each route path (array of points):
 *     * Checks if any point falls within the 1.5km circle
 *     * Checks if any route segment crosses the circle boundary
 *     * Uses geolib's getDistanceFromLine for accurate segment distance calculation
 * 
 * STEP 6: Return Results
 *   - Returns all buses whose routes intersect the circle
 *   - Includes: bus number, name, nearby stops, etc.
 * 
 * KEY FEATURES:
 * - Routes are pre-stored in database with stops
 * - Route paths are dynamically generated using Google Directions
 * - Intersection uses both point-in-circle and segment-crossing checks
 * - Comprehensive logging for debugging
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { getDistance, isPointWithinRadius, getDistanceFromLine } = require('geolib');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-secret-change-me';
const MAIN_ADMIN_EMAIL = process.env.MAIN_ADMIN_EMAIL || '';
const MAIN_ADMIN_PASSWORD = process.env.MAIN_ADMIN_PASSWORD || '';
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ---- Simple settings storage (JSON file) ----
const SETTINGS_PATH = path.join(__dirname, 'settings.json');
const DEFAULT_SETTINGS = {
  siteTitle: 'BUS TRANSPORT DETAILS',
  organizationName: 'Your Institution',
  contact: { address: 'Address line', phone: '+91 00000 00000', email: 'support@example.com' }
};

function readSettingsFile() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed, contact: { ...DEFAULT_SETTINGS.contact, ...(parsed.contact || {}) } };
    }
  } catch (e) {
    console.error('Failed to read settings file, using defaults:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

function writeSettingsFile(settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to write settings file:', e);
    return false;
  }
}

let siteSettings = readSettingsFile();

// Public settings
app.get('/api/settings', (req, res) => {
  res.json({ success: true, settings: siteSettings });
});

// Protected update settings
app.put('/api/admin/settings', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: 'Missing token' });
  try {
    const payload = require('jsonwebtoken').verify(token, JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('Not admin');
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
  const { siteTitle, organizationName, contact } = req.body || {};
  const next = {
    siteTitle: (siteTitle ?? siteSettings.siteTitle ?? DEFAULT_SETTINGS.siteTitle).toString(),
    organizationName: (organizationName ?? siteSettings.organizationName ?? DEFAULT_SETTINGS.organizationName).toString(),
    contact: {
      address: (contact?.address ?? siteSettings.contact.address ?? DEFAULT_SETTINGS.contact.address).toString(),
      phone: (contact?.phone ?? siteSettings.contact.phone ?? DEFAULT_SETTINGS.contact.phone).toString(),
      email: (contact?.email ?? siteSettings.contact.email ?? DEFAULT_SETTINGS.contact.email).toString()
    }
  };
  siteSettings = next;
  if (!writeSettingsFile(siteSettings)) {
    return res.status(500).json({ success: false, message: 'Failed to persist settings' });
  }
  res.json({ success: true, settings: siteSettings });
});

// --- Enhanced geocode + routing + intersection helpers ---

const DEFAULT_RADIUS_KM = parseFloat(process.env.SEARCH_RADIUS_KM) || 1.5; // STEP 3: Radius in km (1.5km = 1500 meters)
const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || null;
const geocodeCache = new Map();
const reverseGeocodeCache = new Map();

/**
 * STEP 2: Geocode a place name -> { lat, lng, formatted_address }
 * Converts location name (e.g., "Vijayawada Railway Station") to coordinates
 * Uses Google Geocoding if GOOGLE_MAPS_API_KEY is set, else throws.
 * Results are cached to reduce API calls.
 */
async function geocodeLocation(locationName) {
  if (!locationName || typeof locationName !== 'string') throw new Error('Invalid location for geocoding');
  const key = locationName.trim().toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key);

  if (!GOOGLE_MAPS_KEY) {
    throw new Error('Google Maps API key not configured');
  }

  const q = encodeURIComponent(locationName);
  const country = process.env.GEOCODE_COUNTRY || '';
  const region = process.env.GEOCODE_REGION || '';
  let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${GOOGLE_MAPS_KEY}`;
  if (country) url += `&components=country:${country}`;
  if (region) url += `&region=${region}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          if (j.status === 'OK' && j.results && j.results[0]) {
            const loc = j.results[0].geometry.location;
            const out = { lat: loc.lat, lng: loc.lng, formatted_address: j.results[0].formatted_address };
            geocodeCache.set(key, out);
            resolve(out);
          } else {
            reject(new Error(`Geocode failed: ${j.status || 'NO_RESULTS'}`));
          }
        } catch (err) { reject(err); }
      });
    }).on('error', reject);
  });
}

/**
 * Reverse geocode coordinates -> place name (formatted address)
 * Caches results to minimize API calls.
 */
async function reverseGeocode(lat, lng) {
  const key = `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
  if (reverseGeocodeCache.has(key)) return reverseGeocodeCache.get(key);
  if (!GOOGLE_MAPS_KEY) throw new Error('Google Maps API key not configured');
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lng}`)}&key=${GOOGLE_MAPS_KEY}`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          if (j.status === 'OK' && j.results && j.results[0]) {
            const addr = j.results[0].formatted_address;
            reverseGeocodeCache.set(key, addr);
            resolve(addr);
          } else {
            resolve(null);
          }
        } catch (e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Decode Google's polyline string -> [{lat, lng}, ...]
 */
function decodePolyline(encoded) {
  if (!encoded) return [];
  let index = 0, lat = 0, lng = 0, coords = [];
  while (index < encoded.length) {
    let shift = 0, result = 0, b;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    coords.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
  }
  return coords;
}

/**
 * STEP 4: Generate route path as array of MINI POINTS
 * Creates a route polyline (array of {lat,lng}) between origin and destination with optional waypoints.
 * Uses Google Directions API to generate actual road paths with MANY intermediate points.
 * 
 * CRITICAL: This function returns HUNDREDS of mini points along the route, not just the bus stops!
 * The Google Directions API polyline contains every curve and turn of the actual road.
 * 
 * If Google Directions fails or key missing, returns straight-line sequence through supplied points.
 * This encoded route array is then checked against the 1.5km circle for intersection.
 * 
 * @param {Object} origin - {lat, lng} or Stop-like object
 * @param {Object} destination - {lat, lng} or Stop-like object
 * @param {Array} waypoints - Array of intermediate points
 * @returns {Array} Array of {lat, lng} points representing the FULL ROUTE (many mini points)
 */
async function getRoutePath(origin, destination, waypoints = []) {
  const o = origin.coords ? origin.coords : { lat: origin.lat, lng: origin.lng };
  const d = destination.coords ? destination.coords : { lat: destination.lat, lng: destination.lng };
  const wpList = (waypoints || []).map(w => w.coords ? w.coords : { lat: w.lat, lng: w.lng });

  // Fallback straight-line path if no API key
  if (!GOOGLE_MAPS_KEY) {
    return [o, ...wpList, d].map(p => ({ lat: +p.lat, lng: +p.lng }));
  }

  const originStr = `${o.lat},${o.lng}`;
  const destStr = `${d.lat},${d.lng}`;
  const wpStr = wpList.map(p => `${p.lat},${p.lng}`).join('|');

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}&key=${GOOGLE_MAPS_KEY}&mode=driving${wpStr ? `&waypoints=${encodeURIComponent(wpStr)}` : ''}`;

  return new Promise((resolve) => {
    https.get(url, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
                     if (j.status === 'OK' && j.routes && j.routes[0] && j.routes[0].overview_polyline) {
             // Decode the polyline which contains HUNDREDS of mini points along the route
             const decoded = decodePolyline(j.routes[0].overview_polyline.points);
             return resolve(decoded);
           }
         } catch (e) {
           // Silent fallback
         }
         // fallback to raw points (just bus stops)
        resolve([o, ...wpList, d].map(p => ({ lat: +p.lat, lng: +p.lng })));
      });
    }).on('error', () => {
      resolve([o, ...wpList, d].map(p => ({ lat: +p.lat, lng: +p.lng })));
    });
  });
}

/**
 * STEP 5: Check if route path intersects the circle
 * Determines whether a polyline (array of route points) intersects a circle
 * centered at userLocation with given radius (in meters).
 * 
 * CRITICAL: The path parameter contains HUNDREDS of mini points from the Google Directions API.
 * This function checks EVERY mini point and EVERY segment between points.
 * It's NOT just checking bus stops - it's checking the ENTIRE ROUTE!
 * 
 * Algorithm:
 * 1. Check if ANY of the hundreds of mini points is within the circle
 * 2. Check if ANY segment (between consecutive mini points) crosses the circle boundary
 * 
 * @param {Object} userLocation - {lat, lng} center of the circle
 * @param {Array} path - Array of {lat, lng} points representing the FULL ROUTE (many mini points)
 * @param {Number} radiusMeters - Radius of the circle in meters (typically 1500 for 1.5km)
 * @returns {Boolean} True if ANY point or segment of the path intersects the circle
 */
function isPathIntersectsCircle(userLocation, path, radiusMeters) {
  if (!path || path.length === 0) return false;
  const center = { latitude: userLocation.lat, longitude: userLocation.lng };

  // Check if ANY mini point is inside circle -> intersects
  for (const p of path) {
    const d = getDistance({ latitude: p.lat, longitude: p.lng }, center);
    if (d <= radiusMeters) return true;
  }

  // Check each segment between mini points crosses the circle
  for (let i = 0; i < path.length - 1; i++) {
    const a = { latitude: path[i].lat, longitude: path[i].lng };
    const b = { latitude: path[i + 1].lat, longitude: path[i + 1].lng };
    const distToSegment = getDistanceFromLine(center, a, b); // meters
    if (distToSegment <= radiusMeters) return true;
  }

  return false;
}

/**
 * Main helper: find buses whose route intersects a circle of radiusKm around userLocation.
 * Returns array of bus objects with nearby stop count and basic metadata.
 * 
 * Workflow:
 * 1. Takes input location (place name or coordinates)
 * 2. Converts to geocodes if needed
 * 3. Draws 1.5km radius circle from that point
 * 4. Checks if bus route (encoded as array of points) intersects the circle
 * 5. Returns buses with intersecting routes
 */
 async function findNearbyBusesDb(userLocation, radiusKm = DEFAULT_RADIUS_KM) {
   const radiusMeters = radiusKm * 1000;
   const buses = await prisma.bus.findMany({ include: { stops: true } });
   const results = [];

  for (const b of buses) {
    // build ordered morning & evening stops from database
    const morningStops = b.stops.filter(s => s.period === 'MORNING').sort((x, y) => x.order - y.order);
    const eveningStops = b.stops.filter(s => s.period === 'EVENING').sort((x, y) => x.order - y.order);

    let intersects = false;
    let nearbyStopCount = 0;
    let routeDetails = {};

    /**
     * Check route intersection with circle
     * @param {Array} stopsArr - Array of stop objects with lat/lng
     * @param {String} routeType - 'morning' or 'evening'
     * @returns {Object} { intersects: boolean, stopCount: number, routePath: Array }
     */
    async function checkRouteStops(stopsArr, routeType) {
      const result = { intersects: false, stopCount: 0, routePath: [] };
      
      if (!stopsArr || stopsArr.length === 0) return result;

      // Single stop: just check if it's within circle
      if (stopsArr.length === 1) {
        const s = stopsArr[0];
        const dist = getDistance(
          { latitude: userLocation.lat, longitude: userLocation.lng },
          { latitude: s.lat, longitude: s.lng }
        );
        
        if (dist <= radiusMeters) {
          result.intersects = true;
          result.stopCount = 1;
        }
        result.routePath = [{ lat: s.lat, lng: s.lng }];
        return result;
      }

      // Multiple stops: Generate route path using Google Directions or straight-line
      const origin = { lat: stopsArr[0].lat, lng: stopsArr[0].lng };
      const destination = { lat: stopsArr[stopsArr.length - 1].lat, lng: stopsArr[stopsArr.length - 1].lng };
      const waypoints = stopsArr.slice(1, -1).map(s => ({ lat: s.lat, lng: s.lng }));

             let path;
       try {
         // Generate FULL ROUTE as array of mini points (not just bus stops!)
         // This includes hundreds of points along the actual road path
         path = await getRoutePath(origin, destination, waypoints);
       } catch (e) {
         // Fallback to straight-line connections between stops only
         path = stopsArr.map(s => ({ lat: s.lat, lng: s.lng }));
       }

      // Store the FULL ROUTE path (hundreds of mini points) for reference
      result.routePath = path;

             // Check if the FULL ROUTE (all mini points + segments) intersects the circle
       if (isPathIntersectsCircle(userLocation, path, radiusMeters)) {
         result.intersects = true;
         
         // Count actual bus stops within the circle for reporting
         result.stopCount = stopsArr.reduce((acc, s) => {
           const d = getDistance(
             { latitude: userLocation.lat, longitude: userLocation.lng },
             { latitude: s.lat, longitude: s.lng }
           );
           return acc + (d <= radiusMeters ? 1 : 0);
         }, 0);
       }

      return result;
    }

    // Check both morning and evening routes
    try {
      const morningCheck = await checkRouteStops(morningStops, 'MORNING');
      if (morningCheck.intersects) {
        intersects = true;
        nearbyStopCount += morningCheck.stopCount;
        routeDetails.morningRoute = morningCheck.routePath;
      }

      const eveningCheck = await checkRouteStops(eveningStops, 'EVENING');
      if (eveningCheck.intersects) {
        intersects = true;
        nearbyStopCount += eveningCheck.stopCount;
        routeDetails.eveningRoute = eveningCheck.routePath;
      }

    } catch (err) {
      console.error(`Error checking routes for bus ${b.number}:`, err);
      
      // Fallback: check if any individual stops are within the circle
      const fallbackCount = [...morningStops, ...eveningStops].reduce((acc, s) => {
        const d = getDistance(
          { latitude: userLocation.lat, longitude: userLocation.lng },
          { latitude: s.lat, longitude: s.lng }
        );
        return acc + (d <= radiusMeters ? 1 : 0);
      }, 0);
      
             if (fallbackCount > 0) {
         intersects = true;
         nearbyStopCount = fallbackCount;
       }
     }

     // If route intersects the circle, include this bus in results
     if (intersects) {
       results.push({
        busNumber: b.number,
        busName: b.name,
        location: b.location,
        totalNearbyStops: nearbyStopCount,
        morningStops: morningStops.map(s => ({ name: s.name, lat: s.lat, lng: s.lng })),
        eveningStops: eveningStops.map(s => ({ name: s.name, lat: s.lat, lng: s.lng })),
                 routeDetails // Store the actual route paths for debugging/display
       });
     }
   }

   return results;
}

// Simple admin auth (env-based)
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ---- Pending admin signup storage ----
const PENDING_ADMIN_PATH = path.join(__dirname, 'pending_admins.json');
function readPendingAdmins() {
  try {
    if (fs.existsSync(PENDING_ADMIN_PATH)) {
      return JSON.parse(fs.readFileSync(PENDING_ADMIN_PATH, 'utf-8'));
    }
  } catch {}
  return [];
}
function writePendingAdmins(list) {
  try {
    fs.writeFileSync(PENDING_ADMIN_PATH, JSON.stringify(list, null, 2), 'utf-8');
    return true;
  } catch { return false; }
}
function isSuperAdmin(email) {
  return MAIN_ADMIN_EMAIL && email && email.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase();
}

// Admin login backed by database
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    // Superadmin login via .env (not stored in DB)
    if (isSuperAdmin(email) && MAIN_ADMIN_PASSWORD) {
      const ok = bcrypt.compareSync(password, bcrypt.hashSync(MAIN_ADMIN_PASSWORD, 8)) || password === MAIN_ADMIN_PASSWORD;
      if (ok) {
        const token = jwt.sign({ role: 'superadmin', email, id: 'env-superadmin' }, JWT_SECRET, { expiresIn: '8h' });
        return res.json({ success: true, token });
      }
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin || !bcrypt.compareSync(password, admin.password)) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const token = jwt.sign({ role: 'admin', email: admin.email, id: admin.id }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ success: true, token });
  } catch (e) {
    console.error('Admin login failed:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Example protected route (for future admin dashboard APIs)
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin' && payload.role !== 'superadmin') throw new Error('Not admin');
    req.admin = payload;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ success: true, admin: { email: req.admin.email, role: req.admin.role } });
});

// Public: submit signup request for admin
app.post('/api/admin/signup-request', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }
    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email' });
    }
    // If already an admin, reject
    const existing = await prisma.admin.findUnique({ where: { email } });
    if (existing || isSuperAdmin(email)) {
      return res.status(400).json({ success: false, message: 'This email is already an admin' });
    }
    const pending = readPendingAdmins();
    if (pending.find(p => p.email.toLowerCase() === email.toLowerCase())) {
      return res.json({ success: true, message: 'Signup request already submitted' });
    }
    const hashed = bcrypt.hashSync(password, 10);
    pending.push({ name, email, password: hashed, createdAt: new Date().toISOString() });
    writePendingAdmins(pending);
    res.json({ success: true, message: 'Signup request submitted. Await approval by main admin.' });
  } catch (e) {
    console.error('Signup request failed:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// List pending admins (superadmin only)
app.get('/api/admin/requests', requireAdmin, (req, res) => {
  if (req.admin.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Only superadmin may view requests' });
  }
  const pending = readPendingAdmins();
  res.json({ success: true, requests: pending.map(p => ({ name: p.name, email: p.email, createdAt: p.createdAt })) });
});

// Approve pending admin (superadmin)
app.post('/api/admin/requests/:email/approve', requireAdmin, async (req, res) => {
  if (req.admin.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Only superadmin may approve' });
  }
  const email = decodeURIComponent(req.params.email);
  let pending = readPendingAdmins();
  const idx = pending.findIndex(p => p.email.toLowerCase() === email.toLowerCase());
  if (idx === -1) return res.status(404).json({ success: false, message: 'Request not found' });
  const reqObj = pending[idx];
  try {
    // create admin in DB
    await prisma.admin.create({ data: { email: reqObj.email, password: reqObj.password } });
  } catch (e) {
    console.error('Failed creating admin:', e);
    return res.status(500).json({ success: false, message: 'Failed to create admin' });
  }
  pending.splice(idx, 1);
  writePendingAdmins(pending);
  res.json({ success: true });
});

// Reject pending admin (superadmin)
app.post('/api/admin/requests/:email/reject', requireAdmin, (req, res) => {
  if (req.admin.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Only superadmin may reject' });
  }
  const email = decodeURIComponent(req.params.email);
  let pending = readPendingAdmins();
  const next = pending.filter(p => p.email.toLowerCase() !== email.toLowerCase());
  writePendingAdmins(next);
  res.json({ success: true });
});

// Get availability logs for admin dashboard
app.get('/api/admin/logs', requireAdmin, async (req, res) => {
  try {
    const logs = await prisma.availabilityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100 // Limit to last 100 logs
    });

    // Enrich with place name if coordinates are available
    const enriched = await Promise.all(logs.map(async (log) => {
      let locationName = null;
      if (typeof log.lat === 'number' && typeof log.lng === 'number') {
        try {
          locationName = await reverseGeocode(log.lat, log.lng);
        } catch (e) {
          locationName = null;
        }
      } else if (typeof log.location === 'string') {
        // If only a string was provided, try parsing coords "lat,lng"
        const m = log.location.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/);
        if (m) {
          const lat = parseFloat(m[1]); const lng = parseFloat(m[2]);
          if (!isNaN(lat) && !isNaN(lng)) {
            try { locationName = await reverseGeocode(lat, lng); } catch {}
          }
        }
      }
      return { ...log, locationName };
    }));

    res.json({ success: true, logs: enriched });
  } catch (e) {
    console.error('Failed to fetch logs:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
});

// Add new bus (admin only)
app.post('/api/admin/buses', requireAdmin, async (req, res) => {
  try {
    const { number, name, location, capacity, currentOccupancy, driverName, driverPhone, liveLocationUrl, morningStops, eveningStops } = req.body;
    
    if (!number || !name || !location) {
      return res.status(400).json({ success: false, message: 'Bus number, name, and location are required' });
    }

    const bus = await prisma.bus.create({
      data: { number, name, location, capacity: capacity ?? 60, currentOccupancy: currentOccupancy ?? 0, driverName: driverName ?? "", driverPhone: driverPhone ?? "", liveLocationUrl: liveLocationUrl ?? "" }
    });

    // Add morning stops
    if (morningStops && morningStops.length > 0) {
      for (let i = 0; i < morningStops.length; i++) {
        const stop = morningStops[i];
        await prisma.stop.create({
          data: {
            name: stop.name,
            lat: stop.lat,
            lng: stop.lng,
            period: 'MORNING',
            order: i + 1,
            busId: bus.id
          }
        });
      }
    }

    // Add evening stops
    if (eveningStops && eveningStops.length > 0) {
      for (let i = 0; i < eveningStops.length; i++) {
        const stop = eveningStops[i];
        await prisma.stop.create({
          data: {
            name: stop.name,
            lat: stop.lat,
            lng: stop.lng,
            period: 'EVENING',
            order: i + 1,
            busId: bus.id
          }
        });
      }
    }

    res.json({ success: true, message: 'Bus added successfully', bus });
  } catch (e) {
    console.error('Failed to add bus:', e);
    res.status(500).json({ success: false, message: 'Failed to add bus' });
  }
});

// Get all buses (admin only)
app.get('/api/admin/buses', requireAdmin, async (req, res) => {
  try {
    const buses = await prisma.bus.findMany({
      include: {
        stops: {
          orderBy: { order: 'asc' }
        }
      }
    });
    res.json({ success: true, buses });
  } catch (e) {
    console.error('Failed to fetch buses:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch buses' });
  }
});

// Update bus (admin only)
app.put('/api/admin/buses/:busNumber', requireAdmin, async (req, res) => {
  try {
    const { busNumber } = req.params;
    const { name, location, capacity, currentOccupancy, driverName, driverPhone, liveLocationUrl, morningStops, eveningStops } = req.body;
    
    const bus = await prisma.bus.findUnique({ where: { number: busNumber } });
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }

    // Update bus basic info
    const updatedBus = await prisma.bus.update({
      where: { number: busNumber },
      data: { name, location, capacity: capacity ?? undefined, currentOccupancy: currentOccupancy ?? undefined, driverName, driverPhone, liveLocationUrl }
    });

    // Delete existing stops
    await prisma.stop.deleteMany({ where: { busId: bus.id } });

    // Add new morning stops
    if (morningStops && morningStops.length > 0) {
      for (let i = 0; i < morningStops.length; i++) {
        const stop = morningStops[i];
        await prisma.stop.create({
          data: {
            name: stop.name,
            lat: stop.lat,
            lng: stop.lng,
            period: 'MORNING',
            order: i + 1,
            busId: bus.id
          }
        });
      }
    }

    // Add new evening stops
    if (eveningStops && eveningStops.length > 0) {
      for (let i = 0; i < eveningStops.length; i++) {
        const stop = eveningStops[i];
        await prisma.stop.create({
          data: {
            name: stop.name,
            lat: stop.lat,
            lng: stop.lng,
            period: 'EVENING',
            order: i + 1,
            busId: bus.id
          }
        });
      }
    }

    res.json({ success: true, message: 'Bus updated successfully', bus: updatedBus });
  } catch (e) {
    console.error('Failed to update bus:', e);
    res.status(500).json({ success: false, message: 'Failed to update bus' });
  }
});

// Delete bus (admin only)
app.delete('/api/admin/buses/:busNumber', requireAdmin, async (req, res) => {
  try {
    const { busNumber } = req.params;
    
    const bus = await prisma.bus.findUnique({ where: { number: busNumber } });
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }

    // Delete all stops first
    await prisma.stop.deleteMany({ where: { busId: bus.id } });
    
    // Delete the bus
    await prisma.bus.delete({ where: { number: busNumber } });

    res.json({ success: true, message: 'Bus deleted successfully' });
  } catch (e) {
    console.error('Failed to delete bus:', e);
    res.status(500).json({ success: false, message: 'Failed to delete bus' });
  }
});

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Bus API is running',
    timestamp: new Date().toISOString()
  });
});

// Bus availability checker endpoint
app.post('/api/check-availability', async (req, res) => {
  try {
    const { email, location } = req.body;

    // Validate input (email required)
    if (!email || !location) {
      return res.status(400).json({
        success: false,
        message: 'Email and location are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // STEP 1: Parse location (coordinates or location name)
    console.log('\n🚀 NEW BUS AVAILABILITY CHECK');
    console.log(`📧 Email: ${email}`);
    console.log(`📍 Input location: ${location}`);
    
    let userLocation;
    if (typeof location === 'string') {
      // Check if it's coordinates (lat,lng format) - handle with or without spaces
      const coordMatch = location.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        if (isNaN(lat) || isNaN(lng)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid coordinate format. Please provide coordinates as "lat,lng"'
          });
        }
        userLocation = { lat, lng };
        console.log(`✅ Using coordinates directly: ${lat},${lng}`);
      } else {
        // STEP 2: It's a location name, geocode it
        console.log(`🔍 Geocoding location name: "${location}"...`);
        try {
          const geocodedLocation = await geocodeLocation(location);
          userLocation = { lat: geocodedLocation.lat, lng: geocodedLocation.lng };
          console.log(`✅ Geocoded to: ${userLocation.lat},${userLocation.lng}`);
          console.log(`   Address: ${geocodedLocation.formatted_address}`);
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: `Could not find location "${location}". Please provide coordinates as "lat,lng" or a valid location name.`
          });
        }
      }
    } else if (typeof location === 'object' && location.lat && location.lng) {
      userLocation = location;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid location format. Please provide coordinates as "lat,lng" or a location name.'
      });
    }

              // STEP 3: Find nearby buses (checks if routes intersect 1.5km circle)
      const nearbyBuses = await findNearbyBusesDb(userLocation, 1.5);

    // Log the availability check to database
    try {
      await prisma.availabilityLog.create({
        data: {
          email: email,
          location: typeof location === 'string' ? location : `${userLocation.lat},${userLocation.lng}`,
          lat: userLocation.lat,
          lng: userLocation.lng,
          status: nearbyBuses.length > 0 ? 'AVAILABLE' : 'UNAVAILABLE'
        }
      });
    } catch (logError) {
      console.error('Failed to log availability check:', logError);
      // Don't fail the request if logging fails
    }

    if (nearbyBuses.length === 0) {
      return res.json({
        success: true,
        available: false,
        message: 'At your location, within 1.5km radius, the college bus is not available. Your search will be notified to admin.',
        buses: []
      });
    }

    return res.json({
      success: true,
      available: true,
      message: `Found ${nearbyBuses.length} bus(es) within 1.5km radius`,
      buses: nearbyBuses
    });

  } catch (error) {
    console.error('Error checking bus availability:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all bus routes (from DB)
app.get('/api/routes', async (req, res) => {
  try {
    const busesWithStops = await prisma.bus.findMany({
      include: {
        stops: {
          orderBy: [{ period: 'asc' }, { order: 'asc' }],
        },
      },
    });

    const toStops = (stops, period) => stops
      .filter(s => s.period === period)
      .sort((a, b) => a.order - b.order)
      .map(s => ({ name: s.name, coords: { lat: s.lat, lng: s.lng } }));

    const routes = busesWithStops.map(bus => {
      const morningStops = toStops(bus.stops, 'MORNING');
      const eveningStops = toStops(bus.stops, 'EVENING');

      return {
        number: bus.number,
        name: bus.name,
        location: bus.location,
        capacity: bus.capacity,
        currentOccupancy: bus.currentOccupancy,
        driverName: bus.driverName,
        driverPhone: bus.driverPhone,
        liveLocationUrl: bus.liveLocationUrl,
        morningRoute: {
          stops: morningStops,
          from: morningStops[0]?.name || 'Start',
          to: morningStops[morningStops.length - 1]?.name || 'End',
          description: `Route from ${morningStops[0]?.name || 'Start'} to ${morningStops[morningStops.length - 1]?.name || 'End'}`,
        },
        eveningRoute: {
          stops: eveningStops,
          from: eveningStops[0]?.name || 'Start',
          to: eveningStops[eveningStops.length - 1]?.name || 'End',
          description: `Route from ${eveningStops[0]?.name || 'Start'} to ${eveningStops[eveningStops.length - 1]?.name || 'End'}`,
        },
      };
    });

    res.json({ success: true, routes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to load routes' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚌 Bus API Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔍 Check availability: POST http://localhost:${PORT}/api/check-availability`);
});

module.exports = app;
