const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  getBarangayAnalytics,
  getQuickInsights,
  getRecentActivity,
} = require("../../Controllers/Voters/managevoterController");

router.get("/test", (req, res) => res.json({ ok: true, message: "voters route works" }));


router.get("/dashboard-stats", getDashboardStats);
router.get("/barangay-analytics", getBarangayAnalytics);
router.get("/quick-insights", getQuickInsights);
router.get("/recent-activity", getRecentActivity);

module.exports = router;