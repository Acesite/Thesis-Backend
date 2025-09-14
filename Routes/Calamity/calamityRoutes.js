const express = require("express");
const router = express.Router();
const calamityController = require("../../Controllers/Calamity/calamityController");

// GET all calamities
router.get("/", calamityController.getAllCalamities);

// GET calamity polygons (GeoJSON)
router.get("/polygons", calamityController.getCalamityPolygons);

// GET calamity types
router.get("/types", calamityController.getCalamityTypes);

// POST new calamity
router.post("/", calamityController.addCalamity);

module.exports = router;
