// Routes/Calamity/manageimpactRoutes.js
const express = require("express");
const router = express.Router();

const manageImpactController = require("../../Controllers/Calamity/manageimpactController");

// Base path mounted in server.js: app.use("/api/impacts", router)

// ✅ RAW table (exactly what you asked)
router.get("/raw", manageImpactController.getImpactRecordsRaw);

// ✅ Graph endpoints (for your Calamity graphs)
router.get("/summary", manageImpactController.getCalamitySummaryFromImpacts);
router.get("/timeline", manageImpactController.getCalamityTimelineFromImpacts);

// ✅ Your existing endpoints
router.get("/", manageImpactController.getImpactRecords);
router.put("/:id", manageImpactController.updateImpactRecord);
router.delete("/:id", manageImpactController.deleteImpactRecord);

module.exports = router;
