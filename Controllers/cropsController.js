const db = require("../Config/db");
const path = require("path");
const fs = require("fs");

exports.createCrop = (req, res) => {
  const {
    crop,
    variety,
    plantedDate,
    estimatedHarvest,
    estimatedVolume,
    estimatedHectares,
    note,
    coordinates
  } = req.body;

  let parsedCoords = typeof coordinates === "string" ? JSON.parse(coordinates) : coordinates;
  let [lng, lat] = Array.isArray(parsedCoords[0]) ? parsedCoords[0] : parsedCoords;
  const polygonString = JSON.stringify(parsedCoords);

  // 📸 Handle multiple image uploads
  const photoFiles = req.files?.photos;
  const uploadDir = path.join(__dirname, "../uploads/crops");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const photoPaths = [];
  const files = Array.isArray(photoFiles) ? photoFiles : [photoFiles];
  files.forEach(file => {
    const filename = `${Date.now()}_${file.name}`;
    const filePath = path.join(uploadDir, filename);
    file.mv(filePath);
    photoPaths.push(`/uploads/crops/${filename}`);
  });

  const sql = `
    INSERT INTO tbl_crops (
      crop, variety, planted_date, estimated_harvest,
      estimated_volume, estimated_hectares, note,
      latitude, longitude, coordinates, photos
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    crop,
    variety,
    plantedDate,
    estimatedHarvest,
    estimatedVolume,
    estimatedHectares,
    note,
    lat,
    lng,
    polygonString,
    JSON.stringify(photoPaths)
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





//  Optional: Get all crops
exports.getCrops = (req, res) => {
  db.query("SELECT * FROM tbl_crops", (err, results) => {
    if (err) {
      console.error("Fetch error:", err.message);
      return res.status(500).json({ error: "Database error" });
    }
    res.status(200).json(results);
  });
};

// ✅ Optional: Get crop by ID
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
    const sql = "SELECT * FROM tbl_crops";
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
            coordinates: [JSON.parse(row.coordinates)] // Make sure you store polygon coordinates as JSON string
          },
          properties: {
            id: row.id,
            crop: row.crop,
            variety: row.variety,
            planted_date: row.planted_date,
            estimated_harvest: row.estimated_harvest,
            estimated_volume: row.estimated_volume,
            estimated_hectares: row.estimated_hectares,
            note: row.note
          }
        }))
      };
  
      res.json(geojson);
    });
  };
