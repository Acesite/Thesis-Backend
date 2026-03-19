const db = require("../../Config/db");

exports.getDashboardStats = (req, res) => {
  db.query(
    `SELECT COUNT(DISTINCT barangay_id) AS total FROM tbl_households`,
    (err, barangayRows) => {
      if (err) return res.status(500).json({ message: "Failed to fetch stats" });

      db.query(
        `SELECT COUNT(DISTINCT precinct_id) AS total FROM tbl_households WHERE precinct_id IS NOT NULL`,
        (err2, precinctRows) => {
          if (err2) return res.status(500).json({ message: "Failed to fetch stats" });

          db.query(
            `SELECT COUNT(*) AS total FROM tbl_households`,
            (err3, householdRows) => {
              if (err3) return res.status(500).json({ message: "Failed to fetch stats" });

              db.query(
                `SELECT COALESCE(SUM(voter_count), 0) AS total FROM tbl_households`,
                (err4, voterRows) => {
                  if (err4) return res.status(500).json({ message: "Failed to fetch stats" });

                  res.json({
                    totalBarangays: barangayRows[0].total,
                    totalPrecincts: precinctRows[0].total,
                    encodedHouseholds: householdRows[0].total,
                    totalVoters: voterRows[0].total,
                  });
                }
              );
            }
          );
        }
      );
    }
  );
};

exports.getBarangayAnalytics = (req, res) => {
  const sql = `
    SELECT
      h.barangay_id,
      b.barangay_name,
      COUNT(DISTINCT h.precinct_id) AS precincts,
      COUNT(h.id) AS households,
      SUM(h.voter_count) AS voters
    FROM tbl_households h
    JOIN tbl_barangays_voters b ON b.id = h.barangay_id
    GROUP BY h.barangay_id, b.barangay_name
    ORDER BY voters DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ message: "Failed to fetch barangay analytics" });
    res.json(rows);
  });
};

exports.getQuickInsights = (req, res) => {
  const topSql = `
    SELECT b.barangay_name, COUNT(h.id) AS households
    FROM tbl_households h
    JOIN tbl_barangays_voters b ON b.id = h.barangay_id
    GROUP BY h.barangay_id, b.barangay_name
    ORDER BY households DESC
    LIMIT 1
  `;
  db.query(topSql, (err, topRows) => {
    if (err) return res.status(500).json({ message: "Failed to fetch insights" });

    db.query(
      `SELECT ROUND(AVG(voter_count),1) AS avg_voters FROM tbl_households`,
      (err2, avgRows) => {
        if (err2) return res.status(500).json({ message: "Failed to fetch insights" });

        db.query(
          `SELECT ROUND(
              SUM(CASE WHEN precinct_id IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 0
           ) AS coverage_rate FROM tbl_households`,
          (err3, coverageRows) => {
            if (err3) return res.status(500).json({ message: "Failed to fetch insights" });

            res.json({
              topBarangay: topRows[0]?.barangay_name ?? "N/A",
              avgVotersPerHousehold: avgRows[0]?.avg_voters ?? 0,
              coverageRate: coverageRows[0]?.coverage_rate ?? 0,
            });
          }
        );
      }
    );
  });
};

exports.getRecentActivity = (req, res) => {
  const sql = `
    SELECT h.id, b.barangay_name, h.family_leader_name, h.voter_count, h.created_at, h.updated_at
    FROM tbl_households h
    JOIN tbl_barangays_voters b ON b.id = h.barangay_id
    ORDER BY h.updated_at DESC
    LIMIT 10
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ message: "Failed to fetch activity" });
    res.json(rows);
  });
};

// ── Vote Standings — filter by ?year=2025 ────────────────────────────────────
exports.getVoteStandings = (req, res) => {
  const year = req.query.year ? Number(req.query.year) : null;

  let sql = `
    SELECT
      c.id,
      c.full_name,
      c.position,
      c.party,
      c.color,
      c.election_year,
      COUNT(h.id) AS vote_count
    FROM tbl_candidates c
    LEFT JOIN tbl_households h
      ON (
        (c.position = 'mayor'      AND h.mayor_candidate_id      = c.id) OR
        (c.position = 'vice_mayor' AND h.vice_mayor_candidate_id = c.id)
      )
    WHERE c.full_name != 'Undecided'
  `;

  const params = [];
  if (year && Number.isFinite(year)) {
    sql += ` AND c.election_year = ?`;
    params.push(year);
  }

  sql += ` GROUP BY c.id, c.full_name, c.position, c.party, c.color, c.election_year
           ORDER BY c.position ASC, vote_count DESC`;

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("getVoteStandings error:", err);
      return res.status(500).json({ message: "Failed to fetch vote standings" });
    }
    res.json(rows);
  });
};

