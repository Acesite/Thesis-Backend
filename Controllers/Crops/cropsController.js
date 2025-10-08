// Controllers/Crops/cropsController.js
const db = require("../../Config/db");
const path = require("path");
const fs = require("fs");

// ---------- helpers ----------
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
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}
function mvFile(file, destPath) {
  return new Promise((resolve, reject) => {
    file.mv(destPath, (err) => (err ? reject(err) : resolve()));
  });
}

// ---------- create crop ----------
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

      // farmer fields
      farmer_first_name,
      farmer_last_name,
      farmer_mobile,
      farmer_barangay,
      farmer_address,        // from old front end
      full_address           // from new front end
    } = req.body;

    const ctId = toNullableInt(crop_type_id);
    if (!ctId) return res.status(400).json({ message: "crop_type_id is required" });
    if (!plantedDate) return res.status(400).json({ message: "plantedDate is required" });

    // parse coords ring [[lng,lat],...]
    const parsedCoords = typeof coordinates === "string" ? JSON.parse(coordinates) : coordinates;
    if (!Array.isArray(parsedCoords) || !Array.isArray(parsedCoords[0])) {
      return res.status(400).json({ message: "Invalid coordinates format" });
    }
    const [lng, lat] = parsedCoords[0];
    if (![lng, lat].every((n) => typeof n === "number" && isFinite(n))) {
      return res.status(400).json({ message: "Invalid coordinate pair" });
    }
    const polygonString = JSON.stringify(parsedCoords);

    // compute harvest date on server
    const maturityDays = STANDARD_MATURITY_DAYS[ctId] || 0;
    const computedHarvest = addDaysToISO(plantedDate, maturityDays);

    // handle photos
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
        if (file.size > 10 * 1024 * 1024) {
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

    const vId = toNullableInt(variety_id);
    const adminId = toNullableInt(admin_id) ?? (req.user && toNullableInt(req.user.id)) ?? null;
    const estVol = toNullableNumber(estimatedVolume);
    const estHa = toNullableNumber(estimatedHectares);

    // ---------- farmer upsert by mobile ----------
    let farmer_id = null;

    if (farmer_mobile) {
      // try to find existing farmer by phone
      const [existing] = await db
        .promise()
        .query(
          "SELECT farmer_id FROM tbl_farmers WHERE mobile_number = ? LIMIT 1",
          [farmer_mobile]
        );

      const finalAddress = full_address ?? farmer_address ?? null;

      if (existing.length) {
        farmer_id = existing[0].farmer_id;

        // optional: refresh name, barangay, address with latest values
        await db.promise().query(
          `UPDATE tbl_farmers
             SET first_name = COALESCE(?, first_name),
                 last_name  = COALESCE(?, last_name),
                 barangay   = COALESCE(?, barangay),
                 full_address = COALESCE(?, full_address)
           WHERE farmer_id = ?`,
          [farmer_first_name || null, farmer_last_name || null, farmer_barangay || null, finalAddress, farmer_id]
        );
      } else {
        // insert with the columns that now exist
        const [ins] = await db
          .promise()
          .query(
            `INSERT INTO tbl_farmers
               (first_name, last_name, mobile_number, barangay, full_address, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [
              farmer_first_name || null,
              farmer_last_name || null,
              farmer_mobile,
              farmer_barangay || null,
              finalAddress
            ]
          );
        farmer_id = ins.insertId;
      }
    }

    // ---------- save crop ----------
    const sql = `
      INSERT INTO tbl_crops (
        farmer_id,
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
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const values = [
      farmer_id,
      ctId,
      vId,
      plantedDate || null,
      computedHarvest || null,
      estVol,
      estHa,
      note || null,
      lat,
      lng,
      polygonString,
      JSON.stringify(photoPaths),
      adminId
    ];

    const [result] = await db.promise().query(sql, values);

    res.status(201).json({
      success: true,
      id: result.insertId,
      estimated_harvest: computedHarvest,
      photos: photoPaths
    });
  } catch (err) {
    console.error("Insert error:", err);
    res.status(400).json({ message: err.sqlMessage || err.message || "Server error" });
  }
};

// ---------- list crops with farmer fields ----------
exports.getCrops = async (_req, res) => {
  try {
    const sql = `
      SELECT
        c.*,
        ct.name AS crop_name,
        cv.name AS variety_name,
        CONCAT(u.first_name, ' ', u.last_name) AS admin_name,
        f.first_name AS farmer_first_name,
        f.last_name  AS farmer_last_name,
        f.mobile_number AS farmer_mobile,
        f.barangay AS farmer_barangay,
        f.full_address AS farmer_address
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

// ---------- crop by id ----------
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
        f.last_name  AS farmer_last_name,
        f.mobile_number AS farmer_mobile,
        f.barangay AS farmer_barangay,
        f.full_address AS farmer_address
      FROM tbl_crops c
      JOIN tbl_crop_types ct ON c.crop_type_id = ct.id
      LEFT JOIN tbl_crop_varieties cv ON c.variety_id = cv.id
      LEFT JOIN tbl_users u ON c.admin_id = u.id
      LEFT JOIN tbl_farmers f ON c.farmer_id = f.farmer_id
      WHERE c.id = ?
      LIMIT 1
    `;
    const [rows] = await db.promise().query(sql, [id]);
    if (!rows.length) return res.status(404).json({ message: "Crop not found" });
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error("getCropById error:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// ---------- polygons for map ----------
exports.getAllPolygons = async (_req, res) => {
  try {
    const sql = `
      SELECT
        c.*,
        ct.name AS crop_name,
        cv.name AS variety_name,
        CONCAT(u.first_name, ' ', u.last_name) AS admin_name,
        f.first_name AS farmer_first_name,
        f.last_name  AS farmer_last_name,
        f.mobile_number AS farmer_mobile,
        f.barangay AS farmer_barangay,
        f.full_address AS farmer_address
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
          note: row.note,
          admin_name: row.admin_name,
          created_at: row.created_at,
          farmer_first_name: row.farmer_first_name,
          farmer_last_name: row.farmer_last_name,
          farmer_mobile: row.farmer_mobile,
          farmer_barangay: row.farmer_barangay,
          farmer_address: row.farmer_address
        },
      })),
    };

    res.json(geojson);
  } catch (err) {
    console.error("Fetch polygons error:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// ---------- taxonomies ----------
exports.getCropTypes = async (_req, res) => {
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


// Add this new function to your cropsController.js

// ---------- get ecosystems by crop type ----------
exports.getEcosystemsByCropType = async (req, res) => {
  try {
    const { crop_type_id } = req.params;
    const [rows] = await db
      .promise()
      .query(
        "SELECT id, name, name_tagalog, description FROM tbl_ecosystems WHERE crop_type_id = ? ORDER BY id",
        [crop_type_id]
      );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Failed to fetch ecosystems:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Also update getCrops and related functions to include ecosystem info:
// In getCrops, getCropById, getAllPolygons - add these to the SELECT:
// e.name AS ecosystem_name,
// e.name_tagalog AS ecosystem_name_tagalog
// 
// And add this JOIN:
// LEFT JOIN tbl_ecosystems e ON c.ecosystem_id = e.id

// ---------- Update createCrop to include ecosystem_id ----------
exports.createCrop = async (req, res) => {
  try {
    const {
      crop_type_id,
      variety_id,
      ecosystem_id,  // ADD THIS
      plantedDate,
      estimatedVolume,
      estimatedHectares,
      note,
      coordinates,
      admin_id,

      // farmer fields
      farmer_first_name,
      farmer_last_name,
      farmer_mobile,
      farmer_barangay,
      farmer_address,
      full_address
    } = req.body;

    const ctId = toNullableInt(crop_type_id);
    if (!ctId) return res.status(400).json({ message: "crop_type_id is required" });
    if (!plantedDate) return res.status(400).json({ message: "plantedDate is required" });

    // parse coords ring [[lng,lat],...]
    const parsedCoords = typeof coordinates === "string" ? JSON.parse(coordinates) : coordinates;
    if (!Array.isArray(parsedCoords) || !Array.isArray(parsedCoords[0])) {
      return res.status(400).json({ message: "Invalid coordinates format" });
    }
    const [lng, lat] = parsedCoords[0];
    if (![lng, lat].every((n) => typeof n === "number" && isFinite(n))) {
      return res.status(400).json({ message: "Invalid coordinate pair" });
    }
    const polygonString = JSON.stringify(parsedCoords);

    // compute harvest date on server
    const maturityDays = STANDARD_MATURITY_DAYS[ctId] || 0;
    const computedHarvest = addDaysToISO(plantedDate, maturityDays);

    // handle photos
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
        if (file.size > 10 * 1024 * 1024) {
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

    const vId = toNullableInt(variety_id);
    const ecoId = toNullableInt(ecosystem_id);  // ADD THIS
    const adminId = toNullableInt(admin_id) ?? (req.user && toNullableInt(req.user.id)) ?? null;
    const estVol = toNullableNumber(estimatedVolume);
    const estHa = toNullableNumber(estimatedHectares);

    // ---------- farmer upsert by mobile ----------
    let farmer_id = null;

    if (farmer_mobile) {
      const [existing] = await db
        .promise()
        .query(
          "SELECT farmer_id FROM tbl_farmers WHERE mobile_number = ? LIMIT 1",
          [farmer_mobile]
        );

      const finalAddress = full_address ?? farmer_address ?? null;

      if (existing.length) {
        farmer_id = existing[0].farmer_id;

        await db.promise().query(
          `UPDATE tbl_farmers
             SET first_name = COALESCE(?, first_name),
                 last_name  = COALESCE(?, last_name),
                 barangay   = COALESCE(?, barangay),
                 full_address = COALESCE(?, full_address)
           WHERE farmer_id = ?`,
          [farmer_first_name || null, farmer_last_name || null, farmer_barangay || null, finalAddress, farmer_id]
        );
      } else {
        const [ins] = await db
          .promise()
          .query(
            `INSERT INTO tbl_farmers
               (first_name, last_name, mobile_number, barangay, full_address, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [
              farmer_first_name || null,
              farmer_last_name || null,
              farmer_mobile,
              farmer_barangay || null,
              finalAddress
            ]
          );
        farmer_id = ins.insertId;
      }
    }

    // ---------- save crop with ecosystem_id ----------
    const sql = `
      INSERT INTO tbl_crops (
        farmer_id,
        crop_type_id,
        variety_id,
        ecosystem_id,
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
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const values = [
      farmer_id,
      ctId,
      vId,
      ecoId,  // ADD THIS
      plantedDate || null,
      computedHarvest || null,
      estVol,
      estHa,
      note || null,
      lat,
      lng,
      polygonString,
      JSON.stringify(photoPaths),
      adminId
    ];

    const [result] = await db.promise().query(sql, values);

    res.status(201).json({
      success: true,
      id: result.insertId,
      estimated_harvest: computedHarvest,
      photos: photoPaths
    });
  } catch (err) {
    console.error("Insert error:", err);
    res.status(400).json({ message: err.sqlMessage || err.message || "Server error" });
  }
};
