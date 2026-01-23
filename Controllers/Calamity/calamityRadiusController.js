// Controllers/Calamity/calamityRadiusController.js
const db = require("../../Config/db");
const fs = require("fs");
const path = require("path");

/**
 * Create a calamity radius record
 * POST /api/calamityradius
 */
const createCalamityRadius = (req, res) => {
  const {
    name,
    type,
    description,
    center_lng,
    center_lat,
    radius_meters,
    started_at,
    ended_at,
    admin_id,
  } = req.body;

  if (center_lng == null || center_lat == null || radius_meters == null) {
    return res.status(400).json({ message: "Missing radius center or size" });
  }

  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }

  const adminId = parseInt(admin_id, 10);
  if (!adminId) {
    return res.status(400).json({ message: "Invalid admin_id" });
  }

  const checkAdminQuery = "SELECT id FROM tbl_users WHERE id = ?";
  db.query(checkAdminQuery, [adminId], (err, adminRows) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database error during admin check" });
    }

    if (!adminRows || adminRows.length === 0) {
      return res.status(400).json({ message: "Invalid admin_id" });
    }

    const insertSql = `
      INSERT INTO tbl_radius_calamities
        (name, type, description, center_lng, center_lat, radius_meters,
        started_at, ended_at, admin_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      name,
      type || null,
      description || null,
      center_lng,
      center_lat,
      radius_meters,
      started_at || null,
      ended_at || null,
      adminId,
    ];

    db.query(insertSql, params, (err, result) => {
      if (err) {
        console.error("Insert calamity radius error:", err);
        return res
          .status(500)
          .json({ message: "Failed to save calamity radius" });
      }

      const insertId = result.insertId;
      if (!insertId || insertId === 0) {
        console.error("Insert failed: insertId is invalid");
        return res
          .status(500)
          .json({ message: "Insert failed, invalid insertId" });
      }

      return res.status(201).json({
        id: insertId,
        name,
        type,
        description,
        center_lng,
        center_lat,
        radius_meters,
        started_at,
        ended_at,
        admin_id: adminId,
      });
    });
  });
};


const getAllCalamityRadius = (req, res) => {
  const sql = `
    SELECT
      id,
      name,
      type,
      description,
      center_lng,
      center_lat,
      radius_meters,
      started_at,
      ended_at,
      admin_id,
      is_deleted,
      deleted_at,
      deleted_by
    FROM tbl_radius_calamities
    WHERE is_deleted = 0
    ORDER BY started_at DESC, id DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Error fetching calamity radii:", err);
      return res
        .status(500)
        .json({ message: "Failed to fetch calamity radii" });
    }
    return res.json(rows || []);
  });
};



const addCalamityPolygonPhoto = (req, res) => {
  const calamityId = parseInt(req.params.id, 10);
  const { crop_id, caption, taken_at, uploaded_by } = req.body;

  if (!calamityId || !crop_id) {
    return res
      .status(400)
      .json({ message: "calamity_id (URL) and crop_id (body) are required" });
  }

  if (!req.files || !req.files.photo) {
    return res.status(400).json({ message: "No photo file uploaded" });
  }

  const cropId = parseInt(crop_id, 10);
  if (!cropId) {
    return res.status(400).json({ message: "Invalid crop_id" });
  }

  const photoFile = req.files.photo;

  // ensure upload directory
  const uploadDir = path.join(__dirname, "..", "..", "uploads", "calamity");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = path.extname(photoFile.name);
  const base = path
    .basename(photoFile.name, ext)
    .replace(/\s+/g, "_")
    .toLowerCase();
  const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const filename = `${base}-${unique}${ext}`;

  // path stored in DB (relative to project root)
  const relativePath = path.join("uploads", "calamity", filename).replace(
    /\\/g,
    "/"
  );
  const targetPath = path.join(uploadDir, filename);

  // move file to disk
  photoFile.mv(targetPath, (moveErr) => {
    if (moveErr) {
      console.error("Error saving photo to disk:", moveErr);
      return res.status(500).json({ message: "Failed to save photo file" });
    }

    const sql = `
      INSERT INTO tbl_calamity_crop_photos
        (calamity_id, crop_id, photo_path, caption, taken_at, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const params = [
      calamityId,
      cropId,
      relativePath,
      caption || null,
      taken_at || null,
      uploaded_by ? parseInt(uploaded_by, 10) : null,
    ];

    db.query(sql, params, (err, result) => {
      if (err) {
        console.error("Error saving calamity photo:", err);
        return res
          .status(500)
          .json({ message: "Failed to save calamity photo in DB" });
      }

      const photoUrl = `http://localhost:5000/${relativePath}`;

      return res.status(201).json({
        id: result.insertId,
        calamity_id: calamityId,
        crop_id: cropId,
        caption: caption || null,
        taken_at: taken_at || null,
        photo_url: photoUrl,
      });
    });
  });
};

