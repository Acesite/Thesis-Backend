const db = require("../../Config/db");


/* =========================================
   DASHBOARD STATS
========================================= */

exports.getDashboardStats = (req, res) => {
  db.query(
    `SELECT COUNT(DISTINCT barangay_id) AS total FROM tbl_households`,
    (err, barangayRows) => {
      if (err) {
        console.error("getDashboardStats barangay error:", err);
        return res.status(500).json({ message: "Failed to fetch stats" });
      }

      db.query(
        `SELECT COUNT(DISTINCT precinct_id) AS total
         FROM tbl_households
         WHERE precinct_id IS NOT NULL`,
        (err2, precinctRows) => {
          if (err2) {
            console.error("getDashboardStats precinct error:", err2);
            return res.status(500).json({ message: "Failed to fetch stats" });
          }

          db.query(
            `SELECT COUNT(*) AS total FROM tbl_households`,
            (err3, householdRows) => {
              if (err3) {
                console.error("getDashboardStats household error:", err3);
                return res.status(500).json({ message: "Failed to fetch stats" });
              }

              res.json({
                totalBarangays: barangayRows[0].total,
                totalPrecincts: precinctRows[0].total,
                encodedHouseholds: householdRows[0].total,
              });
            }
          );
        }
      );
    }
  );
};


/* =========================================
   BARANGAY ANALYTICS
========================================= */

exports.getBarangayAnalytics = (req, res) => {

  const sql = `
    SELECT
      b.barangay_name,
      COUNT(DISTINCT h.precinct_id) AS precincts,
      COUNT(h.id) AS households,
      SUM(h.voter_count) AS voters
    FROM tbl_households h
    JOIN tbl_barangays_voters b
      ON b.id = h.barangay_id
    GROUP BY h.barangay_id, b.barangay_name
    ORDER BY voters DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("getBarangayAnalytics error:", err);
      return res.status(500).json({ message: "Failed to fetch barangay analytics" });
    }

    res.json(rows);
  });
};


/* =========================================
   QUICK INSIGHTS
========================================= */

exports.getQuickInsights = (req, res) => {

  const topSql = `
    SELECT b.barangay_name, COUNT(h.id) AS households
    FROM tbl_households h
    JOIN tbl_barangays_voters b
      ON b.id = h.barangay_id
    GROUP BY h.barangay_id, b.barangay_name
    ORDER BY households DESC
    LIMIT 1
  `;

  db.query(topSql, (err, topRows) => {
    if (err) {
      console.error("getQuickInsights top error:", err);
      return res.status(500).json({ message: "Failed to fetch insights" });
    }

    db.query(
      `SELECT ROUND(AVG(voter_count),1) AS avg_voters FROM tbl_households`,
      (err2, avgRows) => {
        if (err2) {
          console.error("getQuickInsights avg error:", err2);
          return res.status(500).json({ message: "Failed to fetch insights" });
        }

        db.query(
          `SELECT ROUND(
              SUM(CASE WHEN precinct_id IS NOT NULL THEN 1 ELSE 0 END)
              * 100.0 / COUNT(*),0
           ) AS coverage_rate
           FROM tbl_households`,
          (err3, coverageRows) => {
            if (err3) {
              console.error("getQuickInsights coverage error:", err3);
              return res.status(500).json({ message: "Failed to fetch insights" });
            }

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


/* =========================================
   RECENT ACTIVITY
========================================= */

exports.getRecentActivity = (req, res) => {

  const sql = `
    SELECT
      h.id,
      b.barangay_name,
      h.family_leader_name,
      h.voter_count,
      h.created_at,
      h.updated_at
    FROM tbl_households h
    JOIN tbl_barangays_voters b
      ON b.id = h.barangay_id
    ORDER BY h.updated_at DESC
    LIMIT 10
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("getRecentActivity error:", err);
      return res.status(500).json({ message: "Failed to fetch activity" });
    }

    res.json(rows);
  });
};


/* =========================================
   CANDIDATE CRUD
========================================= */

// GET candidates
exports.getCandidates = (req, res) => {

  const sql = `
    SELECT id, full_name, position, party, election_year
    FROM tbl_candidates
    ORDER BY election_year DESC, position ASC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("getCandidates error:", err);
      return res.status(500).json({ message: "Failed to fetch candidates" });
    }

    res.json(rows);
  });
};


// CREATE candidate
exports.createCandidate = (req, res) => {

  const { full_name, position, party, election_year } = req.body;

  const sql = `
    INSERT INTO tbl_candidates
    (full_name, position, party, election_year)
    VALUES (?, ?, ?, ?)
  `;

  db.query(
    sql,
    [full_name, position, party, election_year],
    (err, result) => {

      if (err) {
        console.error("createCandidate error:", err);
        return res.status(500).json({ message: "Failed to create candidate" });
      }

      res.json({
        message: "Candidate created",
        id: result.insertId
      });
    }
  );
};


// UPDATE candidate
exports.updateCandidate = (req, res) => {

  const { id } = req.params;
  const { full_name, position, party, election_year } = req.body;

  const sql = `
    UPDATE tbl_candidates
    SET full_name=?, position=?, party=?, election_year=?
    WHERE id=?
  `;

  db.query(
    sql,
    [full_name, position, party, election_year, id],
    (err) => {

      if (err) {
        console.error("updateCandidate error:", err);
        return res.status(500).json({ message: "Failed to update candidate" });
      }

      res.json({ message: "Candidate updated" });
    }
  );
};


// DELETE candidate
exports.deleteCandidate = (req, res) => {

  const { id } = req.params;

  const sql = `DELETE FROM tbl_candidates WHERE id=?`;

  db.query(sql, [id], (err) => {

    if (err) {
      console.error("deleteCandidate error:", err);
      return res.status(500).json({ message: "Failed to delete candidate" });
    }

    res.json({ message: "Candidate deleted" });
  });
};