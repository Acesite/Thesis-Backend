const express = require("express");
const router = express.Router();

const cropGraphs = require("../../Controllers/Graph/graphController");
const calamityGraphs = require("../../Controllers/Graph/calamityGraphController");

// CROPS
router.get("/crop-type-counts", cropGraphs.getCropTypeCounts);
router.get("/total-crops",      cropGraphs.getTotalCrops);

// CALAMITY
router.get("/calamity/summary",  calamityGraphs.getCalamitySummary);
router.get("/calamity/timeline", calamityGraphs.getCalamityTimeline);

module.exports = router;
