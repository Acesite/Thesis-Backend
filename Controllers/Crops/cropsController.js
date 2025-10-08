const db = require("../../Config/db");
const path = require("path");
const fs = require("fs");

// ---------- Helpers ----------
const toNullableInt = (v) => {
  if (v === undefined || v === null || v === "" || v === "null") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toNullableNumber = (v) => {
  if (v === undefined || v === null || v === "" || v === "null") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const STANDARD_MATURITY_DAYS = {
  1: 100, // Corn
  2: 110, // Rice
  3: 360, // Banana
  4: 365, // Sugarcane
  5: 300, // Cassava
  6: 60,  // Vegetables
};

function addDaysToISO(dateStr, days) {
  if (!dateStr || !days) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

function mvFile(file, destPath) {
  // express-fileupload supports callback OR promise; ensure promisified
  return new Promise((resolve, reject) => {
    file.mv(destPath, (err) => (err ? reject(err) : resolve()));
  });
}

exports.createCrop = async (req, res) => {
  try {
    const {
      crop_type_id,
      variety_id,
      plantedDate,
      estimatedVolume,
      estimatedHectares,
      note,
      coordinates,
      admin_id,
      farmer_first_name,
      farmer_last_name,
      farmer_mobile,
      farmer_barangay,  // This is being passed from the form, no need to redeclare it
      farmer_address
    } = req.body;

    // Validate minimal fields
    const ctId = toNullableInt(crop_type_id);
    if (!ctId) return res.status(400).json({ message: "crop_type_id is required" });
    if (!plantedDate) return res.status(400).json({ message: "plantedDate is required" });

    // Declare once outside if needed for further use
    let farmer_id = null;
    let farmer_barangayFromDb = null;  // Renamed to avoid redeclaration error

    if (farmer_mobile) {
      // Check if the farmer already exists based on mobile number
      const [existingFarmer] = await db.promise().query(
        "SELECT farmer_id, barangay FROM tbl_farmers WHERE mobile_number = ? LIMIT 1", [farmer_mobile]
      );
      
      if (existingFarmer.length > 0) {
        // If farmer exists, use the existing farmer_id and fetch the barangay
        farmer_id = existingFarmer[0].farmer_id;
        farmer_barangayFromDb = existingFarmer[0].barangay; // Get barangay from tbl_farmers
      } else {
        // Insert new farmer if not found
        const insertFarmerSql = `
          INSERT INTO tbl_farmers (first_name, last_name, mobile_number, barangay, address)
          VALUES (?, ?, ?, ?, ?)
        `;
        const values = [farmer_first_name, farmer_last_name, farmer_mobile, farmer_barangay, farmer_address];
        const [result] = await db.promise().query(insertFarmerSql, values);
        farmer_id = result.insertId; // Get the inserted farmer's ID
        farmer_barangayFromDb = farmer_barangay; // Use the barangay passed from the form
      }
    }

    // 3. Parse coordinates (expecting a ring: [[lng,lat],...])
    const parsedCoords = typeof coordinates === "string" ? JSON.parse(coordinates) : coordinates;
    if (!Array.isArray(parsedCoords) || !Array.isArray(parsedCoords[0])) {
      return res.status(400).json({ message: "Invalid coordinates format" });
    }
    const [lng, lat] = parsedCoords[0];
    if (![lng, lat].every((n) => typeof n === "number" && isFinite(n))) {
      return res.status(400).json({ message: "Invalid coordinate pair" });
    }
    const polygonString = JSON.stringify(parsedCoords);

    // 4. Compute estimated harvest date on server (source of truth)
    const maturityDays = STANDARD_MATURITY_DAYS[ctId] || 0;
    const computedHarvest = addDaysToISO(plantedDate, maturityDays);

    // ---- Photos ----
    const photoPaths = [];
    const photoFiles = req.files?.photos;
    if (photoFiles) {
      const files = Array.isArray(photoFiles) ? photoFiles : [photoFiles];
      const uploadDir = path.join(process.cwd(), "uploads", "crops");
      await ensureDir(uploadDir);
      for (const file of files) {
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(file.mimetype)) {
          return res.status(400).json({ message: "Only JPG/PNG/WebP images are allowed" });
        }
        const MAX = 10 * 1024 * 1024;
        if (file.size > MAX) {
          return res.status(400).json({ message: "Photo too large (max 10MB)" });
        }
        const ext = path.extname(file.name).toLowerCase() || ".jpg";
        const base = path.basename(file.name, ext).replace(/[^a-z0-9_-]/gi, "") || "crop";
        const filename = `${Date.now()}_${base}${ext}`;
        const filePath = path.join(uploadDir, filename);
        await mvFile(file, filePath);
        photoPaths.push(`/uploads/crops/${filename}`);
      }
    }

    // Sanitize values
    const vId = toNullableInt(variety_id);
    const adminId = toNullableInt(admin_id) ?? (req.user && toNullableInt(req.user.id)) ?? null;
    const estVol = toNullableNumber(estimatedVolume);
    const estHa = toNullableNumber(estimatedHectares);

    // 5. Insert crop data into tbl_crops
    const sql = `
    INSERT INTO tbl_crops (
      crop_type_id,
      variety_id,
      planted_date,
      estimated_harvest,
      estimated_volume,
      estimated_hectares,
      note,
      latitude,
      longitude,
      coordinates,
      photos,
      admin_id,
      farmer_id,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW());
  `;
    const values = [
      ctId, vId, plantedDate || null, computedHarvest || null,
      estVol, estHa, note || null, lat, lng, polygonString,
      JSON.stringify(photoPaths), adminId, farmer_id,
    ];

    const [result] = await db.promise().query(sql, values);

    return res.status(201).json({
      success: true,
      id: result.insertId,
      estimated_harvest: computedHarvest,
      photos: photoPaths,
    });
  } catch (err) {
    console.error("Insert error:", err);
    return res.status(400).json({ message: err.message || "Server error" });
  }
};


// ---------- Get All Crops (list) ----------
// Update these functions in your controller to include farmer information

// ---------- Get All Crops (list) ----------
exports.getCrops = async (req, res) => {
  try {
    const sql = `
      SELECT 
        c.*,
        ct.name AS crop_name,
        cv.name AS variety_name,
        CONCAT(u.first_name, ' ', u.last_name) AS admin_name,
        f.first_name AS farmer_first_name,
        f.last_name AS farmer_last_name,
        f.mobile_number AS farmer_mobile,
        f.barangay AS farmer_barangay,
        f.address AS farmer_address
      FROM tbl_crops c
      JOIN tbl_crop_types ct ON c.crop_type_id = ct.id
      LEFT JOIN tbl_crop_varieties cv ON c.variety_id = cv.id
      LEFT JOIN tbl_users u ON c.admin_id = u.id
      LEFT JOIN tbl_farmers f ON c.farmer_id = f.farmer_id
      ORDER BY c.created_at DESC
    `;
    const [rows] = await db.promise().query(sql);
    res.status(200).json(rows);
  } catch (err) {
    console.error("getCrops error:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// ---------- Get Crop by ID ----------
exports.getCropById = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT 
        c.*,
        ct.name AS crop_name,
        cv.name AS variety_name,
        CONCAT(u.first_name, ' ', u.last_name) AS admin_name,
        f.first_name AS farmer_first_name,
        f.last_name AS farmer_last_name,
        f.mobile_number AS farmer_mobile,
        f.barangay AS farmer_barangay,
        f.address AS farmer_address
      FROM tbl_crops c
      JOIN tbl_crop_types ct ON c.crop_type_id = ct.id
      LEFT JOIN tbl_crop_varieties cv ON c.variety_id = cv.id
      LEFT JOIN tbl_users u ON c.admin_id = u.id
      LEFT JOIN tbl_farmers f ON c.farmer_id = f.farmer_id
      WHERE c.id = ?
    `;
    const [rows] = await db.promise().query(sql, [id]);
    if (!rows.length) return res.status(404).json({ message: "Crop not found" });
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error("getCropById error:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// ---------- Get All Polygons as GeoJSON ----------
exports.getAllPolygons = async (req, res) => {
  try {
    const sql = `
      SELECT 
        c.*,
        ct.name AS crop_name,
        cv.name AS variety_name,
        CONCAT(u.first_name, ' ', u.last_name) AS admin_name,
        f.first_name AS farmer_first_name,
        f.last_name AS farmer_last_name,
        f.mobile_number AS farmer_mobile,
        f.barangay AS farmer_barangay,
        f.address AS farmer_address
      FROM tbl_crops c
      JOIN tbl_crop_types ct ON c.crop_type_id = ct.id
      LEFT JOIN tbl_crop_varieties cv ON c.variety_id = cv.id
      LEFT JOIN tbl_users u ON c.admin_id = u.id
      LEFT JOIN tbl_farmers f ON c.farmer_id = f.farmer_id
      WHERE c.coordinates IS NOT NULL
    `;
    const [rows] = await db.promise().query(sql);

    const geojson = {
      type: "FeatureCollection",
      features: rows.map((row) => ({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [JSON.parse(row.coordinates)],
        },
        properties: {
          id: row.id,
          crop_name: row.crop_name,
          variety_name: row.variety_name,
          planted_date: row.planted_date,
          estimated_harvest: row.estimated_harvest,
          estimated_volume: row.estimated_volume,
          estimated_hectares: row.estimated_hectares,
          barangay: row.barangay,
          note: row.note,
          admin_name: row.admin_name,
          created_at: row.created_at,
          farmer_first_name: row.farmer_first_name,
          farmer_last_name: row.farmer_last_name,
          farmer_mobile: row.farmer_mobile,
          farmer_barangay: row.farmer_barangay,
          farmer_address: row.farmer_address,
        },
      })),
    };

    res.json(geojson);
  } catch (err) {
    console.error("Fetch polygons error:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// ---------- Get Crop by ID ----------
exports.getCropById = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT 
        c.*,
        ct.name AS crop_name,
        cv.name AS variety_name,
        CONCAT(u.first_name, ' ', u.last_name) AS admin_name
      FROM tbl_crops c
      JOIN tbl_crop_types ct ON c.crop_type_id = ct.id
      LEFT JOIN tbl_crop_varieties cv ON c.variety_id = cv.id
      LEFT JOIN tbl_users u ON c.admin_id = u.id
      WHERE c.id = ?
    `;
    const [rows] = await db.promise().query(sql, [id]);
    if (!rows.length) return res.status(404).json({ message: "Crop not found" });
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error("getCropById error:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// ---------- Get All Polygons as GeoJSON ----------
exports.getAllPolygons = async (req, res) => {
  try {
    const sql = `
      SELECT 
        c.*,
        ct.name AS crop_name,
        cv.name AS variety_name,
        CONCAT(u.first_name, ' ', u.last_name) AS admin_name
      FROM tbl_crops c
      JOIN tbl_crop_types ct ON c.crop_type_id = ct.id
      LEFT JOIN tbl_crop_varieties cv ON c.variety_id = cv.id
      LEFT JOIN tbl_users u ON c.admin_id = u.id
      WHERE c.coordinates IS NOT NULL
    `;
    const [rows] = await db.promise().query(sql);

    const geojson = {
      type: "FeatureCollection",
      features: rows.map((row) => ({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [JSON.parse(row.coordinates)],
        },
        properties: {
          id: row.id,
          crop_name: row.crop_name,
          variety_name: row.variety_name,
          planted_date: row.planted_date,
          estimated_harvest: row.estimated_harvest,
          estimated_volume: row.estimated_volume,
          estimated_hectares: row.estimated_hectares,
          barangay: row.barangay,
          note: row.note,
          admin_name: row.admin_name,
          created_at: row.created_at,
        },
      })),
    };

    res.json(geojson);
  } catch (err) {
    console.error("Fetch polygons error:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// ---------- Taxonomies ----------
exports.getCropTypes = async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM tbl_crop_types");
    res.status(200).json(rows);
  } catch (err) {
    console.error("Failed to fetch crop types:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getCropVarietiesByType = async (req, res) => {
  try {
    const { crop_type_id } = req.params;
    const [rows] = await db
      .promise()
      .query("SELECT id, name FROM tbl_crop_varieties WHERE crop_type_id = ?", [crop_type_id]);
    res.status(200).json(rows);
  } catch (err) {
    console.error("Failed to fetch crop varieties:", err);
    res.status(500).json({ message: "Server error" });
  }
};
