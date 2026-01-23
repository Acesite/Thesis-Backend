const express = require("express");
const router = express.Router();

const manageImpactController = require("../../Controllers/Calamity/manageimpactController");

// Base path will be /api/impacts
// So GET /api/impacts will return all impact records
router.get("/", manageImpactController.getImpactRecords);

module.exports = router;
