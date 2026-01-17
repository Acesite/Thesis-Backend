// routes/calamityradiusRoutes.js
const express = require("express");
const router = express.Router();

const {
  createCalamityRadius,
  getAllCalamityRadius,
} = require("../../Controllers/Calamity/calamityRadiusController");

// POST /api/calamityradius
router.post("/", createCalamityRadius);

// GET /api/calamityradius  -> return all saved radii
router.get("/", getAllCalamityRadius);

module.exports = router;
