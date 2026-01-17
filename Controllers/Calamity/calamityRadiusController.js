// controllers/calamityRadiusController.js
const db = require("../../Config/db");

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

// NEW: get all saved calamity radii
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
      admin_id
    FROM tbl_radius_calamities
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

module.exports = {
  createCalamityRadius,
  getAllCalamityRadius,
};
