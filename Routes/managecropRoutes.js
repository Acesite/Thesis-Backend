const express = require("express");
const router = express.Router();
const controller = require("../Controllers/managecropController");

// GET all crops
router.get("/", controller.getAllCrops);

// DELETE crop by ID
router.delete("/:id", controller.deleteCrop);
// Edit
router.put("/:id", controller.updateCrop);


module.exports = router;
