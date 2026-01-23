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
   getCalamityImpactsByCalamity,
} = require("../../Controllers/Calamity/calamityRadiusController");

router.post("/", createCalamityRadius)
router.get("/", getAllCalamityRadius);
router.post("/:id/photo", addCalamityPolygonPhoto);
router.get("/:id/photos", getCalamityPolygonPhotos);
router.post("/:id/impact", upsertCalamityImpact);
router.delete("/:id", deleteCalamityRadius);
router.patch("/:id/impact/resolve", resolveCalamityImpact);
router.get("/crop/:cropId/history", getCalamityHistoryForCrop);
router.get("/:id/impacts", getCalamityImpactsByCalamity);

module.exports = router;