/**
 * Get photos for one calamity + crop
 * GET /api/calamityradius/:id/photos?crop_id=123
 */
const getCalamityPolygonPhotos = (req, res) => {
  const calamityId = parseInt(req.params.id, 10);
  const cropId = parseInt(req.query.crop_id, 10);

  if (!calamityId || !cropId) {
    return res
      .status(400)
      .json({ message: "calamity_id (URL) and crop_id (query) are required" });
  }

  const sql = `
    SELECT id, photo_path, caption, taken_at, uploaded_at
    FROM tbl_calamity_crop_photos
    WHERE calamity_id = ? AND crop_id = ?
    ORDER BY uploaded_at DESC
  `;

  db.query(sql, [calamityId, cropId], (err, rows) => {
    if (err) {
      console.error("Error fetching calamity photos:", err);
      return res
        .status(500)
        .json({ message: "Failed to fetch calamity photos" });
    }

    const photos = (rows || []).map((r) => ({
      ...r,
      photo_url: `http://localhost:5000/${r.photo_path}`,
    }));

    res.json(photos);
  });
};

const upsertCalamityImpact = (req, res) => {
  const calamityId = parseInt(req.params.id, 10);
  const {
    crop_id,
    severity,
    level,
    distance_meters,
    damage_fraction,
    damaged_area_ha,
    damaged_volume,
    loss_value_php,
    base_area_ha,
    base_volume,
    base_unit,
  } = req.body;

  if (!calamityId || !crop_id) {
    return res
      .status(400)
      .json({ message: "calamity_id (URL) and crop_id (body) are required" });
  }

  if (!severity || !level) {
    return res
      .status(400)
      .json({ message: "severity and level are required" });
  }

  const cropId = parseInt(crop_id, 10);
  if (!cropId) {
    return res.status(400).json({ message: "Invalid crop_id" });
  }

  const sql = `
    INSERT INTO tbl_calamity_crop_impacts
      (
        calamity_id, crop_id,
        severity, level,
        distance_meters, damage_fraction,
        damaged_area_ha, damaged_volume, loss_value_php,
        base_area_ha, base_volume, base_unit
      )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      severity = VALUES(severity),
      level = VALUES(level),
      distance_meters = VALUES(distance_meters),
      damage_fraction = VALUES(damage_fraction),
      damaged_area_ha = VALUES(damaged_area_ha),
      damaged_volume = VALUES(damaged_volume),
      loss_value_php = VALUES(loss_value_php),
      base_area_ha = VALUES(base_area_ha),
      base_volume = VALUES(base_volume),
      base_unit = VALUES(base_unit),
      updated_at = CURRENT_TIMESTAMP
  `;

  const params = [
    calamityId,
    cropId,
    severity,
    level,
    distance_meters != null ? Number(distance_meters) : null,
    damage_fraction != null ? Number(damage_fraction) : null,
    damaged_area_ha != null ? Number(damaged_area_ha) : null,
    damaged_volume != null ? Number(damaged_volume) : null,
    loss_value_php != null ? Number(loss_value_php) : null,
    base_area_ha != null ? Number(base_area_ha) : null,
    base_volume != null ? Number(base_volume) : null,
    base_unit || null,
  ];

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error("Error saving calamity impact:", err);
      return res
        .status(500)
        .json({ message: "Failed to save calamity impact" });
    }

    return res.status(200).json({
      message: "Calamity impact saved",
      calamity_id: calamityId,
      crop_id: cropId,
    });
  });
};

