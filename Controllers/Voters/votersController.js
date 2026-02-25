const db = require("../../Config/db");

function toInt(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function toFloat(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function validateCounts(payload) {
  const eligible = toInt(payload.eligible_voters, 0);
  const yes = toInt(payload.voting_for_us, 0);
  const undecided = toInt(payload.undecided, 0);
  const no = toInt(payload.not_supporting, 0);

  if (eligible < 0 || yes < 0 || undecided < 0 || no < 0) {
    return "Counts cannot be negative.";
  }
  if (yes + undecided + no > eligible) {
    return "voting_for_us + undecided + not_supporting must be <= eligible_voters.";
  }
  return null;
}

function mapHousehold(row) {
  return {
    id: row.id,
    barangay_id: row.barangay_id,
    barangay_name: row.barangay_name || null,

    precinct_id: row.precinct_id,
    precinct_no: row.precinct_no || null,
    clustered_precinct_no: row.clustered_precinct_no || null,
    polling_place: row.polling_place || null,

    purok: row.purok,
    sitio: row.sitio,

    lat: row.lat,
    lng: row.lng,

    eligible_voters: row.eligible_voters,
    voting_for_us: row.voting_for_us,
    undecided: row.undecided,
    not_supporting: row.not_supporting,

    notes: row.notes,

    encoded_by: row.encoded_by,
    updated_by: row.updated_by,

    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/* =========================================================
   BARANGAYS
   GET /api/voters/barangays
========================================================= */
exports.getBarangays = (req, res) => {
  const sql = `
    SELECT id, psgc_code, region_name, province_name, city_municipality_name, barangay_name
    FROM tbl_barangays_voters
    ORDER BY barangay_name ASC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Error fetching barangays:", err);
      return res.status(500).json({ message: "Failed to fetch barangays" });
    }
    res.json(rows);
  });
};

/* =========================================================
   PRECINCTS
   GET /api/voters/precincts?barangay_id=#
========================================================= */
exports.getPrecincts = (req, res) => {
  const barangayId = toInt(req.query.barangay_id, 0);
  if (!barangayId) return res.json([]);

  const sql = `
    SELECT id, precinct_no, clustered_precinct_no, polling_place, barangay_id
    FROM tbl_precincts
    WHERE barangay_id = ?
    ORDER BY precinct_no ASC
  `;

  db.query(sql, [barangayId], (err, rows) => {
    if (err) {
      console.error("Error fetching precincts:", err);
      return res.status(500).json({ message: "Failed to fetch precincts" });
    }
    res.json(rows);
  });
};

/* =========================================================
   HOUSEHOLDS
   GET /api/voters/households
========================================================= */
exports.getAllHouseholds = (req, res) => {
  const sql = `
    SELECT
      h.*,
      b.barangay_name,
      p.precinct_no,
      p.clustered_precinct_no,
      p.polling_place
    FROM tbl_households h
    JOIN tbl_barangays_voters b ON b.id = h.barangay_id
    LEFT JOIN tbl_precincts p ON p.id = h.precinct_id
    ORDER BY h.id DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Error fetching households:", err);
      return res.status(500).json({ message: "Failed to fetch households" });
    }
    res.json(rows.map(mapHousehold));
  });
};

/* =========================================================
   GET SINGLE
   GET /api/voters/households/:id
========================================================= */
exports.getHouseholdById = (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT
      h.*,
      b.barangay_name,
      p.precinct_no,
      p.clustered_precinct_no,
      p.polling_place
    FROM tbl_households h
    JOIN tbl_barangays_voters b ON b.id = h.barangay_id
    LEFT JOIN tbl_precincts p ON p.id = h.precinct_id
    WHERE h.id = ?
  `;

  db.query(sql, [id], (err, rows) => {
    if (err) {
      console.error("Error fetching household:", err);
      return res.status(500).json({ message: "Failed to fetch household" });
    }
    if (rows.length === 0) {
      return res.status(404).json({ message: "Household not found" });
    }
    res.json(mapHousehold(rows[0]));
  });
};

/* =========================================================
   CREATE
   POST /api/voters/households
========================================================= */
exports.createHousehold = (req, res) => {
  const {
    barangay_id,
    precinct_id,
    purok,
    sitio,
    lat,
    lng,
    eligible_voters,
    voting_for_us,
    undecided,
    not_supporting,
    notes,

    // If you don't have auth middleware yet, you can send this from frontend temporarily:
    encoded_by,
  } = req.body;

  const barangayId = toInt(barangay_id, 0);
  const precinctId =
    precinct_id === "" || precinct_id === null || precinct_id === undefined
      ? null
      : toInt(precinct_id, 0);

  const latitude = toFloat(lat);
  const longitude = toFloat(lng);

  if (!barangayId) return res.status(400).json({ message: "barangay_id is required" });
  if (latitude === null || longitude === null) {
    return res.status(400).json({ message: "Valid lat and lng are required" });
  }

  const countErr = validateCounts({
    eligible_voters,
    voting_for_us,
    undecided,
    not_supporting,
  });
  if (countErr) return res.status(400).json({ message: countErr });

  // If you already have auth (JWT), replace this with: const userId = req.user.id;
  const userId = toInt(encoded_by, 0);
  if (!userId) return res.status(400).json({ message: "encoded_by (user id) is required" });

  const sql = `
    INSERT INTO tbl_households
    (
      barangay_id,
      precinct_id,
      purok,
      sitio,
      lat,
      lng,
      eligible_voters,
      voting_for_us,
      undecided,
      not_supporting,
      notes,
      encoded_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    barangayId,
    precinctId,
    purok || null,
    sitio || null,
    latitude,
    longitude,
    toInt(eligible_voters, 0),
    toInt(voting_for_us, 0),
    toInt(undecided, 0),
    toInt(not_supporting, 0),
    notes || null,
    userId,
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Error creating household:", err);
      return res.status(500).json({ message: "Failed to create household" });
    }

    const insertedId = result.insertId;

    // return full joined row
    exports.getHouseholdById({ params: { id: insertedId } }, res);
  });
};

