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
exports.addCalamity = async (req, res) => {
  try {
    const { calamity_type, description, location, coordinates, admin_id } = req.body;

    if (!calamity_type || !description || !coordinates) {
      return res.status(400).json({ error: "calamity_type, description, and coordinates are required" });
    }

    const adminId = Number(admin_id);
    if (!adminId) {
      return res.status(400).json({ error: "admin_id is required" });
    }

    // optional photo
    let photoPath = null;
    if (req.files?.photo) {
      const photoFile = req.files.photo;
      const uploadDir = path.join(__dirname, "../../uploads");
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
      photoPath = `/uploads/${Date.now()}_${photoFile.name}`;
      await photoFile.mv(path.join(__dirname, "../../", photoPath));
    }

    // parse coords
    const polygon = typeof coordinates === "string" ? JSON.parse(coordinates) : coordinates;
    if (!Array.isArray(polygon) || polygon.length < 3) {
      return res.status(400).json({ error: "Coordinates must be an array with at least 3 points" });
    }

    const [lon, lat] = polygon[0];
    const latitude = Number(lat) || 0;
    const longitude = Number(lon) || 0;
    const safeLocation = location || "Unknown";

    const sql = `
      INSERT INTO tbl_calamity
        (calamity_type, description, photo, location, coordinates, latitude, longitude, admin_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      sql,
      [
        calamity_type,
        description,
        photoPath,
        safeLocation,
        JSON.stringify(polygon), // store as JSON string
        latitude,
        longitude,
        adminId
      ],
      (err, result) => {
        if (err) {
          console.error("Insert error:", err);
          return res.status(500).json({ error: "Failed to save calamity: " + err.message });
        }

        // ✅ Return the full created object; coordinates as ARRAY for the client
        return res.status(201).json({
          id: result.insertId,
          calamity_type,
          description,
          photo: photoPath,
          location: safeLocation,
          coordinates: polygon,
          latitude,
          longitude,
          admin_id: adminId,
        });
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


