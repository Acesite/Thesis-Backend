// Controllers/Calamity/managecalamityController.js
const db = require("../../Config/db");

/* Small promise wrapper so we can await callback-style query() */
const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

/* -------------------- helpers -------------------- */
const severityToNumber = (sevText) => {
  if (!sevText) return 0;
  const s = String(sevText).toLowerCase();
  if (s === "severe") return 6;
  if (s === "high") return 5;
  if (s === "moderate") return 3;
  if (s === "low") return 1;
  return 0;
};

const toArrayFromCSV = (v) =>
  !v ? [] : Array.isArray(v) ? v : String(v).split(",").map(s => s.trim()).filter(Boolean);

const mapRow = (r) => ({
  id: r.calamity_id,
  incident_type: r.calamity_type,
  severity_text: r.severity_level,
  severity: severityToNumber(r.severity_level),
  note: r.description,

  ecosystem_id: r.ecosystem_id,
  crop_type_id: r.crop_type_id,
  crop_variety_id: r.crop_variety_id,

  ecosystem_name: r.ecosystem_name || null,
  crop_type_name: r.crop_type_name || null,
  variety_name: r.variety_name || null,

  affected_area: r.affected_area,
  crop_stage: r.crop_stage,
  photos: toArrayFromCSV(r.photo),
  location: r.location,
  barangay: r.barangay,
  reported_at: r.date_reported,
  status: r.status,
  latitude: r.latitude != null ? Number(r.latitude) : null,
  longitude: r.longitude != null ? Number(r.longitude) : null,
  coordinates: r.coordinates,
});

/* -------------------- controllers -------------------- */

exports.listCalamities = async (_req, res) => {
  try {
    const sql = `
      SELECT
        c.calamity_id, c.admin_id, c.calamity_type, c.severity_level, c.description,
        c.ecosystem_id, c.crop_type_id, c.crop_variety_id, c.affected_area, c.crop_stage,
        c.photo, c.location, c.barangay, c.date_reported, c.status, c.latitude, c.longitude, c.coordinates,
        eco.name AS ecosystem_name,
        ct.name  AS crop_type_name,
        cv.name  AS variety_name
      FROM tbl_calamity c
      LEFT JOIN tbl_ecosystems     AS eco ON eco.id = c.ecosystem_id
      LEFT JOIN tbl_crop_types     AS ct  ON ct.id  = c.crop_type_id
      LEFT JOIN tbl_crop_varieties AS cv  ON cv.id  = c.crop_variety_id
      ORDER BY c.date_reported DESC, c.calamity_id DESC
    `;
    const rows = await query(sql);
    res.json(rows.map(mapRow));
  } catch (err) {
    console.error("listCalamities error:", err);
    res.status(500).json({ message: "Failed to fetch calamities." });
  }
};

exports.getCalamityById = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT c.*
         , t.name  AS type_name
         , v.name  AS variety_name
         , e.name  AS ecosystem_name
    FROM tbl_calamities c
    LEFT JOIN tbl_crop_types t   ON t.id = c.crop_type_id
    LEFT JOIN tbl_crop_varieties v ON v.id = c.crop_variety_id
    LEFT JOIN tbl_ecosystems e   ON e.id = c.ecosystem_id
    WHERE c.id = ?
    LIMIT 1
  `;
  db.query(sql, [id], (err, rows) => {
    if (err) return res.status(500).json({ success:false, message:"DB error" });
    res.json(rows[0] || null);
  });
};

exports.listDistinctTypes = async (_req, res) => {
  try {
    const rows = await query(`
      SELECT DISTINCT calamity_type AS name
      FROM tbl_calamity
      WHERE calamity_type IS NOT NULL AND calamity_type <> ''
      ORDER BY calamity_type ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error("listDistinctTypes error:", err);
    res.status(500).json({ message: "Failed to fetch types." });
  }
};