const deleteCalamityRadius = (req, res) => {
  const calamityId = parseInt(req.params.id, 10);
  const { deleted_by } = req.body; // optional, ID of admin performing the delete

  if (!calamityId) {
    return res.status(400).json({ message: "Invalid calamity radius id" });
  }

  const deletedBy = deleted_by ? parseInt(deleted_by, 10) : null;

  const sql = `
    UPDATE tbl_radius_calamities
    SET
      is_deleted = 1,
      deleted_at = CURRENT_TIMESTAMP,
      deleted_by = ?
    WHERE id = ? AND is_deleted = 0
  `;

  db.query(sql, [deletedBy, calamityId], (err, result) => {
    if (err) {
      console.error("Error soft deleting calamity radius:", err);
      return res
        .status(500)
        .json({ message: "Failed to delete calamity radius" });
    }

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Calamity radius not found or already deleted",
      });
    }

    return res.json({
      message: "Calamity radius deleted (soft)",
      id: calamityId,
    });
  });
};


const resolveCalamityImpact = (req, res) => {
  const calamityId = parseInt(req.params.id, 10);
  const { crop_id, resolved_by } = req.body;

  if (!calamityId || !crop_id) {
    return res
      .status(400)
      .json({ message: "calamity_id (URL) and crop_id (body) are required" });
  }

  const cropId = parseInt(crop_id, 10);
  if (!cropId) {
    return res.status(400).json({ message: "Invalid crop_id" });
  }

  const resolvedBy = resolved_by ? parseInt(resolved_by, 10) : null;

  const sql = `
    UPDATE tbl_calamity_crop_impacts
    SET
      is_resolved = 1,
      resolved_at = CURRENT_TIMESTAMP,
      resolved_by = ?
    WHERE calamity_id = ? AND crop_id = ?
  `;

  db.query(sql, [resolvedBy, calamityId, cropId], (err, result) => {
    if (err) {
      console.error("Error resolving calamity impact:", err);
      return res.status(500).json({ message: "Failed to resolve calamity impact" });
    }

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "No impact record found for this crop under this calamity.",
      });
    }

    return res.json({
      message: "Calamity impact resolved",
      calamity_id: calamityId,
      crop_id: cropId,
    });
  });
};

const getCalamityHistoryForCrop = (req, res) => {
  const cropId = parseInt(req.params.cropId, 10);
  if (!cropId) {
    return res.status(400).json({ message: "Invalid cropId" });
  }

  const sql = `
    SELECT
      i.calamity_id,
      i.crop_id,
      i.severity,
      i.level,
      i.distance_meters,
      i.damage_fraction,
      i.damaged_area_ha,
      i.damaged_volume,
      i.loss_value_php,
      i.is_resolved,
      i.resolved_at,
      i.resolved_by,
      i.created_at,
      i.updated_at,
      c.name AS calamity_name,
      c.type AS calamity_type,
      c.started_at,
      c.ended_at
    FROM tbl_calamity_crop_impacts i
    JOIN tbl_radius_calamities c
      ON c.id = i.calamity_id
    WHERE i.crop_id = ?
    ORDER BY c.started_at DESC, i.created_at DESC
  `;

  db.query(sql, [cropId], (err, rows) => {
    if (err) {
      console.error("Error fetching calamity history:", err);
      return res
        .status(500)
        .json({ message: "Failed to fetch calamity history" });
    }

    res.json(rows || []);
  });
};

