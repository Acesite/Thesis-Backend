// controllers/graphController.js
const db = require("../../Config/db");

const getCropTypeCounts = (req, res) => {
  const { barangay } = req.query;

  let sql = `
    SELECT ct.name AS crop_type, COUNT(c.id) AS total
    FROM tbl_crops c
    JOIN tbl_crop_types ct ON c.crop_type_id = ct.id
  `;

  const values = [];

  if (barangay && barangay !== "all") {
    sql += " WHERE c.barangay = ?";
    values.push(barangay);
  }

  sql += " GROUP BY ct.name";

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error("Error fetching graph data:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
};

const getTotalCrops = (req, res) => {
  const { barangay } = req.query;

  let sql = `SELECT COUNT(*) AS total FROM tbl_crops`;
  const values = [];

  if (barangay && barangay !== "all") {
    sql += " WHERE barangay = ?";
    values.push(barangay);
  }

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error("Error fetching total crops:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results[0]);
  });
};

module.exports = { getCropTypeCounts, getTotalCrops };



