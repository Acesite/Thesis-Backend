const db = require("../../Config/db");

function toInt(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function toFloat(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toGender(v) {
  const s = String(v || "").trim().toLowerCase();
  return s === "male" || s === "female" ? s : null;
}

function toVisited(v, def = 1) {
  if (v === undefined || v === null || v === "") return def;
  const n = Number(v);
  return n === 1 ? 1 : 0;
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
    purok_leader_name: row.purok_leader_name || null, // ✅ new field
    sitio: row.sitio,
    lat: row.lat,
    lng: row.lng,
    family_leader_name: row.family_leader_name || null,
    family_leader_age: row.family_leader_age,
    family_leader_gender: row.family_leader_gender || null,
    voter_count: row.voter_count || 0,
    mayor_candidate_id: row.mayor_candidate_id || null,
    vice_mayor_candidate_id: row.vice_mayor_candidate_id || null,
    mayor_vote: row.mayor_vote || null,
    vice_mayor_vote: row.vice_mayor_vote || null,
    notes: row.notes,
    is_visited: Number(row.is_visited) === 1 ? 1 : 0,
    encoded_by: row.encoded_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

exports.getBarangays = (req, res) => {
  const sql = `
    SELECT id, region_name, province_name, city_municipality_name, barangay_name
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

exports.getCandidates = (req, res) => {
  const year = Number(req.query.year);

  let sql = `
    SELECT id, position, full_name, party, color, election_year
    FROM tbl_candidates
  `;
  const params = [];

  if (Number.isFinite(year) && year > 0) {
    sql += ` WHERE election_year = ?`;
    params.push(year);
  }

  sql += ` ORDER BY position ASC, full_name ASC`;

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("Error fetching candidates:", err);
      return res.status(500).json({ message: "Failed to fetch candidates" });
    }
    res.json(rows);
  });
};

exports.getAllHouseholds = (req, res) => {
  const sql = `
    SELECT
      h.*,
      b.barangay_name,
      p.precinct_no,
      p.clustered_precinct_no,
      p.polling_place,
      mc.full_name AS mayor_vote,
      vmc.full_name AS vice_mayor_vote
    FROM tbl_households h
    JOIN tbl_barangays_voters b ON b.id = h.barangay_id
    LEFT JOIN tbl_precincts p ON p.id = h.precinct_id
    LEFT JOIN tbl_candidates mc ON mc.id = h.mayor_candidate_id
    LEFT JOIN tbl_candidates vmc ON vmc.id = h.vice_mayor_candidate_id
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

exports.getHouseholdById = (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT
      h.*,
      b.barangay_name,
      p.precinct_no,
      p.clustered_precinct_no,
      p.polling_place,
      mc.full_name AS mayor_vote,
      vmc.full_name AS vice_mayor_vote
    FROM tbl_households h
    JOIN tbl_barangays_voters b ON b.id = h.barangay_id
    LEFT JOIN tbl_precincts p ON p.id = h.precinct_id
    LEFT JOIN tbl_candidates mc ON mc.id = h.mayor_candidate_id
    LEFT JOIN tbl_candidates vmc ON vmc.id = h.vice_mayor_candidate_id
    WHERE h.id = ?
  `;

  db.query(sql, [id], (err, rows) => {
    if (err) {
      console.error("Error fetching household:", err);
      return res.status(500).json({ message: "Failed to fetch household" });
    }

    if (!rows.length) {
      return res.status(404).json({ message: "Household not found" });
    }

    const household = mapHousehold(rows[0]);

    const memberSql = `
      SELECT id, household_id, age, gender, is_family_leader, created_at
      FROM tbl_household_members
      WHERE household_id = ?
      ORDER BY is_family_leader DESC, id ASC
    `;

    db.query(memberSql, [id], (memberErr, memberRows) => {
      if (memberErr) {
        console.error("Error fetching household members:", memberErr);
        return res.status(500).json({ message: "Failed to fetch household members" });
      }

      household.members = memberRows || [];
      res.json(household);
    });
  });
};

function resolvePrecinctId(rawPrecinctValue, cb) {
  if (
    rawPrecinctValue === "" ||
    rawPrecinctValue === null ||
    rawPrecinctValue === undefined
  ) {
    return cb(null, null);
  }

  const candidate = toInt(rawPrecinctValue, 0);
  if (!candidate || candidate <= 0) {
    return cb(null, null);
  }

  const sql = "SELECT id FROM tbl_precincts WHERE id = ? LIMIT 1";
  db.query(sql, [candidate], (err, rows) => {
    if (err) return cb(err);
    if (!rows || !rows.length) return cb(null, null);
    cb(null, candidate);
  });
}

exports.createHousehold = (req, res) => {
  const {
    barangay_id,
    precinct_id,
    purok,
    purok_leader_name, // ✅ new field
    sitio,
    lat,
    lng,
    family_leader_name,
    family_leader_age,
    family_leader_gender,
    voter_count,
    mayor_candidate_id,
    vice_mayor_candidate_id,
    notes,
    encoded_by,
    is_visited,
    other_members = [],
  } = req.body;

  const barangayId = toInt(barangay_id, 0);
  const latitude = toFloat(lat);
  const longitude = toFloat(lng);
  const leaderAge = toInt(family_leader_age, -1);
  const leaderGender = toGender(family_leader_gender);
  const voterCount = toInt(voter_count, 0);
  const mayorCandidateId = mayor_candidate_id ? toInt(mayor_candidate_id, 0) : null;
  const viceMayorCandidateId = vice_mayor_candidate_id
    ? toInt(vice_mayor_candidate_id, 0)
    : null;
  const userId = toInt(encoded_by, 0);
  const isVisited = toVisited(is_visited, 1);

  if (!barangayId) {
    return res.status(400).json({ message: "barangay_id is required" });
  }

  if (latitude === null || longitude === null) {
    return res.status(400).json({ message: "Valid lat and lng are required" });
  }

  if (leaderAge < 0) {
    return res.status(400).json({ message: "family_leader_age is required" });
  }

  if (!leaderGender) {
    return res.status(400).json({ message: "family_leader_gender is required" });
  }

  if (voterCount < 1) {
    return res.status(400).json({ message: "voter_count must be 1 or greater" });
  }

  if (!userId) {
    return res.status(400).json({ message: "encoded_by (user id) is required" });
  }

  const normalizedMembers = Array.isArray(other_members)
    ? other_members
        .map((m) => ({
          age: toInt(m?.age, -1),
          gender: toGender(m?.gender),
        }))
        .filter((m) => m.age >= 0 && m.gender)
    : [];

  if (normalizedMembers.length !== Math.max(0, voterCount - 1)) {
    return res.status(400).json({
      message: `Please provide exactly ${Math.max(
        0,
        voterCount - 1
      )} other household member age(s) and gender(s).`,
    });
  }

  resolvePrecinctId(precinct_id, (err, precinctId) => {
    if (err) {
      console.error("Error checking precinct:", err);
      return res.status(500).json({ message: "Failed to create household" });
    }

    const sql = `
      INSERT INTO tbl_households
      (
        barangay_id,
        precinct_id,
        purok,
        purok_leader_name,
        sitio,
        family_leader_name,
        family_leader_age,
        family_leader_gender,
        lat,
        lng,
        notes,
        voter_count,
        mayor_candidate_id,
        vice_mayor_candidate_id,
        encoded_by,
        is_visited
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      barangayId,
      precinctId,
      purok || null,
      purok_leader_name || null, // ✅ new field
      sitio || null,
      family_leader_name || null,
      leaderAge,
      leaderGender,
      latitude,
      longitude,
      notes || null,
      voterCount,
      mayorCandidateId || null,
      viceMayorCandidateId || null,
      userId,
      isVisited,
    ];

    db.query(sql, values, (err2, result) => {
      if (err2) {
        console.error("Error creating household:", err2);
        return res.status(500).json({ message: "Failed to create household" });
      }

      const householdId = result.insertId;

      const memberValues = [
        [householdId, leaderAge, leaderGender, 1],
        ...normalizedMembers.map((m) => [householdId, m.age, m.gender, 0]),
      ];

      const memberSql = `
        INSERT INTO tbl_household_members (household_id, age, gender, is_family_leader)
        VALUES ?
      `;

      db.query(memberSql, [memberValues], (err3) => {
        if (err3) {
          console.error("Error creating household members:", err3);
          return res.status(500).json({
            message: "Household saved but failed to save household members",
          });
        }

        exports.getHouseholdById({ params: { id: householdId } }, res);
      });
    });
  });
};

exports.updateHousehold = (req, res) => {
  const { id } = req.params;

  const {
    barangay_id,
    precinct_id,
    purok,
    purok_leader_name, // ✅ new field
    sitio,
    family_leader_name,
    family_leader_age,
    family_leader_gender,
    voter_count,
    mayor_candidate_id,
    vice_mayor_candidate_id,
    notes,
    updated_by,
    is_visited,
    other_members = [],
  } = req.body;

  const barangayId = toInt(barangay_id, 0);
  const leaderAge = toInt(family_leader_age, -1);
  const leaderGender = toGender(family_leader_gender);
  const voterCount = toInt(voter_count, 0);
  const mayorCandidateId = mayor_candidate_id ? toInt(mayor_candidate_id, 0) : null;
  const viceMayorCandidateId = vice_mayor_candidate_id
    ? toInt(vice_mayor_candidate_id, 0)
    : null;
  const userId = toInt(updated_by, 0);
  const isVisited = toVisited(is_visited, 1);

  if (!barangayId) {
    return res.status(400).json({ message: "barangay_id is required" });
  }

  if (leaderAge < 0) {
    return res.status(400).json({ message: "family_leader_age is required" });
  }

  if (!leaderGender) {
    return res.status(400).json({ message: "family_leader_gender is required" });
  }

  if (voterCount < 1) {
    return res.status(400).json({ message: "voter_count must be 1 or greater" });
  }

  if (!userId) {
    return res.status(400).json({ message: "updated_by (user id) is required" });
  }

  const normalizedMembers = Array.isArray(other_members)
    ? other_members
        .map((m) => ({
          age: toInt(m?.age, -1),
          gender: toGender(m?.gender),
        }))
        .filter((m) => m.age >= 0 && m.gender)
    : [];

  if (normalizedMembers.length !== Math.max(0, voterCount - 1)) {
    return res.status(400).json({
      message: `Please provide exactly ${Math.max(
        0,
        voterCount - 1
      )} other household member age(s) and gender(s).`,
    });
  }

  resolvePrecinctId(precinct_id, (err, precinctId) => {
    if (err) {
      console.error("Error checking precinct:", err);
      return res.status(500).json({ message: "Failed to update household" });
    }

    const sql = `
      UPDATE tbl_households
      SET
        barangay_id = ?,
        precinct_id = ?,
        purok = ?,
        purok_leader_name = ?,
        sitio = ?,
        family_leader_name = ?,
        family_leader_age = ?,
        family_leader_gender = ?,
        voter_count = ?,
        mayor_candidate_id = ?,
        vice_mayor_candidate_id = ?,
        notes = ?,
        is_visited = ?,
        updated_by = ?
      WHERE id = ?
    `;

    const values = [
      barangayId,
      precinctId,
      purok || null,
      purok_leader_name || null, // ✅ new field
      sitio || null,
      family_leader_name || null,
      leaderAge,
      leaderGender,
      voterCount,
      mayorCandidateId || null,
      viceMayorCandidateId || null,
      notes || null,
      isVisited,
      userId,
      id,
    ];

    db.query(sql, values, (err2, result) => {
      if (err2) {
        console.error("Error updating household:", err2);
        return res.status(500).json({ message: "Failed to update household" });
      }

      if (!result.affectedRows) {
        return res.status(404).json({ message: "Household not found" });
      }

      const deleteMembersSql = `DELETE FROM tbl_household_members WHERE household_id = ?`;

      db.query(deleteMembersSql, [id], (err3) => {
        if (err3) {
          console.error("Error deleting old household members:", err3);
          return res.status(500).json({ message: "Failed to update household members" });
        }

        const memberValues = [
          [Number(id), leaderAge, leaderGender, 1],
          ...normalizedMembers.map((m) => [Number(id), m.age, m.gender, 0]),
        ];

        const memberSql = `
          INSERT INTO tbl_household_members (household_id, age, gender, is_family_leader)
          VALUES ?
        `;

        db.query(memberSql, [memberValues], (err4) => {
          if (err4) {
            console.error("Error saving updated household members:", err4);
            return res.status(500).json({ message: "Failed to update household members" });
          }

          exports.getHouseholdById({ params: { id } }, res);
        });
      });
    });
  });
};

exports.deleteHousehold = (req, res) => {
  const { id } = req.params;

  const sql = "DELETE FROM tbl_households WHERE id = ?";

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Error deleting household:", err);
      return res.status(500).json({ message: "Failed to delete household" });
    }

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Household not found" });
    }

    res.json({ message: "Household deleted successfully" });
  });
};