const getCalamityImpactsByCalamity = (req, res) => {
  const calamityId = parseInt(req.params.id, 10);
  if (!calamityId) {
    return res.status(400).json({ message: "Invalid calamity radius id" });
  }

  const sql = `
    SELECT
      id,
      calamity_id,
      crop_id,
      severity,
      level,
      is_resolved,
      resolved_at,
      resolved_by,
      damaged_area_ha,
      damaged_volume,
      loss_value_php,
      updated_at,
      created_at
    FROM tbl_calamity_crop_impacts
    WHERE calamity_id = ?
    ORDER BY updated_at DESC, id DESC
  `;

  db.query(sql, [calamityId], (err, rows) => {
    if (err) {
      console.error("Error fetching calamity impacts:", err);
      return res.status(500).json({ message: "Failed to fetch calamity impacts" });
    }
    return res.json(rows || []);
  });
};

// ==================== NEW FUNCTIONS FOR FRONTEND TABLE ====================

/**
 * Get ALL calamity crop impact records (for the frontend table)
 * GET /api/calamityradius/impact-records
 */
const getAllCalamityCropImpacts = (req, res) => {
  console.log("Fetching all calamity crop impacts...");
  
  // First, check if the table exists
  const checkTableSql = "SHOW TABLES LIKE 'tbl_calamity_crop_impacts'";
  db.query(checkTableSql, (err, tables) => {
    if (err) {
      console.error("Error checking table existence:", err);
      return res.status(500).json({ 
        message: "Database error checking table", 
        error: err.message 
      });
    }
    
    if (tables.length === 0) {
      console.error("Table tbl_calamity_crop_impacts does not exist");
      return res.status(404).json({ 
        message: "Table tbl_calamity_crop_impacts not found",
        suggestion: "Check if table name is correct or create the table" 
      });
    }
    
    console.log("Table exists, fetching data...");
    
    // Try the full query with joins first
    const fullSql = `
      SELECT 
        i.*,
        c.name AS calamity_name,
        c.type AS calamity_type,
        c.started_at,
        c.ended_at,
        c.center_lng,
        c.center_lat,
        c.radius_meters,
        ct.crop_name,
        ct.variety_name,
        f.first_name,
        f.last_name,
        f.mobile_number,
        f.barangay AS farmer_barangay
      FROM tbl_calamity_crop_impacts i
      LEFT JOIN tbl_radius_calamities c ON i.calamity_id = c.id AND c.is_deleted = 0
      LEFT JOIN tbl_crop_type ct ON i.crop_id = ct.id
      LEFT JOIN tbl_farmer f ON i.farmer_id = f.id
      ORDER BY i.created_at DESC
    `;

    db.query(fullSql, (err, rows) => {
      if (err) {
        console.error("Error in full query with joins:", err);
        console.log("Trying simpler query...");
        
        // If joins fail, try a simple query
        const simpleSql = "SELECT * FROM tbl_calamity_crop_impacts ORDER BY created_at DESC";
        db.query(simpleSql, (err2, rows2) => {
          if (err2) {
            console.error("Error in simple query:", err2);
            return res.status(500).json({ 
              message: "Failed to fetch calamity crop impacts", 
              error: err2.message 
            });
          }
          
          console.log(`Successfully fetched ${rows2.length} records (simple query)`);
          return res.json(rows2 || []);
        });
        return;
      }
      
      console.log(`Successfully fetched ${rows.length} records (full query with joins)`);
      
      // Format the results for frontend
      const formattedResults = (rows || []).map(row => ({
        id: row.id,
        calamity_id: row.calamity_id,
        crop_id: row.crop_id,
        farmer_id: row.farmer_id,
        
        // Calamity details
        calamity_name: row.calamity_name,
        calamity_type: row.calamity_type,
        name: row.calamity_name || row.calamity_type,
        started_at: row.started_at,
        ended_at: row.ended_at,
        center_lng: row.center_lng,
        center_lat: row.center_lat,
        radius_meters: row.radius_meters,
        
        // Crop details
        crop_name: row.crop_name,
        crop_type_name: row.crop_name,
        variety_name: row.variety_name,
        crop: row.crop_name || row.variety_name,
        
        // Farmer details
        farmer_name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        mobile_number: row.mobile_number,
        farmer_barangay: row.farmer_barangay,
        
        // Impact metrics
        severity: row.severity,
        level: row.level,
        distance_meters: row.distance_meters,
        damage_fraction: row.damage_fraction,
        damaged_area_ha: row.damaged_area_ha,
        damaged_volume: row.damaged_volume,
        loss_value_php: row.loss_value_php,
        base_area_ha: row.base_area_ha,
        base_volume: row.base_volume,
        base_unit: row.base_unit,
        
        // Resolution info
        is_resolved: row.is_resolved,
        resolved_at: row.resolved_at,
        resolved_by: row.resolved_by,
        status: row.is_resolved ? 'Resolved' : 'Ongoing',
        
        // Timestamps
        created_at: row.created_at,
        updated_at: row.updated_at
      }));

      return res.json(formattedResults);
    });
  });
};