exports.createCalamity = async (req, res) => {
  try {
    const b = req.body || {};
    const severity_level =
      b.severity_text ||
      (b.severity >= 6 ? "Severe" :
       b.severity >= 5 ? "High" :
       b.severity >= 3 ? "Moderate" :
       b.severity >= 1 ? "Low" : null);

    const photo = Array.isArray(b.photos) ? b.photos.join(",") : (b.photo || null);

    const payload = {
      admin_id: b.admin_id || null,
      calamity_type: b.incident_type || null,
      severity_level,
      description: b.note || null,
      ecosystem_id: b.ecosystem_id || null,
      crop_type_id: b.crop_type_id || null,
      crop_variety_id: b.crop_variety_id || null,
      affected_area: b.affected_area || null,
      crop_stage: b.crop_stage || null,
      photo,
      location: b.location || null,
      barangay: b.barangay || null,
      date_reported: b.reported_at || new Date(),
      status: b.status || "Pending",
      latitude: b.latitude || null,
      longitude: b.longitude || null,
      coordinates: b.coordinates || null,
    };

    const result = await query(`INSERT INTO tbl_calamity SET ?`, payload);
    const insertedId = result.insertId;

    const rows = await query(
      `
      SELECT
        c.*,
        eco.name AS ecosystem_name,
        ct.name  AS crop_type_name,
        cv.name  AS variety_name
      FROM tbl_calamity c
      LEFT JOIN tbl_ecosystems     AS eco ON eco.id = c.ecosystem_id
      LEFT JOIN tbl_crop_types     AS ct  ON ct.id  = c.crop_type_id
      LEFT JOIN tbl_crop_varieties AS cv  ON cv.id  = c.crop_variety_id
      WHERE c.calamity_id = ?
      `,
      [insertedId]
    );

    res.status(201).json(rows.length ? mapRow(rows[0]) : { ok: true });
  } catch (err) {
    console.error("createCalamity error:", err);
    res.status(500).json({ message: "Failed to create record." });
  }
};

