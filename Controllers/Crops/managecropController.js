const db = require("../../Config/db");

exports.getAllCrops = (req, res) => {
  const sql = `
    SELECT
      /* crop */
      c.id,
      c.crop_type_id,
      c.variety_id,
      c.planted_date,
      c.estimated_harvest,
      c.estimated_volume,
      c.estimated_hectares,
      c.note,
      c.latitude,
      c.longitude,
      c.created_at,
      c.farmer_id,
      c.admin_id,

      /* map barangay from farmer (since crops table has none) */
      f.barangay                AS crop_barangay,

      /* type & variety labels */
      ct.name                   AS crop_name,
      cv.name                   AS variety_name,

      /* farmer details */
      f.farmer_id               AS farmer_pk,
      f.first_name              AS farmer_first_name,
      f.last_name               AS farmer_last_name,
      f.mobile_number           AS farmer_mobile,
      f.barangay                AS farmer_barangay,
      f.full_address            AS farmer_address,
      f.created_at              AS farmer_created_at,

      /* tagged by (admin/user who created it) */
      u.first_name              AS tagger_first_name,
      u.last_name               AS tagger_last_name,
      u.email                   AS tagger_email

    FROM tbl_crops c
    LEFT JOIN tbl_crop_types     ct ON ct.id   = c.crop_type_id
    LEFT JOIN tbl_crop_varieties cv ON cv.id   = c.variety_id
    LEFT JOIN tbl_farmers         f ON f.farmer_id = c.farmer_id
    LEFT JOIN tbl_users           u ON u.id   = c.admin_id
    ORDER BY c.created_at DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("getAllCrops error:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }
    res.json(rows || []);
  });
};

exports.updateCrop = (req, res) => {
  const { id } = req.params;
  const {
    crop_type_id,
    variety_id,
    planted_date,
    estimated_harvest,
    estimated_volume,
    estimated_hectares,
    note,
    latitude,
    longitude,
    farmer_id, // optional
  } = req.body;

  // DEBUG: see what came in
  console.log("[updateCrop] id:", id, "payload:", req.body);

  const sets = [];
  const params = [];
  const push = (col, val) => { sets.push(`${col} = ?`); params.push(val); };

  if (crop_type_id !== undefined)       push("crop_type_id",       crop_type_id || null);
  if (variety_id !== undefined)         push("variety_id",         variety_id || null);
  if (planted_date !== undefined)       push("planted_date",       planted_date || null);
  if (estimated_harvest !== undefined)  push("estimated_harvest",  estimated_harvest || null);
  if (estimated_volume !== undefined)   push("estimated_volume",   estimated_volume || null);
  if (estimated_hectares !== undefined) push("estimated_hectares", estimated_hectares || null);
  if (note !== undefined)               push("note",               note || null);
  if (latitude !== undefined)           push("latitude",           latitude || null);
  if (longitude !== undefined)          push("longitude",          longitude || null);

  // farmer_id update?
  const wantsFarmerUpdate = farmer_id !== undefined;
  const numericFarmerId = Number(farmer_id);

  const finish = () => {
    if (sets.length === 0) {
      console.log("[updateCrop] no fields to update");
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    const sql = `
      UPDATE tbl_crops
      SET ${sets.join(", ")}
      WHERE id = ?
      LIMIT 1
    `;
    params.push(id);

   

    db.query(sql, params, (err, result) => {
      if (err) {
        console.error("updateCrop error:", err);
        return res.status(500).json({ success: false, message: "DB error" });
      }
      
      return res.json({
        success: true,
        affectedRows: result.affectedRows,
        changedRows: result.changedRows, // useful to know if anything actually changed
        message:
          result.changedRows > 0
            ? "Crop updated."
            : "No changes were applied (values may be identical).",
      });
    });
  };

  if (!wantsFarmerUpdate) {
    // Don’t touch farmer link
    return finish();
  }

  // User is trying to change farmer: require a real id
  if (!Number.isInteger(numericFarmerId) || numericFarmerId <= 0) {
    console.log("[updateCrop] invalid farmer_id:", farmer_id);
    return res.status(400).json({ success: false, message: "Invalid farmer_id. Pick from the dropdown." });
  }

  // Validate farmer exists
  db.query(
    "SELECT 1 FROM tbl_farmers WHERE farmer_id = ? LIMIT 1",
    [numericFarmerId],
    (err, rows) => {
      if (err) {
        console.error("farmer lookup error:", err);
        return res.status(500).json({ success: false, message: "DB error" });
      }
      if (!rows || rows.length === 0) {
        console.log("[updateCrop] farmer not found:", numericFarmerId);
        return res.status(400).json({ success: false, message: "Farmer not found" });
      }
      // OK, include farmer update
      push("farmer_id", numericFarmerId);
      return finish();
    }
  );
};


/** DELETE /api/managecrops/:id */
exports.deleteCrop = (req, res) => {
  const { id } = req.params;
  const sql = `DELETE FROM tbl_crops WHERE id = ? LIMIT 1`;
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("deleteCrop error:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }
    res.json({ success: true, affectedRows: result.affectedRows });
  });
};

exports.updateFarmerName = (req, res) => {
  const { id } = req.params; // farmer_id
  const { first_name, last_name } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, message: "farmer_id is required" });
  }

  const sets = [];
  const params = [];
  const push = (col, val) => { sets.push(`${col} = ?`); params.push(val); };

  if (first_name !== undefined) push("first_name", (first_name || "").trim());
  if (last_name  !== undefined) push("last_name",  (last_name  || "").trim());

  if (sets.length === 0) {
    return res.status(400).json({ success: false, message: "No fields to update" });
  }

  const sql = `
    UPDATE tbl_farmers
    SET ${sets.join(", ")}
    WHERE farmer_id = ?
    LIMIT 1
  `;
  params.push(id);

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error("updateFarmerName error:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }
    return res.json({
      success: true,
      affectedRows: result.affectedRows,
      changedRows: result.changedRows,
      message: result.changedRows > 0 ? "Farmer updated." : "No changes applied.",
    });
  });
};
