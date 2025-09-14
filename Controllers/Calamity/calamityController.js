const db = require("../../Config/db");
const path = require("path");
const fs = require("fs");

// Get all calamities
exports.getAllCalamities = (req, res) => {
  const query = "SELECT * FROM tbl_calamity";
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

// Get GeoJSON polygons
exports.getCalamityPolygons = (req, res) => {
  const query = "SELECT calamity_id AS id, calamity_type, coordinates FROM tbl_calamity WHERE coordinates IS NOT NULL";
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    const geojson = {
      type: "FeatureCollection",
      features: results
        .map(c => {
          let coords;
          try {
            coords = JSON.parse(c.coordinates);
          } catch (e) {
            console.error(`Invalid coordinates for calamity ${c.id}`, e);
            return null;
          }

          // Close polygon if needed
          if (coords.length > 2 && JSON.stringify(coords[0]) !== JSON.stringify(coords[coords.length - 1])) {
            coords.push(coords[0]);
          }

          return {
            type: "Feature",
            properties: {
              id: c.id,
              calamity_type: c.calamity_type
            },
            geometry: {
              type: "Polygon",
              coordinates: [coords]
            }
          };
        })
        .filter(f => f !== null)
    };

    res.json(geojson);
  });
};

// Get calamity types
exports.getCalamityTypes = (req, res) => {
  const query = "SELECT DISTINCT calamity_type FROM tbl_calamity";
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    const types = results.map(r => r.calamity_type);
    res.json(types);
  });
};


// Add calamity
// Add calamity
exports.addCalamity = async (req, res) => {
  try {
    const { calamity_type, description, location, coordinates, farmer_id } = req.body;

    // Validate required fields
    if (!calamity_type || !description || !coordinates || !farmer_id) {
      return res.status(400).json({ error: "Calamity type, description, coordinates, and farmer_id are required" });
    }

    // Handle file upload
    let photoPath = null;
    if (req.files && req.files.photo) {
      const photoFile = req.files.photo;
      const uploadDir = path.join(__dirname, "../../uploads");
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

      photoPath = `/uploads/${Date.now()}_${photoFile.name}`;
      await photoFile.mv(path.join(__dirname, "../../", photoPath));
    }

    // Parse coordinates safely
    let polygon;
    try {
      polygon = typeof coordinates === "string" ? JSON.parse(coordinates) : coordinates;
      if (!Array.isArray(polygon) || polygon.length < 3) {
        return res.status(400).json({ error: "Coordinates must be an array with at least 3 points" });
      }
    } catch (err) {
      return res.status(400).json({ error: "Invalid coordinates format" });
    }

    const polygonString = JSON.stringify(polygon);

    // Use first coordinate as latitude/longitude
    const firstPoint = Array.isArray(polygon[0]) ? polygon[0] : polygon;
    const latitude = firstPoint[1] || 0;
    const longitude = firstPoint[0] || 0;

    // Ensure location is not empty
    const safeLocation = location || "Unknown";

    // Log for debugging
    console.log({ calamity_type, description, safeLocation, polygonString, latitude, longitude, farmer_id, photoPath });

    // Insert into DB
    const query = `
      INSERT INTO tbl_calamity 
        (calamity_type, description, photo, location, coordinates, latitude, longitude, farmer_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [calamity_type, description, photoPath, safeLocation, polygonString, latitude, longitude, farmer_id], (err, result) => {
      if (err) {
        console.error("Insert error:", err);
        return res.status(500).json({ error: "Failed to save calamity: " + err.message });
      }
      res.status(201).json({ message: "Calamity added successfully", id: result.insertId });
    });

  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
