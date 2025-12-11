// Controllers/Graph/calamityGraphController.js
const db = require("../../Config/db");

/**
 * GET /api/graphs/calamity/summary?barangay=Taloc&year=2025
 * Returns:
 * {
 *   totalAffectedArea: number,
 *   affectedFarmers: number,
 *   byType: [{ calamity_type, incidents, total_area, farmers }]
 * }
 */
const getCalamitySummary = (req, res) => {
  const { barangay, year } = req.query;

  const where = [];
  const params = [];

  if (barangay && barangay !== "all") {
    where.push("c.barangay = ?");
    params.push(barangay);
  }
  if (year && year !== "all") {
    // your table has date_reported TIMESTAMP
    where.push("YEAR(c.date_reported) = ?");
    params.push(Number(year));
  }
  const WHERE = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const AREA = "COALESCE(c.affected_area, 0)";

  const totalSQL = `
    SELECT
      CAST(SUM(${AREA}) AS DECIMAL(18,2)) AS totalAffectedArea,
      COUNT(DISTINCT fc.farmer_id)        AS affectedFarmers
    FROM tbl_calamity c
    LEFT JOIN tbl_farmer_calamity fc
      ON fc.calamity_id = c.calamity_id
    ${WHERE};
  `;

  const byTypeSQL = `
    SELECT
      c.calamity_type,
      COUNT(*)                               AS incidents,
      CAST(SUM(${AREA}) AS DECIMAL(18,2))    AS total_area,
      COUNT(DISTINCT fc.farmer_id)           AS farmers
    FROM tbl_calamity c
    LEFT JOIN tbl_farmer_calamity fc
      ON fc.calamity_id = c.calamity_id
    ${WHERE}
    GROUP BY c.calamity_type
    ORDER BY total_area DESC, incidents DESC;
  `;

  db.query(totalSQL, params, (err, totalsRows) => {
    if (err) {
      console.error("Calamity totals error:", err.sqlMessage || err);
    }
    if (err) return res.status(500).json({ error: "Database error (totals)" });

    db.query(byTypeSQL, params, (err2, typeRows) => {
      if (err2) {
        console.error("Calamity by-type error:", err2.sqlMessage || err2);
        return res.status(500).json({ error: "Database error (byType)" });
      }
      const t = totalsRows?.[0] || { totalAffectedArea: 0, affectedFarmers: 0 };
      res.json({
        totalAffectedArea: Number(t.totalAffectedArea || 0),
        affectedFarmers: Number(t.affectedFarmers || 0),
        byType: typeRows || [],
      });
    });
  });
};

/**
 * GET /api/graphs/calamity/timeline?barangay=Taloc&year=2025&type=Flood
 * Returns monthly aggregates:
 * [ { month: '2025-01', incidents: 3, area: 1.25 }, ... ]
 */
const getCalamityTimeline = (req, res) => {
  const { barangay, year, type } = req.query;

  const where = [];
  const params = [];

  // we ONLY use date_reported, and require it when grouping by month
  where.push("c.date_reported IS NOT NULL");

  if (barangay && barangay !== "all") {
    where.push("c.barangay = ?");
    params.push(barangay);
  }
  if (year && year !== "all") {
    where.push("YEAR(c.date_reported) = ?");
    params.push(Number(year));
  }
  if (type && type !== "all") {
    where.push("c.calamity_type = ?");
    params.push(type);
  }
  const WHERE = `WHERE ${where.join(" AND ")}`;

  const AREA = "COALESCE(c.affected_area, 0)";

  const timelineSQL = `
    SELECT
      DATE_FORMAT(c.date_reported, '%Y-%m') AS month,
      COUNT(*)                               AS incidents,
      CAST(SUM(${AREA}) AS DECIMAL(18,2))    AS area
    FROM tbl_calamity c
    ${WHERE}
    GROUP BY month
    ORDER BY month ASC;
  `;

  db.query(timelineSQL, params, (err, rows) => {
    if (err) {
      console.error("Calamity timeline error:", err.sqlMessage || err);
      return res.status(500).json({ error: "Database error (timeline)" });
    }
    res.json(rows || []);
  });
};

module.exports = { getCalamitySummary, getCalamityTimeline };
