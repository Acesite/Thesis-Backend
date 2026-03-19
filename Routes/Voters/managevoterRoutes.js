const express = require("express");
const router = express.Router();

const {
  getDashboardStats,
  getBarangayAnalytics,
  getQuickInsights,
  getRecentActivity,

  // ✅ new endpoints
  getVoteStandings,
  getGenderBreakdown,
  getAgeBreakdown,
  getVisitProgress,

  getCandidates,
  createCandidate,
  updateCandidate,
  deleteCandidate,
} = require("../../Controllers/Voters/managevoterController");

// Existing routes
router.get("/dashboard-stats",    getDashboardStats);
router.get("/barangay-analytics", getBarangayAnalytics);
router.get("/quick-insights",     getQuickInsights);
router.get("/recent-activity",    getRecentActivity);

// ✅ New routes
router.get("/vote-standings",     getVoteStandings);
router.get("/gender-breakdown",   getGenderBreakdown);
router.get("/age-breakdown",      getAgeBreakdown);
router.get("/visit-progress",     getVisitProgress);

// Candidates CRUD
router.get("/candidates",         getCandidates);
router.post("/candidates",        createCandidate);
router.put("/candidates/:id",     updateCandidate);
router.delete("/candidates/:id",  deleteCandidate);

module.exports = router;