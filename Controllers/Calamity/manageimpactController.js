// Controllers/Calamity/manageimpactController.js
const db = require("../../Config/db"); // same as your other controllers

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

      -- calamity (radius) info - now also returns archived/deleted ones
      rc.name        AS calamity_name,
      rc.type        AS calamity_type,
      rc.started_at,
      rc.ended_at,
      rc.center_lng,
      rc.center_lat,
      rc.radius_meters,
      rc.is_deleted  AS calamity_is_deleted,
      rc.deleted_at  AS calamity_deleted_at,

      -- crop + type + variety
      c.estimated_hectares,
      c.harvested_date,
      ct.name        AS crop_type_name,
      v.name         AS variety_name,
      e.name         AS ecosystem_name,

      -- combined crop name for the card (NO "Crop #ID")
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
      ON rc.id = imp.calamity_id          -- removed AND rc.is_deleted = 0
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
      return res
        .status(500)
        .json({ message: "Failed to load calamity crop impact records." });
    }

    res.json(rows);
  });
};
