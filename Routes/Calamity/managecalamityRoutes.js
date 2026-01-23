// Routes/Calamity/calamityradiusRoutes.js
const express = require("express");
const router = express.Router();
const controller = require("../../Controllers/Calamity/calamityRadiusController");

// For file uploads
const fileUpload = require("express-fileupload");
router.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  createParentPath: true
}));

// ========== CALAMITY RADIUS CRUD ==========
router.post("/", controller.createCalamityRadius);
router.get("/", controller.getAllCalamityRadius);
router.delete("/:id", controller.deleteCalamityRadius);

// ========== PHOTOS ==========
router.post("/:id/photos", controller.addCalamityPolygonPhoto);
router.get("/:id/photos", controller.getCalamityPolygonPhotos);

// ========== IMPACTS ==========
router.post("/:id/impacts", controller.upsertCalamityImpact);
router.post("/:id/impacts/resolve", controller.resolveCalamityImpact);
router.get("/:id/impacts", controller.getCalamityImpactsByCalamity);

// ========== HISTORY ==========
router.get("/crop/:cropId/history", controller.getCalamityHistoryForCrop);

// ========== NEW ENDPOINTS FOR FRONTEND TABLE ==========
router.get("/test-impact-table", controller.testImpactTable);        // Test connection
router.get("/impact-records", controller.getAllCalamityCropImpacts); // Main data for table

module.exports = router;