exports.updateCalamity = async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body || {};
    const fields = {};

    if (b.incident_type !== undefined) fields.calamity_type = b.incident_type;
    if (b.severity_text !== undefined) fields.severity_level = b.severity_text;
    if (b.severity !== undefined && b.severity_text === undefined) {
      fields.severity_level =
        b.severity >= 6 ? "Severe" :
        b.severity >= 5 ? "High" :
        b.severity >= 3 ? "Moderate" :
        b.severity >= 1 ? "Low" : null;
    }
    if (b.note !== undefined) fields.description = b.note;
    if (b.ecosystem_id !== undefined) fields.ecosystem_id = b.ecosystem_id;
    if (b.crop_type_id !== undefined) fields.crop_type_id = b.crop_type_id;
    if (b.crop_variety_id !== undefined) fields.crop_variety_id = b.crop_variety_id;
    if (b.affected_area !== undefined) fields.affected_area = b.affected_area;
    if (b.crop_stage !== undefined) fields.crop_stage = b.crop_stage;
    if (b.photos !== undefined) fields.photo = Array.isArray(b.photos) ? b.photos.join(",") : b.photos;
    if (b.location !== undefined) fields.location = b.location;
    if (b.barangay !== undefined) fields.barangay = b.barangay;
    if (b.reported_at !== undefined) fields.date_reported = b.reported_at;
    if (b.status !== undefined) fields.status = b.status;
    if (b.latitude !== undefined) fields.latitude = b.latitude;
    if (b.longitude !== undefined) fields.longitude = b.longitude;
    if (b.coordinates !== undefined) fields.coordinates = b.coordinates;

    if (!Object.keys(fields).length) {
      return res.status(400).json({ message: "No fields to update." });
    }

    await query(`UPDATE tbl_calamity SET ? WHERE calamity_id = ?`, [fields, id]);

    const rows = await query(
      `
      SELECT
        c.*,
        eco.name AS ecosystem_name,
        ct.name  AS crop_type_name,
        cv.name  AS variety_name
      FROM tbl_calamity c
      LEFT JOIN tbl_ecosystems     AS eco ON eco.id = c.ecosystem_id
      LEFT JOIN tbl_crop_types     AS ct  ON ct.id  = c.crop_type_id
      LEFT JOIN tbl_crop_varieties AS cv  ON cv.id  = c.crop_variety_id
      WHERE c.calamity_id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!rows.length) return res.status(404).json({ message: "Not found" });
    res.json(mapRow(rows[0]));
  } catch (err) {
    console.error("updateCalamity error:", err);
    res.status(500).json({ message: "Failed to update record." });
  }
};

exports.deleteCalamity = async (req, res) => {
  try {
    const { id } = req.params;
    await query(`DELETE FROM tbl_calamity WHERE calamity_id = ?`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteCalamity error:", err);
    res.status(500).json({ message: "Failed to delete record." });
  }
};

exports.listCropTypes = async (_req, res) => {
  try {
    const rows = await query(
      "SELECT id, name FROM tbl_crop_types ORDER BY name ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error("listCropTypes error:", err);
    res.status(500).json({ message: "Failed to fetch crop types." });
  }
};

exports.listCropVarieties = async (req, res) => {
  try {
    // include crop_type_id for client-side filtering; server-side filter optional
    const { cropTypeId } = req.query;
    const rows = await query(
      cropTypeId
        ? "SELECT id, name, crop_type_id FROM tbl_crop_varieties WHERE crop_type_id = ? ORDER BY name ASC"
        : "SELECT id, name, crop_type_id FROM tbl_crop_varieties ORDER BY name ASC",
      cropTypeId ? [Number(cropTypeId)] : []
    );
    res.json(rows);
  } catch (err) {
    console.error("listCropVarieties error:", err);
    res.status(500).json({ message: "Failed to fetch crop varieties." });
  }
};

exports.listEcosystems = async (req, res) => {
  try {
    // IMPORTANT: return crop_type_id so the UI can filter
    const { cropTypeId } = req.query;
    const rows = await query(
      cropTypeId
        ? "SELECT id, name, crop_type_id FROM tbl_ecosystems WHERE crop_type_id = ? ORDER BY name ASC"
        : "SELECT id, name, crop_type_id FROM tbl_ecosystems ORDER BY name ASC",
      cropTypeId ? [Number(cropTypeId)] : []
    );
    res.json(rows);
  } catch (err) {
    console.error("listEcosystems error:", err);
    res.status(500).json({ message: "Failed to fetch ecosystems." });
  }
};

exports.listCalamityFarmers = async (req, res) => {
  try {
    const calamityId = req.params.id;

    const rows = await query(
      `
      SELECT
        fc.calamity_id,
        fc.farmer_id,

        -- Prefer master 'tbl_farmers' values; fall back to link row fields
        COALESCE(f.first_name, fc.first_name)  AS first_name,
        COALESCE(f.last_name,  fc.last_name)   AS last_name,
        COALESCE(f.mobile_number, fc.mobile_number) AS mobile_number,
        COALESCE(f.barangay, fc.barangay)      AS barangay,
        COALESCE(f.full_address, fc.full_address) AS full_address,

        -- convenience
        CONCAT(
          COALESCE(f.first_name, fc.first_name, ''), ' ',
          COALESCE(f.last_name,  fc.last_name,  '')
        ) AS full_name
      FROM tbl_farmer_calamity AS fc
      LEFT JOIN tbl_farmers AS f
        ON f.farmer_id = fc.farmer_id
      WHERE fc.calamity_id = ?
      ORDER BY
        (COALESCE(f.last_name, fc.last_name) IS NULL),
        COALESCE(f.last_name, fc.last_name),
        COALESCE(f.first_name, fc.first_name)
      `,
      [req.params.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("listCalamityFarmers error:", err);
    res.status(500).json({ message: "Failed to fetch farmers for calamity." });
  }
};
