const db = require("../Config/db");


// Get all crops
exports.getAllCrops = (req, res) => {
  const sql = `
  SELECT 
  tbl_crops.*, 
  tbl_crop_types.name AS crop_name,
  tbl_crop_varieties.name AS variety_name, -- ✅ Add variety name
  tbl_users.first_name, 
  tbl_users.last_name 
FROM tbl_crops
LEFT JOIN tbl_crop_types ON tbl_crops.crop_type_id = tbl_crop_types.id
LEFT JOIN tbl_crop_varieties ON tbl_crops.variety_id = tbl_crop_varieties.id -- ✅ Join to get name
LEFT JOIN tbl_users ON tbl_crops.admin_id = tbl_users.id
ORDER BY tbl_crops.id DESC

  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching crops:", err);
      return res.status(500).json({ message: "Server error" });
    }
    res.status(200).json(results);
  });
};



// Delete a crop by ID
exports.deleteCrop = (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM tbl_crops WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Error deleting crop:", err);
      return res.status(500).json({ message: "Server error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Crop not found" });
    }
    res.status(200).json({ message: "✅ Crop deleted successfully" });
  });
};


// managecropController.js
exports.updateCrop = (req, res) => {
  const { id } = req.params;
  const {
    crop_type_id,
    variety_id, // ✅ get the ID
    planted_date,
    estimated_harvest,
    estimated_volume,
    estimated_hectares,
    note
  } = req.body;
  
  const sql = `
    UPDATE tbl_crops 
    SET crop_type_id = ?, variety_id = ?, planted_date = ?, estimated_harvest = ?, estimated_volume = ?, estimated_hectares = ?, note = ?
    WHERE id = ?
  `;
  const values = [crop_type_id, variety_id, planted_date, estimated_harvest, estimated_volume, estimated_hectares, note, id];
  
  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Error updating crop:", err);
      return res.status(500).json({ message: "Server error" });
    }
    res.status(200).json({ message: "Crop updated successfully" });
  });
};

