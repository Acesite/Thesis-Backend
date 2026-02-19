const db = require("../../Config/db");

// ✅ NEW: helper to compute age from birth_date
function calculateAge(birthDate) {
  if (!birthDate) return null;

  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    age--;
  }

  return age;
}

function mapArb(row) {
  return {
    arb_id: row.arb_id,
    first_name: row.first_name,
    middle_name: row.middle_name,
    last_name: row.last_name,
    extension_name: row.extension_name,
    birth_date: row.birth_date,

    // ✅ NEW: computed age field
    age: calculateAge(row.birth_date),

    civil_status: row.civil_status,
    household_size: row.household_size,
    years_tilling: row.years_tilling,
    tin_number: row.tin_number,
    affidavit_landles: !!row.affidavit_landles,
    latitude: row.latitude,
    longitude: row.longitude,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/* ---------- GET ALL ARBs (for map + list) ---------- */
exports.getAllArbs = (req, res) => {
  const sql = "SELECT * FROM dar_agrarian_reform_beneficiaries ORDER BY arb_id DESC";

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Error fetching ARBs:", err);
      return res.status(500).json({ message: "Failed to fetch ARBs" });
    }
    const data = rows.map(mapArb);
    res.json(data);
  });
};

/* ---------- GET SINGLE ARB BY ID ---------- */
exports.getArbById = (req, res) => {
  const { arb_id } = req.params;
  const sql = "SELECT * FROM dar_agrarian_reform_beneficiaries WHERE arb_id = ?";

  db.query(sql, [arb_id], (err, rows) => {
    if (err) {
      console.error("Error fetching ARB:", err);
      return res.status(500).json({ message: "Failed to fetch ARB" });
    }
    if (rows.length === 0) {
      return res.status(404).json({ message: "ARB not found" });
    }
    res.json(mapArb(rows[0]));
  });
};

/* ---------- CREATE ARB (with optional geotag) ---------- */
exports.createArb = (req, res) => {
  const {
    first_name,
    middle_name,
    last_name,
    extension_name,
    birth_date,
    civil_status,
    household_size,
    years_tilling,
    tin_number,
    affidavit_landles,
    latitude,
    longitude,
  } = req.body;

  const sql = `
    INSERT INTO dar_agrarian_reform_beneficiaries
    (
      first_name,
      middle_name,
      last_name,
      extension_name,
      birth_date,
      civil_status,
      household_size,
      years_tilling,
      tin_number,
      affidavit_landles,
      latitude,
      longitude
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    first_name || null,
    middle_name || null,
    last_name || null,
    extension_name || null,
    birth_date || null,
    civil_status || null,
    household_size || null,
    years_tilling || null,
    tin_number || null,
    affidavit_landles ? 1 : 0,
    latitude || null,
    longitude || null,
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Error creating ARB:", err);
      return res.status(500).json({ message: "Failed to create ARB" });
    }

    const insertedId = result.insertId;
    db.query(
      "SELECT * FROM dar_agrarian_reform_beneficiaries WHERE arb_id = ?",
      [insertedId],
      (err2, rows) => {
        if (err2) {
          console.error("Error fetching newly created ARB:", err2);
          return res
            .status(201)
            .json({ message: "ARB created", arb_id: insertedId });
        }
        res.status(201).json(mapArb(rows[0]));
      }
    );
  });
};

/* ---------- UPDATE ARB (full update) ---------- */
exports.updateArb = (req, res) => {
  const { arb_id } = req.params;
  const {
    first_name,
    middle_name,
    last_name,
    extension_name,
    birth_date,
    civil_status,
    household_size,
    years_tilling,
    tin_number,
    affidavit_landles,
    latitude,
    longitude,
  } = req.body;

  const sql = `
    UPDATE dar_agrarian_reform_beneficiaries
    SET
      first_name = ?,
      middle_name = ?,
      last_name = ?,
      extension_name = ?,
      birth_date = ?,
      civil_status = ?,
      household_size = ?,
      years_tilling = ?,
      tin_number = ?,
      affidavit_landles = ?,
      latitude = ?,
      longitude = ?
    WHERE arb_id = ?
  `;

  const values = [
    first_name || null,
    middle_name || null,
    last_name || null,
    extension_name || null,
    birth_date || null,
    civil_status || null,
    household_size || null,
    years_tilling || null,
    tin_number || null,
    affidavit_landles ? 1 : 0,
    latitude || null,
    longitude || null,
    arb_id,
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Error updating ARB:", err);
      return res.status(500).json({ message: "Failed to update ARB" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "ARB not found" });
    }

    db.query(
      "SELECT * FROM dar_agrarian_reform_beneficiaries WHERE arb_id = ?",
      [arb_id],
      (err2, rows) => {
        if (err2 || rows.length === 0) {
          console.error("Error fetching updated ARB:", err2);
          return res.json({ message: "ARB updated", arb_id });
        }
        res.json(mapArb(rows[0]));
      }
    );
  });
};

/* ---------- UPDATE ONLY GEOTAG (lat/lng) ---------- */
exports.updateArbGeotag = (req, res) => {
  const { arb_id } = req.params;
  const { latitude, longitude } = req.body;

  const sql = `
    UPDATE dar_agrarian_reform_beneficiaries
    SET latitude = ?, longitude = ?
    WHERE arb_id = ?
  `;

  db.query(sql, [latitude || null, longitude || null, arb_id], (err, result) => {
    if (err) {
      console.error("Error updating ARB geotag:", err);
      return res.status(500).json({ message: "Failed to update ARB geotag" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "ARB not found" });
    }

    db.query(
      "SELECT * FROM dar_agrarian_reform_beneficiaries WHERE arb_id = ?",
      [arb_id],
      (err2, rows) => {
        if (err2 || rows.length === 0) {
          console.error("Error fetching ARB after geotag update:", err2);
          return res.json({ message: "ARB geotag updated", arb_id });
        }
        res.json(mapArb(rows[0]));
      }
    );
  });
};

/* ---------- OPTIONAL: DELETE ARB (hard delete) ---------- */
exports.deleteArb = (req, res) => {
  const { arb_id } = req.params;

  const sql = "DELETE FROM dar_agrarian_reform_beneficiaries WHERE arb_id = ?";

  db.query(sql, [arb_id], (err, result) => {
    if (err) {
      console.error("Error deleting ARB:", err);
      return res.status(500).json({ message: "Failed to delete ARB" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "ARB not found" });
    }

    res.json({ message: "ARB deleted", arb_id });
  });
};
