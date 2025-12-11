// Routes/Archive/archiveRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../Controllers/Archive/archiveController");

// List archived crops
router.get("/crops", ctrl.getArchivedCrops);

// Restore one crop
router.post("/crops/:id/restore", ctrl.restoreCrop);

// Permanently delete one crop
router.delete("/crops/:id", ctrl.deleteCropForever);

module.exports = router;
