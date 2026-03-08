const express = require("express");
const router = express.Router();

const votersController = require("../../Controllers/Voters/votersController");

// Reference dropdowns
router.get("/barangays", votersController.getBarangays);
router.get("/precincts", votersController.getPrecincts);

// Households
router.get("/households", votersController.getAllHouseholds);
router.get("/households/:id", votersController.getHouseholdById);
router.post("/households", votersController.createHousehold);
router.put("/households/:id", votersController.updateHousehold);
router.delete("/households/:id", votersController.deleteHousehold);
router.get("/candidates", votersController.getCandidates);

module.exports = router;