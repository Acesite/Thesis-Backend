// routes/archiveRoutes.js
const express = require("express");
const router = express.Router();

const archiveController = require("../../Controllers/Archive/archiveController");


// list archived crops
router.get("/crops", archiveController.getArchivedCrops);

// restore archived crop
router.post("/crops/:id/restore", archiveController.restoreCrop);

// hard delete archived crop
router.delete("/crops/:id", archiveController.deleteCropForever);

module.exports = router;
