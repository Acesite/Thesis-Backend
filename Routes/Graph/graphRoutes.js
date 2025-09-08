// routes/graphRoutes.js
const express = require("express");
const router = express.Router();
const { getCropTypeCounts,getTotalCrops  } = require("../../Controllers/Graph/graphController");

router.get("/crop-type-counts", getCropTypeCounts);
router.get("/total-crops", getTotalCrops); 

module.exports = router;
