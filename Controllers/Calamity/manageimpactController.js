// Controllers/Calamity/manageimpactController.js
const db = require("../../Config/db");

// small helper for numeric fields
const toNumberOrNull = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// normalize boolean-ish to 0/1
const toBool01 = (v) => (v === true || v === 1 || v === "1" ? 1 : 0);

/**
 * ✅ GET RAW impacts (exact: SELECT * FROM tbl_calamity_crop_impacts)
 * GET /api/impacts/raw
 */
exports.getImpactRecordsRaw = (req, res) => {
  const sql = `SELECT * FROM tbl_calamity_crop_impacts ORDER BY created_at DESC, id DESC`;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("getImpactRecordsRaw error:", err);
      return res.status(500).json({ message: "Failed to load impact records (raw)." });
    }
    res.json(rows);
  });
};

/**
 * ✅ GET joined view (your original)
 * GET /api/impacts
 */
exports.getImpactRecords = (req, res) => {
  const sql = `
    SELECT
      imp.id,
      imp.calamity_id,
      imp.crop_id,
      imp.severity,
      imp.level,
      imp.distance_meters,
      imp.damage_fraction,
      imp.damaged_area_ha,
      imp.damaged_volume,
      imp.loss_value_php,
      imp.is_resolved,
      imp.resolved_at,
      imp.resolved_by,
      imp.base_area_ha,
      imp.base_volume,
      imp.base_unit,
      imp.created_at,
      imp.updated_at,

      rc.name        AS calamity_name,
      rc.type        AS calamity_type,
      rc.started_at,
      rc.ended_at,
      rc.center_lng,
      rc.center_lat,
      rc.radius_meters,
      rc.is_deleted  AS calamity_is_deleted,
      rc.deleted_at  AS calamity_deleted_at,

      c.estimated_hectares,
      c.harvested_date,
      ct.name        AS crop_type_name,
      v.name         AS variety_name,
      e.name         AS ecosystem_name,

      CASE
        WHEN ct.name IS NOT NULL AND ct.name <> ''
          AND v.name IS NOT NULL AND v.name <> ''
          THEN CONCAT(ct.name, ' (', v.name, ')')
        WHEN ct.name IS NOT NULL AND ct.name <> ''
          THEN ct.name
        WHEN v.name IS NOT NULL AND v.name <> ''
          THEN v.name
        ELSE 'Unknown crop'
      END AS crop_name

    FROM tbl_calamity_crop_impacts AS imp
    LEFT JOIN tbl_radius_calamities AS rc
      ON rc.id = imp.calamity_id
    LEFT JOIN tbl_crops AS c
      ON c.id = imp.crop_id AND c.is_deleted = 0
    LEFT JOIN tbl_crop_types AS ct
      ON ct.id = c.crop_type_id
    LEFT JOIN tbl_crop_varieties AS v
      ON v.id = c.variety_id
    LEFT JOIN tbl_ecosystems AS e
      ON e.id = c.ecosystem_id
    ORDER BY imp.created_at DESC, imp.id DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("getImpactRecords error:", err);
      return res.status(500).json({ message: "Failed to load calamity crop impact records." });
    }
    res.json(rows);
  });
};

/**
 * ✅ SUMMARY for graphs
 * GET /api/impacts/summary?year=2025&barangay=Foo&type=Flood
 *
 * What it returns:
 * {
 *   totalAffectedArea: number,
 *   affectedFarmers: number,
 *   byType: [{ calamity_type, total_area, incidents }]
 * }
 */
exports.getCalamitySummaryFromImpacts = (req, res) => {
  const { year, barangay, type } = req.query;

  // NOTE:
  // - We try to read barangay from crops table with flexible columns.
  // - If your tbl_crops column name is different, update the COALESCE(...) below.
  const filters = [];
  const params = [];

  if (year && year !== "all") {
    filters.push(`YEAR(COALESCE(rc.started_at, imp.created_at)) = ?`);
    params.push(Number(year));
  }

  if (barangay && barangay !== "all") {
    filters.push(`
      COALESCE(
        c.barangay,
        c.barangay_name,
        c.brgy_name,
        c.farmer_barangay
      ) = ?
    `);
    params.push(String(barangay));
  }

  if (type && type !== "all") {
    filters.push(`COALESCE(rc.type, 'Unknown') = ?`);
    params.push(String(type));
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const sql = `
    SELECT
      COALESCE(rc.type, 'Unknown') AS calamity_type,
      COUNT(*) AS incidents,
      SUM(COALESCE(imp.damaged_area_ha, imp.base_area_ha, 0)) AS total_area,
      COUNT(DISTINCT c.farmer_id) AS affected_farmers
    FROM tbl_calamity_crop_impacts imp
    LEFT JOIN tbl_radius_calamities rc
      ON rc.id = imp.calamity_id
    LEFT JOIN tbl_crops c
      ON c.id = imp.crop_id AND c.is_deleted = 0
    ${where}
    GROUP BY COALESCE(rc.type, 'Unknown')
    ORDER BY total_area DESC
  `;

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("getCalamitySummaryFromImpacts error:", err);
      return res.status(500).json({ message: "Failed to load calamity summary." });
    }

    const byType = (rows || []).map((r) => ({
      calamity_type: r.calamity_type,
      incidents: Number(r.incidents || 0),
      total_area: Number(r.total_area || 0),
    }));

    const totalAffectedArea = byType.reduce((sum, r) => sum + Number(r.total_area || 0), 0);

    // sum of affected_farmers across groups can double count
    // so we re-run a distinct farmer query (safe + accurate).
    const farmerSql = `
      SELECT COUNT(DISTINCT c.farmer_id) AS affectedFarmers
      FROM tbl_calamity_crop_impacts imp
      LEFT JOIN tbl_radius_calamities rc ON rc.id = imp.calamity_id
      LEFT JOIN tbl_crops c ON c.id = imp.crop_id AND c.is_deleted = 0
      ${where}
    `;

    db.query(farmerSql, params, (err2, farmerRows) => {
      if (err2) {
        console.error("affectedFarmers error:", err2);
        // still return usable data
        return res.json({
          totalAffectedArea,
          affectedFarmers: 0,
          byType,
        });
      }

      return res.json({
        totalAffectedArea,
        affectedFarmers: Number(farmerRows?.[0]?.affectedFarmers || 0),
        byType,
      });
    });
  });
};

/**
 * ✅ TIMELINE for graphs
 * GET /api/impacts/timeline?year=2025&barangay=Foo&type=Flood
 *
 * Returns:
 * [{ month: "YYYY-MM", incidents: number, area: number }]
 */
exports.getCalamityTimelineFromImpacts = (req, res) => {
  const { year, barangay, type } = req.query;

  const filters = [];
  const params = [];

  if (year && year !== "all") {
    filters.push(`YEAR(COALESCE(rc.started_at, imp.created_at)) = ?`);
    params.push(Number(year));
  }

  if (barangay && barangay !== "all") {
    filters.push(`
      COALESCE(
        c.barangay,
        c.barangay_name,
        c.brgy_name,
        c.farmer_barangay
      ) = ?
    `);
    params.push(String(barangay));
  }

  if (type && type !== "all") {
    filters.push(`COALESCE(rc.type, 'Unknown') = ?`);
    params.push(String(type));
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const sql = `
    SELECT
      DATE_FORMAT(COALESCE(rc.started_at, imp.created_at), '%Y-%m') AS month,
      COUNT(*) AS incidents,
      SUM(COALESCE(imp.damaged_area_ha, imp.base_area_ha, 0)) AS area
    FROM tbl_calamity_crop_impacts imp
    LEFT JOIN tbl_radius_calamities rc
      ON rc.id = imp.calamity_id
    LEFT JOIN tbl_crops c
      ON c.id = imp.crop_id AND c.is_deleted = 0
    ${where}
    GROUP BY DATE_FORMAT(COALESCE(rc.started_at, imp.created_at), '%Y-%m')
    ORDER BY month ASC
  `;

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("getCalamityTimelineFromImpacts error:", err);
      return res.status(500).json({ message: "Failed to load calamity timeline." });
    }

    res.json(
      (rows || []).map((r) => ({
        month: String(r.month),
        incidents: Number(r.incidents || 0),
        area: Number(r.area || 0),
      }))
    );
  });
};

// ✅ UPDATE one impact record
exports.updateImpactRecord = (req, res) => {
  const { id } = req.params;

  const {
    severity,
    level,
    distance_meters,
    damage_fraction,
    damaged_area_ha,
    damaged_volume,
    loss_value_php,
    is_resolved,
    resolved_at,
    resolved_by,
    base_area_ha,
    base_volume,
    base_unit,
  } = req.body;

  const sql = `
    UPDATE tbl_calamity_crop_impacts
    SET
      severity         = ?,
      level            = ?,
      distance_meters  = ?,
      damage_fraction  = ?,
      damaged_area_ha  = ?,
      damaged_volume   = ?,
      loss_value_php   = ?,
      is_resolved      = ?,
      resolved_at      = ?,
      resolved_by      = ?,
      base_area_ha     = ?,
      base_volume      = ?,
      base_unit        = ?,
      updated_at       = NOW()
    WHERE id = ?
  `;

  const values = [
    toNumberOrNull(severity),
    toNumberOrNull(level),
    toNumberOrNull(distance_meters),
    toNumberOrNull(damage_fraction),
    toNumberOrNull(damaged_area_ha),
    toNumberOrNull(damaged_volume),
    toNumberOrNull(loss_value_php),
    toBool01(is_resolved),
    resolved_at || null,
    resolved_by || null,
    toNumberOrNull(base_area_ha),
    toNumberOrNull(base_volume),
    base_unit || null,
    id,
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("updateImpactRecord error:", err);
      return res.status(500).json({ message: "Failed to update impact record." });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Impact record not found." });
    }
    return res.json({ message: "Impact record updated successfully.", id });
  });
};

// ✅ DELETE one impact record
exports.deleteImpactRecord = (req, res) => {
  const { id } = req.params;

  const sql = "DELETE FROM tbl_calamity_crop_impacts WHERE id = ?";

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("deleteImpactRecord error:", err);
      return res.status(500).json({ message: "Failed to delete impact record." });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Impact record not found." });
    }
    return res.json({ message: "Impact record deleted successfully.", id });
  });
};
