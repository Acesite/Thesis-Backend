const db = require("../../Config/db");
const path = require("path");
const fs = require("fs");

const toNullableInt = (v) => {
  if (v === undefined || v === null || v === "" || v === "null") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

exports.createCrop = async (req, res) => {
  try {
    const {
      crop_type_id,
      variety_id,
      plantedDate,
      estimatedHarvest,
      estimatedVolume,
      estimatedHectares,
      note,
      coordinates,
      barangay,
      admin_id
    } = req.body;

    // coords -> ring [[lng,lat],...]
    const parsedCoords = typeof coordinates === "string" ? JSON.parse(coordinates) : coordinates;
    if (!Array.isArray(parsedCoords) || !Array.isArray(parsedCoords[0])) {
      return res.status(400).json({ message: "Invalid coordinates format" });
    }
    const [lng, lat] = parsedCoords[0];
    const polygonString = JSON.stringify(parsedCoords);

    // ---- PHOTOS ----
    const photoFiles = req.files?.photos;
    const photoPaths = [];

    if (photoFiles) {
      const files = Array.isArray(photoFiles) ? photoFiles : [photoFiles];

      // SAVE TO <projectRoot>/uploads/crops  (served by /uploads)
      const uploadDir = path.join(process.cwd(), "uploads", "crops");
      await fs.promises.mkdir(uploadDir, { recursive: true });

      await Promise.all(
        files.map(async (file) => {
          // optional guards
          const allowed = ["image/jpeg", "image/png", "image/webp"];
          if (!allowed.includes(file.mimetype)) {
            throw new Error("Only JPG/PNG/WebP images are allowed");
          }
          const MAX = 10 * 1024 * 1024;
          if (file.size > MAX) throw new Error("Photo too large (max 10MB)");

          const ext = path.extname(file.name).toLowerCase();
          const base = path.basename(file.name, ext).replace(/[^a-z0-9_-]/gi, "");
          const filename = `${Date.now()}_${base || "crop"}${ext}`;
          const filePath = path.join(uploadDir, filename);

          await file.mv(filePath);                 // <-- await!
          photoPaths.push(`/uploads/crops/${filename}`); // public path
        })
      );
    }

    // sanitize FKs / numbers
    const vId = toNullableInt(variety_id);
    const ctId = toNullableInt(crop_type_id);
    const adminId = toNullableInt(admin_id);

    const sql = `
      INSERT INTO tbl_crops (
        crop_type_id, variety_id, planted_date, estimated_harvest,
        estimated_volume, estimated_hectares, note,
        latitude, longitude, coordinates, photos, barangay, admin_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const values = [
      ctId,
      vId,                                  // NULL if blank
      plantedDate || null,
      estimatedHarvest || null,
      estimatedVolume || null,
      estimatedHectares || null,
      note || null,
      lat,                                   // from first ring point
      lng,
      polygonString,
      JSON.stringify(photoPaths),            // ["\/uploads\/crops\/..."]
      barangay || null,
      adminId
    ];

    const [result] = await db.promise().query(sql, values);
    return res.status(201).json({
      success: true,
      id: result.insertId,
      photos: photoPaths
    });
  } catch (err) {
    console.error("Insert error:", err);
    return res.status(400).json({ message: err.message || "Server error" });
  }
};

exports.getAllPolygons = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT coordinates FROM crops WHERE coordinates IS NOT NULL");

    const geojson = {
      type: "FeatureCollection",
      features: rows.map((row) => ({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: JSON.parse(row.coordinates),
        },
        properties: {},
      })),
    };

    res.json(geojson);
  } catch (err) {
    console.error("❌ Failed to get polygons:", err);
    res.status(500).json({ message: "Error retrieving crop polygons" });
  }
};

exports.getCrops = (req, res) => {
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
    ORDER BY c.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.status(200).json(results);
  });
};

exports.getCropById = (req, res) => {
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
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (results.length === 0) return res.status(404).json({ message: "Crop not found" });
    res.status(200).json(results[0]);
  });
};

exports.getAllPolygons = (req, res) => {
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
  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Fetch polygons error:", err);
      return res.status(500).json({ error: "Database error" });
    }

    const geojson = {
      type: "FeatureCollection",
      features: results.map((row) => ({
        type: "Feature",
        geometry: {
          type: "Polygon",
          // row.coordinates is a JSON string of the ring; mapbox expects [ring]
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
          admin_name: row.admin_name,        // ← include tagger
          created_at: row.created_at
        },
      })),
    };

    res.json(geojson);
  });
};

  exports.getCropTypes = (req, res) => {
    const sql = "SELECT * FROM tbl_crop_types";
    db.query(sql, (err, results) => {
      if (err) {
        console.error("Failed to fetch crop types:", err);
        return res.status(500).json({ message: "Server error" });
      }
      res.status(200).json(results);
    });
  };
  

  exports.getCropVarietiesByType = (req, res) => {
    const { crop_type_id } = req.params;
    const sql = "SELECT id, name FROM tbl_crop_varieties WHERE crop_type_id = ?";
    db.query(sql, [crop_type_id], (err, results) => {
      if (err) {
        console.error("Failed to fetch crop varieties:", err);
        return res.status(500).json({ message: "Server error" });
      }
      res.status(200).json(results);
    });
  };
  