// ── Gender Breakdown — filter by ?barangay_id=1 ──────────────────────────────
exports.getGenderBreakdown = (req, res) => {
  const barangayId = req.query.barangay_id ? Number(req.query.barangay_id) : null;

  let sql = `
    SELECT m.gender, COUNT(*) AS count
    FROM tbl_household_members m
  `;

  const params = [];
  if (barangayId && Number.isFinite(barangayId)) {
    sql += ` JOIN tbl_households h ON h.id = m.household_id WHERE h.barangay_id = ? AND m.gender IS NOT NULL`;
    params.push(barangayId);
  } else {
    sql += ` WHERE m.gender IS NOT NULL`;
  }

  sql += ` GROUP BY m.gender`;

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("getGenderBreakdown error:", err);
      return res.status(500).json({ message: "Failed to fetch gender breakdown" });
    }
    const result = { male: 0, female: 0 };
    for (const row of rows) {
      if (row.gender === "male") result.male = Number(row.count);
      if (row.gender === "female") result.female = Number(row.count);
    }
    result.total = result.male + result.female;
    res.json(result);
  });
};

// ── Age Breakdown — filter by ?barangay_id=1 ─────────────────────────────────
exports.getAgeBreakdown = (req, res) => {
  const barangayId = req.query.barangay_id ? Number(req.query.barangay_id) : null;

  let sql = `
    SELECT
      CASE
        WHEN m.age BETWEEN 18 AND 30 THEN 'Youth'
        WHEN m.age BETWEEN 31 AND 59 THEN 'Adult'
        WHEN m.age >= 60              THEN 'Senior'
        ELSE 'Other'
      END AS age_group,
      COUNT(*) AS count
    FROM tbl_household_members m
  `;

  const params = [];
  if (barangayId && Number.isFinite(barangayId)) {
    sql += ` JOIN tbl_households h ON h.id = m.household_id WHERE h.barangay_id = ? AND m.age IS NOT NULL AND m.age >= 18`;
    params.push(barangayId);
  } else {
    sql += ` WHERE m.age IS NOT NULL AND m.age >= 18`;
  }

  sql += ` GROUP BY age_group ORDER BY FIELD(age_group, 'Youth', 'Adult', 'Senior', 'Other')`;

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("getAgeBreakdown error:", err);
      return res.status(500).json({ message: "Failed to fetch age breakdown" });
    }
    const result = { Youth: 0, Adult: 0, Senior: 0, Other: 0 };
    for (const row of rows) result[row.age_group] = Number(row.count);
    result.total = result.Youth + result.Adult + result.Senior + result.Other;
    res.json(result);
  });
};

// ── Visit Progress — filter by ?barangay_id=1 ────────────────────────────────
exports.getVisitProgress = (req, res) => {
  const barangayId = req.query.barangay_id ? Number(req.query.barangay_id) : null;

  let sql = `
    SELECT
      SUM(CASE WHEN is_visited = 1 THEN 1 ELSE 0 END) AS visited,
      SUM(CASE WHEN is_visited = 0 THEN 1 ELSE 0 END) AS not_visited,
      COUNT(*) AS total
    FROM tbl_households
  `;

  const params = [];
  if (barangayId && Number.isFinite(barangayId)) {
    sql += ` WHERE barangay_id = ?`;
    params.push(barangayId);
  }

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("getVisitProgress error:", err);
      return res.status(500).json({ message: "Failed to fetch visit progress" });
    }
    const { visited, not_visited, total } = rows[0];
    const visitedNum = Number(visited) || 0;
    const totalNum = Number(total) || 0;
    res.json({
      visited: visitedNum,
      not_visited: Number(not_visited) || 0,
      total: totalNum,
      percentage: totalNum > 0 ? Math.round((visitedNum / totalNum) * 100) : 0,
    });
  });
};

// ── Candidates CRUD ───────────────────────────────────────────────────────────
exports.getCandidates = (req, res) => {
  db.query(
    `SELECT id, full_name, position, party, election_year, color FROM tbl_candidates ORDER BY election_year DESC, position ASC`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Failed to fetch candidates" });
      res.json(rows);
    }
  );
};

exports.createCandidate = (req, res) => {
  const { full_name, position, party, election_year, color } = req.body;
  db.query(
    `INSERT INTO tbl_candidates (full_name, position, party, election_year, color) VALUES (?, ?, ?, ?, ?)`,
    [full_name, position, party, election_year, color || "#10b981"],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Failed to create candidate" });
      res.json({ message: "Candidate created", id: result.insertId });
    }
  );
};

exports.updateCandidate = (req, res) => {
  const { id } = req.params;
  const { full_name, position, party, election_year, color } = req.body;
  db.query(
    `UPDATE tbl_candidates SET full_name=?, position=?, party=?, election_year=?, color=? WHERE id=?`,
    [full_name, position, party, election_year, color || "#10b981", id],
    (err) => {
      if (err) return res.status(500).json({ message: "Failed to update candidate" });
      res.json({ message: "Candidate updated" });
    }
  );
};

exports.deleteCandidate = (req, res) => {
  const { id } = req.params;
  db.query(`DELETE FROM tbl_candidates WHERE id=?`, [id], (err) => {
    if (err) return res.status(500).json({ message: "Failed to delete candidate" });
    res.json({ message: "Candidate deleted" });
  });
};