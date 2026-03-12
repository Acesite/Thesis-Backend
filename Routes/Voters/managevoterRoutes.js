const express = require("express");
const router = express.Router();

const {
  getDashboardStats,
  getBarangayAnalytics,
  getQuickInsights,
  getRecentActivity,

  getCandidates,
  createCandidate,
  updateCandidate,
  deleteCandidate

} = require("../../Controllers/Voters/managevoterController");

("/test", (req, res) => {
  res.json({
    ok: true,
    message: "voters route works"
  });
});

router.get("/dashboard-stats", getDashboardStats);
router.get("/barangay-analytics", getBarangayAnalytics);
router.get("/quick-insights", getQuickInsights);
router.get("/recent-activity", getRecentActivity);

router.get("/candidates", getCandidates);
router.post("/candidates", createCandidate);
router.put("/candidates/:id", updateCandidate);
router.delete("/candidates/:id", deleteCandidate);


module.exports = router;