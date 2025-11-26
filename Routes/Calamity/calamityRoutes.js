// routes/calamity.routes.js
const express = require("express");
const router = express.Router();

// use the controller you just updated
const calamityController = require("../../Controllers/Calamity/calamityController");

// GET all calamities (returns `photos: []` and legacy `photo`)
router.get("/", calamityController.getAllCalamities);

// GET calamity polygons (GeoJSON)
router.get("/polygons", calamityController.getCalamityPolygons);

// GET calamity types
router.get("/types", calamityController.getCalamityTypes);

// GET all ecosystems
router.get("/ecosystems", calamityController.getAllEcosystems);

// GET all crops
router.get("/crops", calamityController.getAllCrops);

// GET varieties by crop type
router.get("/crops/:cropTypeId/varieties", calamityController.getVarietiesByCropType);

// POST new calamity (multipart/form-data; field name for multiple files: "photos")
router.post("/", calamityController.addCalamity);

router.get("/:id/farmer", calamityController.getFarmerByCalamityId);

module.exports = router;
