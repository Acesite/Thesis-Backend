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

/**
 * PUT /api/managecrops/:id
 * Allows updating crop fields and changing the linked farmer via farmer_id
 */
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
    farmer_id,       // optional: re-link to a different farmer
  } = req.body;

  const sql = `
    UPDATE tbl_crops
    SET
      crop_type_id       = ?,
      variety_id         = ?,
      planted_date       = ?,
      estimated_harvest  = ?,
      estimated_volume   = ?,
      estimated_hectares = ?,
      note               = ?,
      latitude           = ?,
      longitude          = ?,
      farmer_id          = ?
    WHERE id = ?
    LIMIT 1
  `;

  db.query(
    sql,
    [
      crop_type_id || null,
      variety_id || null,
      planted_date || null,
      estimated_harvest || null,
      estimated_volume || null,
      estimated_hectares || null,
      note || null,
      latitude || null,
      longitude || null,
      farmer_id || null,
      id,
    ],
    (err, result) => {
      if (err) {
        console.error("updateCrop error:", err);
        return res.status(500).json({ success: false, message: "DB error" });
      }
      res.json({ success: true, affectedRows: result.affectedRows });
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
