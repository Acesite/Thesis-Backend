const express = require("express");
const router = express.Router();
const controller = require("../../Controllers/Crops/managecropController");

// GET all crops
router.get("/", controller.getAllCrops);

// UPDATE crop
router.put("/:id", controller.updateCrop);

// NEW: UPDATE farmer name (linked farmer_id)
router.put("/farmer/:id", controller.updateFarmerName);

// DELETE crop
router.delete("/:id", controller.deleteCrop);


module.exports = router;
