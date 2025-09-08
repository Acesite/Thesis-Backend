const db = require("../../Config/db");
const path = require("path");
const fs = require("fs");

exports.createCrop = (req, res) => {
  const {
    crop_type_id,
    variety,
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
  

  let parsedCoords = typeof coordinates === "string" ? JSON.parse(coordinates) : coordinates;
  let [lng, lat] = Array.isArray(parsedCoords[0]) ? parsedCoords[0] : parsedCoords;
  const polygonString = JSON.stringify(parsedCoords);

  
 // Handle multiple image uploads
const photoFiles = req.files?.photos;
const photoPaths = [];

const uploadDir = path.join(__dirname, "../uploads/crops");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ✅ Proceed only if photos were uploaded
if (photoFiles) {
  const files = Array.isArray(photoFiles) ? photoFiles : [photoFiles];

  files.forEach(file => {
    const filename = `${Date.now()}_${file.name}`;
    const filePath = path.join(uploadDir, filename);
    file.mv(filePath); // ✅ Save the file
    photoPaths.push(`/uploads/crops/${filename}`);
  });
}

// Save to DB using either the uploaded paths or an empty array
const sql = `
  INSERT INTO tbl_crops (
    crop_type_id, variety_id, planted_date, estimated_harvest,
    estimated_volume, estimated_hectares, note,
    latitude, longitude, coordinates, photos, barangay, admin_id, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
`;

const values = [
  crop_type_id,
  variety_id || null,
  plantedDate,
  estimatedHarvest,
  estimatedVolume,
  estimatedHectares,
  note,
  lat,
  lng,
  polygonString,
  JSON.stringify(photoPaths), 
  barangay,
  admin_id
];



  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Insert error:", err);
      return res.status(500).json({ message: "Server error" });
    }
    res.status(201).json({ message: "Crop saved successfully" });
  });
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
  SELECT crops.*, 
  crop_types.name AS crop_name,
  crop_varieties.name AS variety_name
FROM tbl_crops AS crops
JOIN tbl_crop_types AS crop_types ON crops.crop_type_id = crop_types.id
LEFT JOIN tbl_crop_varieties AS crop_varieties ON crops.variety_id = crop_varieties.id

  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Fetch error:", err.message);
      return res.status(500).json({ error: "Database error" });
    }
    res.status(200).json(results);
  });
};



exports.getCropById = (req, res) => {
  const { id } = req.params;
  db.query("SELECT * FROM tbl_crops WHERE id = ?", [id], (err, results) => {
    if (err) {
      console.error("Fetch by ID error:", err.message);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: "Crop not found" });
    }
    res.status(200).json(results[0]);
  });
};


exports.getAllPolygons = (req, res) => {
  const sql = `
    SELECT 
      crops.*, 
      crop_types.name AS crop_name
    FROM tbl_crops AS crops
    JOIN tbl_crop_types AS crop_types ON crops.crop_type_id = crop_types.id
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Fetch polygons error:", err);
      return res.status(500).json({ error: "Database error" });
    }

    const geojson = {
      type: "FeatureCollection",
      features: results.map(row => ({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [JSON.parse(row.coordinates)],
        },
        properties: {
          id: row.id,
          crop_name: row.crop_name, // ✅ use crop_name from JOIN
          variety: row.variety,
          planted_date: row.planted_date,
          estimated_harvest: row.estimated_harvest,
          estimated_volume: row.estimated_volume,
          estimated_hectares: row.estimated_hectares,
          note: row.note,
        }
      }))
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
  
