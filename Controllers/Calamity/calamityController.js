// controllers/calamities.controller.js
const db = require("../../Config/db");
const path = require("path");
const fs = require("fs");

// ---------- config ----------
const UPLOAD_SUBDIR = "uploads/calamity";          // -> /uploads/calamity
const UPLOAD_ABS_DIR = path.join(__dirname, "../../", UPLOAD_SUBDIR);

// ---------- helpers ----------
function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_ABS_DIR)) fs.mkdirSync(UPLOAD_ABS_DIR, { recursive: true });
}

// Build a server-relative path like: /uploads/calamity/1699999999999_file.png
function buildSavePath(originalName) {
  const safe = String(originalName).replace(/\s+/g, "_");
  return `/${UPLOAD_SUBDIR}/${Date.now()}_${safe}`;
}

// Turn whatever is in `row.photo` into a clean array of URLs
function parsePhotoColumnToArray(photoColValue) {
  if (!photoColValue) return [];

  let raw = photoColValue;

  // try JSON first
  if (typeof raw === "string" && raw.trim().startsWith("[")) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter(Boolean);
    } catch {
      /* fall through */
    }
  }

  // allow comma separated
  if (typeof raw === "string" && raw.includes(",")) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }

  // otherwise treat as single
  return [String(raw).trim()].filter(Boolean);
}

// Ensure entries are absolute-ish (server-relative /uploads/… or http…)
function normalizeToUploadsOrHttp(list) {
  return list
    .filter(Boolean)
    .map((p) => {
      const v = String(p).trim();
      if (!v) return null;
      if (v.startsWith("/uploads/")) return v; // already server-relative
      if (/^https?:\/\//i.test(v)) return v;   // absolute URL allowed
      // bare filename -> put under calamity folder
      return `/${UPLOAD_SUBDIR}/${v}`;
    })
    .filter(Boolean);
}

// ---------- controllers ----------

// GET /api/calamities
exports.getAllCalamities = (req, res) => {
  const sql = "SELECT * FROM tbl_calamity ORDER BY date_reported DESC, calamity_id DESC";
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const out = rows.map((r) => {
      const photos = normalizeToUploadsOrHttp(parsePhotoColumnToArray(r.photo));
      const photo = photos[0] || r.photo || null; // legacy single
      return { ...r, photos, photo };
    });

    res.json(out);
  });
};

