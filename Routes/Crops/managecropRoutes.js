const express = require("express");
const router = express.Router();
const controller = require("../../Controllers/Crops/managecropController");

// GET all crops (with farmer + names)
router.get("/", controller.getAllCrops);

// UPDATE crop
router.put("/:id", controller.updateCrop);

// DELETE crop
router.delete("/:id", controller.deleteCrop);

module.exports = router;
