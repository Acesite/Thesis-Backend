const express = require("express");
const router = express.Router();
const cropsController = require("../Controllers/cropsController");

router.post("/", cropsController.createCrop);
router.get("/types", cropsController.getCropTypes); 
router.get("/polygons", cropsController.getAllPolygons);
router.get("/", cropsController.getCrops);
router.get("/:id", cropsController.getCropById); 
router.get("/varieties/:crop_type_id", cropsController.getCropVarietiesByType);




module.exports = router;