// GET /api/calamities/polygons
exports.getCalamityPolygons = (req, res) => {
  const sql = `
    SELECT calamity_id AS id, calamity_type, barangay, severity_level, coordinates
    FROM tbl_calamity
    WHERE coordinates IS NOT NULL
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const features = [];
    for (const c of rows) {
      try {
        let coords = JSON.parse(c.coordinates);
        if (!Array.isArray(coords) || coords.length < 3) continue;

        // close polygon if needed
        const first = JSON.stringify(coords[0]);
        const last = JSON.stringify(coords[coords.length - 1]);
        if (first !== last) coords = [...coords, coords[0]];

        features.push({
          type: "Feature",
          properties: {
            id: c.id,
            calamity_type: c.calamity_type,
            barangay: c.barangay || null,
            severity_level: c.severity_level || null,
          },
          geometry: { type: "Polygon", coordinates: [coords] },
        });
      } catch (e) {
        console.error(`Invalid coordinates for calamity ${c.id}`, e);
      }
    }

    res.json({ type: "FeatureCollection", features });
  });
};

// GET /api/calamities/types
exports.getCalamityTypes = (req, res) => {
  db.query("SELECT DISTINCT calamity_type FROM tbl_calamity", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map((r) => r.calamity_type));
  });
};

// GET /api/calamities/ecosystems
exports.getAllEcosystems = (req, res) => {
  db.query("SELECT id, crop_type_id, name FROM tbl_ecosystems", (err, rows) => {
    if (err) {
      console.error("Error fetching ecosystems:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
};

// GET /api/calamities/crops
exports.getAllCrops = (req, res) => {
  db.query("SELECT id, name FROM tbl_crop_types", (err, rows) => {
    if (err) {
      console.error("Error fetching crops:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
};

// GET /api/calamities/crops/:cropTypeId/varieties
exports.getVarietiesByCropType = (req, res) => {
  const { cropTypeId } = req.params;
  if (!cropTypeId) return res.status(400).json({ error: "Crop type ID is required" });

  const sql = `
    SELECT id, crop_type_id, name, description
    FROM tbl_crop_varieties
    WHERE crop_type_id = ?
  `;
  db.query(sql, [cropTypeId], (err, rows) => {
    if (err) {
      console.error("Error fetching varieties:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
};

// POST /api/calamities  (multipart/form-data; field name for multiple files is "photos")
exports.addCalamity = async (req, res) => {
  try {
    const {
      calamity_type,
      description,
      location,
      coordinates,
      admin_id,
      ecosystem_id,
      crop_type_id,
      crop_variety_id,
      affected_area,
      crop_stage,
      latitude,
      longitude,
      barangay,
      status,             // existing
      severity_level,     // NEW
    } = req.body;

    if (!calamity_type || !description || !coordinates) {
      return res
        .status(400)
        .json({ error: "calamity_type, description, and coordinates are required" });
    }
    const adminId = Number(admin_id);
    if (!adminId) return res.status(400).json({ error: "admin_id is required" });

    // ---- save files ----
    ensureUploadDir();
    const photoPaths = [];
    const filesToSave = [];

    if (req.files?.photos) {
      if (Array.isArray(req.files.photos)) filesToSave.push(...req.files.photos);
      else filesToSave.push(req.files.photos);
    }
    if (req.files?.photo) filesToSave.push(req.files.photo);

    for (const f of filesToSave) {
      const rel = buildSavePath(f.name); // /uploads/calamity/...
      const abs = path.join(__dirname, "../../", rel);
      await f.mv(abs);
      photoPaths.push(rel);
    }

    // ---- parse polygon + lat/lng ----
    const polygon = typeof coordinates === "string" ? JSON.parse(coordinates) : coordinates;
    if (!Array.isArray(polygon) || polygon.length < 3) {
      return res
        .status(400)
        .json({ error: "Coordinates must be an array with at least 3 points" });
    }
    const [lon0, lat0] = polygon[0] || [];
    const latVal = latitude != null ? Number(latitude) : Number(lat0) || 0;
    const lonVal = longitude != null ? Number(longitude) : Number(lon0) || 0;

    const safeLocation = location || "Unknown";
    const safeBarangay = (barangay && String(barangay).trim()) || safeLocation;

    // ---- status validation ----
    const ALLOWED_STATUS = new Set(["Pending", "Verified", "Resolved", "Rejected"]);
    const requestedStatus = String(status || "").trim();
    const safeStatus = ALLOWED_STATUS.has(requestedStatus) ? requestedStatus : "Pending";

    // ---- severity validation ----
    const ALLOWED_SEVERITY = new Set(["Low", "Moderate", "High", "Severe"]);
    const requestedSeverity = String(severity_level || "").trim();
    const safeSeverity = ALLOWED_SEVERITY.has(requestedSeverity) ? requestedSeverity : null;

    // Store ALL photos inside the single `photo` column as JSON string
    const photoColumnValue = JSON.stringify(photoPaths);

    const sql = `
      INSERT INTO tbl_calamity
        (admin_id, calamity_type, description, ecosystem_id, crop_type_id, crop_variety_id,
         affected_area, crop_stage, photo, location, barangay, date_reported, status,
         severity_level, latitude, longitude, coordinates)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)
    `;

    const params = [
      adminId,
      calamity_type,
      description,
      ecosystem_id || null,
      crop_type_id || null,
      crop_variety_id || null,
      affected_area || null,
      crop_stage || null,
      photoColumnValue, // JSON array stored in `photo`
      safeLocation,
      safeBarangay,
      safeStatus,
      safeSeverity,     // NEW: matches column order
      latVal,
      lonVal,
      JSON.stringify(polygon),
    ];

    db.query(sql, params, (err, result) => {
      if (err) {
        console.error("Insert error:", err);
        return res.status(500).json({ error: "Failed to save calamity: " + err.message });
      }

      // Respond with normalized shape (always include array)
      const photosNormalized = normalizeToUploadsOrHttp(photoPaths);
      res.status(201).json({
        calamity_id: result.insertId,
        admin_id: adminId,
        calamity_type,
        description,
        ecosystem_id,
        crop_type_id,
        crop_variety_id,
        affected_area,
        crop_stage,
        // legacy: first photo (if your UI still reads it)
        photo: photosNormalized[0] || null,
        // new: full list for the sidebar
        photos: photosNormalized,
        location: safeLocation,
        barangay: safeBarangay,
        date_reported: new Date().toISOString(),
        status: safeStatus,
        severity_level: safeSeverity, // NEW
        latitude: latVal,
        longitude: lonVal,
        coordinates: polygon,
      });
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