/* =========================================================
   UPDATE
   PUT /api/voters/households/:id
   - also writes visit history into tbl_household_visits
========================================================= */
exports.updateHousehold = (req, res) => {
  const { id } = req.params;

  const {
    barangay_id,
    precinct_id,
    purok,
    sitio,
    eligible_voters,
    voting_for_us,
    undecided,
    not_supporting,
    notes,

    // If no auth middleware yet:
    updated_by,
  } = req.body;

  const countErr = validateCounts({
    eligible_voters,
    voting_for_us,
    undecided,
    not_supporting,
  });
  if (countErr) return res.status(400).json({ message: countErr });

  const barangayId = toInt(barangay_id, 0);
  if (!barangayId) return res.status(400).json({ message: "barangay_id is required" });

  const precinctId =
    precinct_id === "" || precinct_id === null || precinct_id === undefined
      ? null
      : toInt(precinct_id, 0);

  const userId = toInt(updated_by, 0);
  if (!userId) return res.status(400).json({ message: "updated_by (user id) is required" });

  const sql = `
    UPDATE tbl_households
    SET
      barangay_id = ?,
      precinct_id = ?,
      purok = ?,
      sitio = ?,
      eligible_voters = ?,
      voting_for_us = ?,
      undecided = ?,
      not_supporting = ?,
      notes = ?,
      updated_by = ?
    WHERE id = ?
  `;

  const values = [
    barangayId,
    precinctId,
    purok || null,
    sitio || null,
    toInt(eligible_voters, 0),
    toInt(voting_for_us, 0),
    toInt(undecided, 0),
    toInt(not_supporting, 0),
    notes || null,
    userId,
    id,
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Error updating household:", err);
      return res.status(500).json({ message: "Failed to update household" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Household not found" });
    }

    // ✅ log visit history (optional but recommended)
    const visitSql = `
      INSERT INTO tbl_household_visits
      (household_id, officer_id, eligible_voters, voting_for_us, undecided, not_supporting, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const visitValues = [
      id,
      userId,
      toInt(eligible_voters, 0),
      toInt(voting_for_us, 0),
      toInt(undecided, 0),
      toInt(not_supporting, 0),
      notes || null,
    ];

    db.query(visitSql, visitValues, (err2) => {
      if (err2) {
        console.error("Warning: failed to insert household visit history:", err2);
        // don't block response
      }

      // return updated full joined row
      exports.getHouseholdById({ params: { id } }, res);
    });
  });
};

/* =========================================================
   DELETE (hard delete)
   DELETE /api/voters/households/:id
========================================================= */
exports.deleteHousehold = (req, res) => {
  const { id } = req.params;

  const sql = "DELETE FROM tbl_households WHERE id = ?";

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Error deleting household:", err);
      return res.status(500).json({ message: "Failed to delete household" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Household not found" });
    }

    res.json({ message: "Household deleted", id });
  });
};