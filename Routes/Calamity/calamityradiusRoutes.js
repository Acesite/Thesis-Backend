// Routes/Calamity/calamityradiusRoutes.js
const express = require("express");
const router = express.Router();

const {
  createCalamityRadius,
  getAllCalamityRadius,
  addCalamityPolygonPhoto,
  getCalamityPolygonPhotos,
  upsertCalamityImpact,
  deleteCalamityRadius,
   resolveCalamityImpact,
   getCalamityHistoryForCrop,
} = require("../../Controllers/Calamity/calamityRadiusController");

// Create a new calamity radius
// POST /api/calamityradius
router.post("/", createCalamityRadius);

// Get all saved calamity radii
// GET /api/calamityradius
router.get("/", getAllCalamityRadius);

// Upload a damage photo for a crop inside this calamity
// POST /api/calamityradius/:id/photo
router.post("/:id/photo", addCalamityPolygonPhoto);

// Get photos for one crop in this calamity
// GET /api/calamityradius/:id/photos?crop_id=123
router.get("/:id/photos", getCalamityPolygonPhotos);

router.post("/:id/impact", upsertCalamityImpact);

router.delete("/:id", deleteCalamityRadius);

router.patch("/:id/impact/resolve", resolveCalamityImpact);
router.get("/crop/:cropId/history", getCalamityHistoryForCrop);
module.exports = router;