/**
 * Test endpoint to verify table structure and connectivity
 * GET /api/calamityradius/test-impact-table
 */
const testImpactTable = (req, res) => {
  console.log("Testing impact table connection...");
  
  // Check if table exists
  const checkTableSql = "SHOW TABLES LIKE 'tbl_calamity_crop_impacts'";
  db.query(checkTableSql, (err, tables) => {
    if (err) {
      console.error("Error checking table:", err);
      return res.status(500).json({ 
        success: false, 
        message: "Database error", 
        error: err.message 
      });
    }
    
    const tableExists = tables.length > 0;
    
    if (!tableExists) {
      return res.json({
        success: false,
        tableExists: false,
        message: "Table 'tbl_calamity_crop_impacts' does not exist",
        suggestion: "Create the table or check the name"
      });
    }
    
    // Get table structure
    const describeSql = "DESCRIBE tbl_calamity_crop_impacts";
    db.query(describeSql, (err2, columns) => {
      if (err2) {
        console.error("Error describing table:", err2);
        return res.json({
          success: false,
          tableExists: true,
          message: "Table exists but cannot describe structure",
          error: err2.message
        });
      }
      
      // Get sample data
      const sampleSql = "SELECT * FROM tbl_calamity_crop_impacts LIMIT 5";
      db.query(sampleSql, (err3, sampleData) => {
        if (err3) {
          console.error("Error fetching sample data:", err3);
          return res.json({
            success: false,
            tableExists: true,
            columns: columns.map(col => col.Field),
            message: "Table exists but cannot fetch data",
            error: err3.message
          });
        }
        
        // Get total count
        const countSql = "SELECT COUNT(*) as total FROM tbl_calamity_crop_impacts";
        db.query(countSql, (err4, countResult) => {
          const total = countResult && countResult[0] ? countResult[0].total : 0;
          
          return res.json({
            success: true,
            tableExists: true,
            tableName: 'tbl_calamity_crop_impacts',
            columnCount: columns.length,
            columns: columns.map(col => col.Field),
            totalRecords: total,
            sampleDataCount: sampleData.length,
            sampleData: sampleData,
            apiEndpoint: "/api/calamityradius/impact-records"
          });
        });
      });
    });
  });
};

// ==================== EXPORTS ====================

module.exports = {
  createCalamityRadius,
  getAllCalamityRadius,
  addCalamityPolygonPhoto,
  getCalamityPolygonPhotos,
  upsertCalamityImpact,
  deleteCalamityRadius,
  resolveCalamityImpact,
  getCalamityHistoryForCrop,
  getCalamityImpactsByCalamity,
  
  // NEW FUNCTIONS FOR FRONTEND
  getAllCalamityCropImpacts,    // Main endpoint for frontend table
  testImpactTable               // Test endpoint
};